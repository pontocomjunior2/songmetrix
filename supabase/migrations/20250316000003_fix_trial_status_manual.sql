-- Migration para corrigir problemas com status TRIAL
-- Este arquivo deve ser executado diretamente no SQL Editor do Supabase

-- 1. Corrigir a política de atualização de status para incluir TRIAL
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar seus dados" ON "public"."users";
CREATE POLICY "Usuários autenticados podem atualizar seus dados" 
ON "public"."users" 
FOR UPDATE TO authenticated
USING (
  auth.uid() = id
) 
WITH CHECK (
  (auth.uid() = id) AND
  (
    -- Validar se o novo status é permitido
    (status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL')) AND
    -- Apenas admins podem definir o status para ADMIN
    (
      (status = 'ADMIN' AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
      )) OR
      (status != 'ADMIN')
    )
  )
);

-- 2. Criar função de validação de status que inclui TRIAL
CREATE OR REPLACE FUNCTION public.validate_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o novo status é válido
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
    RAISE EXCEPTION 'Status inválido: %. Os valores permitidos são: ADMIN, ATIVO, INATIVO, TRIAL', NEW.status;
  END IF;

  -- Verificar se o usuário está tentando se tornar ADMIN
  IF NEW.status = 'ADMIN' AND (OLD.status IS NULL OR OLD.status != 'ADMIN') THEN
    -- Verificar se o usuário atual é um admin
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem definir o status para ADMIN';
    END IF;
  END IF;

  -- Se o usuário já é ADMIN, verificar se não está sendo alterado por um não-admin
  IF OLD.status = 'ADMIN' AND NEW.status != 'ADMIN' THEN
    -- Verificar se o usuário atual é um admin
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o status de um administrador';
    END IF;
  END IF;

  -- Para usuários novos, definir o status inicial como TRIAL
  IF TG_OP = 'INSERT' AND (NEW.status IS NULL OR NEW.status = 'INATIVO') THEN
    NEW.status := 'TRIAL';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger para validar atualizações de status
DROP TRIGGER IF EXISTS validate_status_trigger ON public.users;
CREATE TRIGGER validate_status_trigger
BEFORE INSERT OR UPDATE OF status ON public.users
FOR EACH ROW EXECUTE FUNCTION public.validate_status_update();

-- 4. Função para definir o status padrão para novos usuários como TRIAL
CREATE OR REPLACE FUNCTION public.set_default_user_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'INATIVO' THEN
    NEW.status := 'TRIAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger para definir o status padrão para novos usuários
DROP TRIGGER IF EXISTS user_insert_trigger ON public.users;
CREATE TRIGGER user_insert_trigger
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_default_user_status();

-- 6. Atualizar a função para permitir a atualização do status do usuário para TRIAL
CREATE OR REPLACE FUNCTION public.update_user_status(
  p_user_id uuid,
  p_status text
)
RETURNS VOID AS $$
BEGIN
  -- Verificar se o status é válido
  IF p_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
    RAISE EXCEPTION 'Status inválido: %. Os valores permitidos são: ADMIN, ATIVO, INATIVO, TRIAL', p_status;
  END IF;

  -- Verificar se o usuário está tentando definir o status de alguém para ADMIN
  IF p_status = 'ADMIN' THEN
    -- Verificar se o usuário atual é um admin
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem definir o status para ADMIN';
    END IF;
  END IF;

  -- Verificar se está tentando alterar o status de um admin
  IF EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND status = 'ADMIN'
  ) THEN
    -- Verificar se o usuário atual é um admin
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o status de um administrador';
    END IF;
  END IF;

  -- Atualizar o status
  UPDATE users
  SET status = p_status
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Converter usuários recentes com status INATIVO para TRIAL
UPDATE users
SET status = 'TRIAL'
WHERE created_at >= NOW() - INTERVAL '7 days'
AND status = 'INATIVO';

-- 8. Inserir usuários com status TRIAL na fila de sincronização de metadados de auth
INSERT INTO auth_sync_queue (user_id, type, processed, created_at, updated_at)
SELECT id, 'update_metadata', false, NOW(), NOW()
FROM users
WHERE status = 'TRIAL'
AND NOT EXISTS (
  SELECT 1 FROM auth_sync_queue WHERE user_id = users.id AND processed = false
);

-- Fim da migração 