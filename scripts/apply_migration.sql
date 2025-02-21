-- Criar uma função para atualizar o status do usuário com validações
CREATE OR REPLACE FUNCTION update_user_status(
  p_user_id uuid,
  p_new_status text,
  p_admin_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_admin_status text;
  v_user_record record;
  v_result jsonb;
BEGIN
  -- Verificar se o usuário que faz a requisição é um admin
  SELECT status INTO v_admin_status
  FROM users
  WHERE id = p_admin_id;

  IF v_admin_status IS NULL OR v_admin_status != 'ADMIN' THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Verificar se o status é válido
  IF p_new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  -- Verificar se o usuário a ser atualizado existe
  SELECT * INTO v_user_record
  FROM users
  WHERE id = p_user_id;

  IF v_user_record IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  -- Atualizar o status do usuário
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que apenas administradores podem executar a função
REVOKE ALL ON FUNCTION update_user_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;

-- Atualizar a política de RLS para a tabela users
DROP POLICY IF EXISTS "users_update_status_policy" ON public.users;

CREATE POLICY "users_update_status_policy" ON public.users
FOR UPDATE TO authenticated
USING (
  -- Usuário deve ser um admin
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
)
WITH CHECK (
  -- Usuário deve ser um admin
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
  AND
  -- Novo status deve ser válido
  NEW.status IN ('ADMIN', 'ATIVO', 'INATIVO')
);

-- Garantir que RLS está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
