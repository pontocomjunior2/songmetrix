-- Crie um novo arquivo de migration, por exemplo: 20250214000072_create_exec_sql_function.sql

-- Criar a função exec_sql
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
