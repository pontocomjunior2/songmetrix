-- Primeiro, vamos salvar a definição do trigger para recriá-lo depois
DO $$
DECLARE
    trigger_def text;
    function_def text;
BEGIN
    -- Obter a definição da função do trigger
    SELECT pg_get_functiondef(pg_proc.oid)
    INTO function_def
    FROM pg_proc
    JOIN pg_trigger ON pg_proc.proname = pg_trigger.tgfname
    WHERE pg_trigger.tgname = 'validate_status_update';
    
    -- Salvar a definição em uma tabela temporária
    CREATE TEMP TABLE trigger_backup AS
    SELECT function_def;
END $$;

-- Remover o trigger
DROP TRIGGER IF EXISTS validate_status_update ON users;

-- Adicionar o valor TRIAL ao enum user_status
ALTER TYPE user_status ADD VALUE 'TRIAL';

-- Recriar o trigger usando a definição salva
DO $$
DECLARE
    func_def text;
BEGIN
    -- Obter a definição da função salva
    SELECT function_def INTO func_def FROM trigger_backup;
    
    -- Modificar a definição para incluir o valor TRIAL
    func_def := regexp_replace(
        func_def,
        'NEW.status NOT IN \(''ADMIN'', ''ATIVO'', ''INATIVO''\)',
        'NEW.status NOT IN (''ADMIN'', ''ATIVO'', ''INATIVO'', ''TRIAL'')',
        'g'
    );
    
    -- Executar a definição modificada
    EXECUTE func_def;
    
    -- Recriar o trigger
    EXECUTE 'CREATE TRIGGER validate_status_update
             BEFORE UPDATE ON users
             FOR EACH ROW
             EXECUTE FUNCTION validate_status_update()';
END $$;

-- Limpar a tabela temporária
DROP TABLE IF EXISTS trigger_backup;

-- Atualizar a documentação
COMMENT ON TYPE user_status IS 'Status do usuário: ADMIN, ATIVO, INATIVO ou TRIAL'; 