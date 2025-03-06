-- Modificar políticas de ativação e atualização de status do usuário

-- Remover política de atualização de status existente
DROP POLICY IF EXISTS "users_update_status_policy" ON public.users;

-- Criar nova política de atualização de status
CREATE POLICY "users_update_status_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  -- Permitir que usuários com status 'TRIAL' atualizem seu próprio status
  auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
)
WITH CHECK (
  -- Permitir que usuários com status 'TRIAL' atualizem seu próprio status
  auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
  AND
  -- Novo status deve ser válido
  NEW.status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL')
);

-- Remover política de ativação existente
DROP POLICY IF EXISTS "users_activation_policy" ON public.users;

-- Criar nova política de ativação
CREATE POLICY "users_activation_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  -- Permitir que usuários com status 'TRIAL' ativem sua própria conta
  auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);
