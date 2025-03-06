-- Migration para corrigir o erro de referência a 'NEW' na política RLS
-- Este arquivo deve ser executado diretamente no SQL Editor do Supabase

-- Remover a política problemática
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar seus dados" ON "public"."users";

-- Criar a política corrigida sem uso direto de NEW na cláusula WITH CHECK
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

-- Adaptar a função de trigger que valida o status para uso correto de NEW
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

-- Recriar o trigger de validação para garantir que está usando a versão corrigida
DROP TRIGGER IF EXISTS validate_status_trigger ON public.users;
CREATE TRIGGER validate_status_trigger
BEFORE INSERT OR UPDATE OF status ON public.users
FOR EACH ROW EXECUTE FUNCTION public.validate_status_update();

-- Atualizar função para definir status padrão para novos usuários
CREATE OR REPLACE FUNCTION public.set_default_user_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Aqui NEW está no contexto correto de uma função de trigger
  IF NEW.status IS NULL OR NEW.status = 'INATIVO' THEN
    NEW.status := 'TRIAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger para definir o status padrão
DROP TRIGGER IF EXISTS user_insert_trigger ON public.users;
CREATE TRIGGER user_insert_trigger
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_default_user_status(); 