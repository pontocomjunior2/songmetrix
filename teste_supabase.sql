-- Script para testar se as permissões de acesso à tabela estão funcionando
-- Execute este script no Console SQL do Supabase

-- 1. Confirmar que a tabela existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'radio_suggestions'
) AS "tabela_existe";

-- 2. Verificar o usuário atual (deve ser um administrador do Supabase)
SELECT 
    auth.uid() AS "id_usuario_atual",
    (SELECT email FROM auth.users WHERE id = auth.uid()) AS "email_usuario",
    (SELECT raw_user_meta_data FROM auth.users WHERE id = auth.uid()) AS "metadados_usuario";

-- 3. Verificar as políticas existentes para a tabela
SELECT 
    schemaname, 
    tablename, 
    policyname,
    cmd, 
    roles
FROM 
    pg_policies 
WHERE 
    tablename = 'radio_suggestions';

-- 4. Garantir que o RLS esteja ativado
SELECT 
    relname AS "tabela",
    relrowsecurity AS "rls_habilitado"
FROM 
    pg_class
WHERE 
    relname = 'radio_suggestions';

-- 5. Realizar operações CRUD básicas para testar a tabela
-- 5.1. Inserir um registro de teste
INSERT INTO public.radio_suggestions 
    (radio_name, city, state, user_id, user_email, status) 
VALUES 
    ('Rádio Teste SQL', 'Cidade Teste', 'TS', 
     (SELECT id FROM auth.users WHERE id = auth.uid()), 
     (SELECT email FROM auth.users WHERE id = auth.uid()), 
     'pending')
RETURNING *;

-- 5.2. Consultar registros
SELECT * FROM public.radio_suggestions ORDER BY created_at DESC LIMIT 5;

-- 5.3. Atualizar um registro
UPDATE public.radio_suggestions 
SET status = 'approved' 
WHERE radio_name = 'Rádio Teste SQL' 
RETURNING *;

-- 5.4. Limpar o registro de teste (opcional)
DELETE FROM public.radio_suggestions 
WHERE radio_name = 'Rádio Teste SQL' 
RETURNING *; 