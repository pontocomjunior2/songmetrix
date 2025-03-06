-- Esta é uma migração abrangente para corrigir todos os problemas relacionados ao status de usuário
-- e garantir que novos usuários sempre sejam registrados com o status TRIAL

-- 1. Corrigir função de validação de status para incluir TRIAL
CREATE OR REPLACE FUNCTION public.validate_status_update()
RETURNS TRIGGER AS $$ 
BEGIN
    -- Permitir valores válidos de status incluindo TRIAL
    IF NEW.status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
        RAISE EXCEPTION 'Status inválido. Valores permitidos: ADMIN, ATIVO, INATIVO, TRIAL';
    END IF;

    -- Apenas admins podem definir status ADMIN
    IF NEW.status = 'ADMIN' AND OLD.status != 'ADMIN' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem definir o status ADMIN';
    END IF;

    -- Manter status de administrador para admins existentes a menos que seja alterado por outro admin
    IF OLD.status = 'ADMIN' AND NEW.status != 'ADMIN' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Não é possível remover o status de administrador';
    END IF;

    -- Para novos usuários, forçar o status TRIAL
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS NULL) THEN
        -- Se for um novo registro, definir como TRIAL
        NEW.status := 'TRIAL';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar a política de atualização de status
DROP POLICY IF EXISTS "users_update_status_policy" ON public.users;
CREATE POLICY "users_update_status_policy" ON public.users
FOR UPDATE TO authenticated
USING (
    -- Usuário deve ser um administrador
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND status = 'ADMIN'
    )
    OR
    -- Ou ser o próprio usuário (para auto-registro)
    (id = auth.uid() AND auth.email() = email)
)
WITH CHECK (
    -- Usuário deve ser um administrador
    (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND status = 'ADMIN'
        )
        AND
        -- O novo status deve ser válido (incluindo TRIAL)
        NEW.status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL')
    )
    OR
    -- Ou ser o próprio usuário definindo como TRIAL
    (id = auth.uid() AND auth.email() = email AND NEW.status = 'TRIAL')
);

-- 3. Atualizar a política de inserção para permitir TRIAL
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    -- Deve ser o próprio registro do usuário
    id = auth.uid() 
    AND email = auth.email()
    AND status = 'TRIAL'
);

-- 4. Criar ou atualizar trigger para garantir que novos usuários sempre tenham o status TRIAL
DROP TRIGGER IF EXISTS ensure_new_user_is_trial_trigger ON public.users;

CREATE OR REPLACE FUNCTION ensure_new_user_is_trial()
RETURNS TRIGGER AS $$
BEGIN
    -- Definir o status como TRIAL para novos usuários
    IF NEW.status IS NULL OR NEW.status = 'INATIVO' THEN
        NEW.status := 'TRIAL';
        
        -- Log para diagnóstico
        RAISE NOTICE 'Status definido como TRIAL para novo usuário: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_new_user_is_trial_trigger
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION ensure_new_user_is_trial();

-- 5. Atualizar a função update_user_status para permitir TRIAL
DROP FUNCTION IF EXISTS update_user_status(uuid, text, uuid);
CREATE OR REPLACE FUNCTION update_user_status(
    p_user_id uuid,
    p_new_status text,
    p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_status text;
    v_user_record record;
    v_result jsonb;
BEGIN
    -- Verificar se o solicitante é administrador
    SELECT status INTO v_admin_status
    FROM users
    WHERE id = p_admin_id;

    IF v_admin_status IS NULL OR v_admin_status != 'ADMIN' THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    -- Verificar se o status é válido
    IF p_new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
        RAISE EXCEPTION 'Status inválido';
    END IF;

    -- Obter registro de usuário atual
    SELECT * INTO v_user_record
    FROM users
    WHERE id = p_user_id;

    IF v_user_record IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;

    -- Atualizar status do usuário
    UPDATE users
    SET 
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING jsonb_build_object(
        'id', id,
        'email', email,
        'status', status,
        'updated_at', updated_at
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Garantir a permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;

-- 6. Converter usuários INATIVO criados nos últimos 7 dias para TRIAL
UPDATE users
SET 
    status = 'TRIAL',
    updated_at = CURRENT_TIMESTAMP
WHERE 
    created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    AND status = 'INATIVO';

-- 7. Sincronizar todos os usuários com TRIAL para metadados
INSERT INTO auth_sync_queue (user_id, status, processed)
SELECT 
    id, 
    status, 
    FALSE
FROM 
    users
WHERE 
    status = 'TRIAL'
ON CONFLICT (user_id) 
DO UPDATE SET 
    status = EXCLUDED.status,
    processed = FALSE,
    updated_at = CURRENT_TIMESTAMP; 