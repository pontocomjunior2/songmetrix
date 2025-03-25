-- Adicionar campo first_login_at à tabela users para rastrear primeiro login
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMP WITH TIME ZONE;

-- Adicionar comentário ao campo
COMMENT ON COLUMN public.users.first_login_at IS 'Data e hora do primeiro login após confirmação de email'; 