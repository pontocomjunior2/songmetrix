-- Primeiro, criar um novo tipo de enum com os valores atualizados
CREATE TYPE user_status_new AS ENUM ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL');

-- Remover o valor padrão da coluna status
ALTER TABLE users ALTER COLUMN status DROP DEFAULT;

-- Atualizar a coluna status na tabela users para aceitar o novo tipo
ALTER TABLE users 
  ALTER COLUMN status TYPE user_status_new 
  USING status::text::user_status_new;

-- Remover o tipo antigo
DROP TYPE user_status;

-- Renomear o novo tipo para o nome original
ALTER TYPE user_status_new RENAME TO user_status;

-- Redefinir o valor padrão da coluna status
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'INATIVO'::user_status;

-- Atualizar a documentação
COMMENT ON TYPE user_status IS 'Status do usuário: ADMIN, ATIVO, INATIVO ou TRIAL'; 