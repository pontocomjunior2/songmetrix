-- Aplicar correções nas tabelas de email_logs para garantir CASCADE

-- Adicionar CASCADE na referência para auth.users se não existir
ALTER TABLE public.email_logs
DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;

ALTER TABLE public.email_logs
ADD CONSTRAINT email_logs_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Verificar se a tabela users tem CASCADE para auth.users
SELECT 
  EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'users'
      AND kcu.column_name = 'id'
      AND rc.delete_rule = 'CASCADE'
  ) as has_cascade;

-- Aplicar CASCADE na tabela users se necessário
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
ADD CONSTRAINT users_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Garantir que todas as tabelas relacionadas usem CASCADE para usuários
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_catalog = kcu.constraint_catalog
      AND tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
      AND tc.table_schema = 'public'
      AND tc.table_name != 'email_logs'  -- Já tratamos esta tabela acima
      AND tc.table_name != 'users'       -- Já tratamos esta tabela acima
  LOOP
    EXECUTE format('
      ALTER TABLE public.%I
      DROP CONSTRAINT IF EXISTS %I_user_id_fkey;
      
      ALTER TABLE public.%I
      ADD CONSTRAINT %I_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
    ', tbl.table_name, tbl.table_name, tbl.table_name, tbl.table_name);
  END LOOP;
END
$$; 