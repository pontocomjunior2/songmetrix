-- Script para adicionar campos de Nome Completo e WhatsApp à tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS whatsapp text;

-- Garantir que as políticas de segurança permitam atualizar esses campos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can update their profile'
  ) THEN
    CREATE POLICY "Users can update their profile" ON users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END
$$;