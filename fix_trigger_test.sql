-- Script para testar e diagnosticar o problema com o trigger do Brevo
SET client_min_messages TO 'DEBUG';

-- Verificar se o trigger existe
SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_sync_user_to_brevo'
) AS trigger_exists;

-- Verificar a definição do trigger
SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgname = 'trigger_sync_user_to_brevo';

-- Verificar a função associada ao trigger
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'sync_user_to_brevo';

-- Verificar permissões na função e tabelas
SELECT 
    pg_proc.proname AS function_name,
    pg_roles.rolname AS owner,
    pg_proc.prosecdef AS is_security_definer
FROM 
    pg_proc
JOIN 
    pg_roles ON pg_proc.proowner = pg_roles.oid
WHERE 
    proname = 'sync_user_to_brevo';

-- Verificar ID das últimas linhas na tabela de usuários
SELECT id, email, status, created_at, updated_at 
FROM users
ORDER BY updated_at DESC
LIMIT 5;

-- Testar o trigger manualmente com um UPDATE que não afeta o banco de dados real
BEGIN;
    -- Testar um UPDATE simulado (sem alterar valores)
    UPDATE users 
    SET updated_at = updated_at 
    WHERE id = 'b1ff0803-c597-41fb-b5d1-47d7f73bf52f' 
    RETURNING id, email, status, updated_at;
ROLLBACK;

-- Verificar logs de erro no Postgres
SELECT 
    log_time,
    user_name,
    database_name,
    process_id,
    message_text
FROM 
    pg_catalog.pg_logs 
WHERE 
    message_text LIKE '%sync_user_to_brevo%' OR
    message_text LIKE '%brevo%' OR
    message_text LIKE '%trigger%'
ORDER BY 
    log_time DESC
LIMIT 50;

-- Instruções para solução
SELECT 'PROBLEMA IDENTIFICADO: O trigger pode estar corrompido ou desativado' AS diagnostic_info
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_sync_user_to_brevo'
);

-- Adicionar comentários com próximos passos
DO $$
BEGIN
    RAISE NOTICE '========== DIAGNÓSTICO DO TRIGGER BREVO ==========';
    RAISE NOTICE 'Após analisar os resultados acima, siga estas instruções:';
    RAISE NOTICE '1. Se o trigger não existir, aplique o script fix_brevo_integration.sql para reinstalá-lo';
    RAISE NOTICE '2. Se o trigger existir mas não estiver sendo acionado, verifique permissões e dependências';
    RAISE NOTICE '3. Se o trigger estiver gerando erros, verifique os logs acima para mais detalhes';
    RAISE NOTICE '4. Verifique se a função Edge user-webhook está corretamente implementada e com as variáveis de ambiente apropriadas';
    RAISE NOTICE '======================================================';
END $$; 