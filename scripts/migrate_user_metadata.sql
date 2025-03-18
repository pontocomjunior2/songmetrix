-- Script para migrar dados dos metadados do usuário para as colunas da tabela users

-- Atualizar a coluna full_name com o valor de fullName dos metadados
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_set(
    raw_user_meta_data, 
    '{full_name}', 
    to_jsonb(raw_user_meta_data->>'fullName')
  )
WHERE raw_user_meta_data->>'fullName' IS NOT NULL;

-- Atualizar a coluna whatsapp com o valor de whatsapp dos metadados
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_set(
    raw_user_meta_data, 
    '{whatsapp}', 
    to_jsonb(raw_user_meta_data->>'whatsapp')
  )
WHERE raw_user_meta_data->>'whatsapp' IS NOT NULL;

-- Copiar os valores dos metadados para as colunas da tabela users
UPDATE users
SET 
  full_name = u.raw_user_meta_data->>'fullName',
  whatsapp = u.raw_user_meta_data->>'whatsapp'
FROM auth.users u
WHERE users.id = u.id
AND (u.raw_user_meta_data->>'fullName' IS NOT NULL OR u.raw_user_meta_data->>'whatsapp' IS NOT NULL);

-- Verificar se as colunas existem e criar se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
    ALTER TABLE users ADD COLUMN full_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'whatsapp') THEN
    ALTER TABLE users ADD COLUMN whatsapp text;
  END IF;
END
$$;