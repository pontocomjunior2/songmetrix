-- Script de diagnóstico e correção das políticas RLS da tabela radio_suggestions
-- Execute este script no Console SQL do Supabase

-- 1. Diagnosticar: Verificar se a tabela existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'radio_suggestions'
) AS "tabela_existe";

-- 2. Diagnosticar: Verificar o usuário atual e seu status
SELECT 
    auth.uid() AS "id_usuario_atual",
    (SELECT email FROM auth.users WHERE id = auth.uid()) AS "email_usuario",
    (SELECT raw_user_meta_data FROM auth.users WHERE id = auth.uid()) AS "metadados_usuario";

-- 3. Diagnosticar: Listar todas as políticas RLS na tabela
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'radio_suggestions';

-- 4. SOLUÇÃO: Remover todas as políticas existentes (podem estar causando conflitos)
DROP POLICY IF EXISTS "Usuários autenticados podem criar sugestões" ON public.radio_suggestions;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias sugestões" ON public.radio_suggestions;
DROP POLICY IF EXISTS "Apenas administradores podem atualizar sugestões" ON public.radio_suggestions;
DROP POLICY IF EXISTS "Apenas administradores podem excluir sugestões" ON public.radio_suggestions;
DROP POLICY IF EXISTS "Super acesso para administradores" ON public.radio_suggestions;
DROP POLICY IF EXISTS "Acesso total temporário" ON public.radio_suggestions;

-- 5. SOLUÇÃO: Resetar o RLS (desativar e reativar)
ALTER TABLE public.radio_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_suggestions ENABLE ROW LEVEL SECURITY;

-- 6. SOLUÇÃO: Criar uma política temporária que permita ACESSO TOTAL para TODOS os usuários autenticados
-- Isso é só para teste - depois substitua por políticas mais restritivas
CREATE POLICY "Acesso total temporário" 
ON public.radio_suggestions 
FOR ALL 
TO authenticated 
USING (true);

-- 7. Confirmar: Verificar se a política foi criada
SELECT 
    schemaname, 
    tablename, 
    policyname
FROM 
    pg_policies 
WHERE 
    tablename = 'radio_suggestions';

-- INSTRUÇÃO: Após confirmar que funciona com esta política liberal,
-- você pode restringir novamente executando o script fix_radio_suggestions_permissions.sql 