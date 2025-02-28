-- Atualizar todos os usuários criados nos últimos 7 dias para o status TRIAL
UPDATE users
SET 
    status = 'TRIAL',
    updated_at = CURRENT_TIMESTAMP
WHERE 
    created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    AND status != 'TRIAL';

-- Criar uma função para sincronizar o status entre a tabela users e os metadados do Supabase Auth
CREATE OR REPLACE FUNCTION sync_user_status_to_auth()
RETURNS TRIGGER AS $$
DECLARE
    auth_uid UUID;
    current_metadata JSONB;
BEGIN
    -- Obter o ID do usuário
    auth_uid := NEW.id;
    
    -- Atualizar os metadados do usuário no Auth
    -- Esta parte será executada pelo servidor Node.js, pois o PostgreSQL não tem acesso direto à API do Supabase Auth
    -- Mas podemos registrar que uma atualização é necessária
    
    -- Inserir ou atualizar um registro na tabela de sincronização
    INSERT INTO auth_sync_queue (user_id, status, processed)
    VALUES (auth_uid, NEW.status, FALSE)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = NEW.status,
        processed = FALSE,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela para fila de sincronização
CREATE TABLE IF NOT EXISTS auth_sync_queue (
    user_id UUID PRIMARY KEY,
    status TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Remover o trigger existente se houver
DROP TRIGGER IF EXISTS sync_user_status_to_auth ON users;

-- Criar o trigger para ser executado após a atualização do status
CREATE TRIGGER sync_user_status_to_auth
AFTER UPDATE OF status ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_status_to_auth(); 