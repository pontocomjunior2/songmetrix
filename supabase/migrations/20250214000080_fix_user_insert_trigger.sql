-- Criar ou substituir a função de trigger para inserção de usuários
CREATE OR REPLACE FUNCTION set_default_user_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Sempre definir status como TRIAL para novos usuários
    -- Não verificamos mais a data de criação, todos os novos usuários começam como TRIAL
    NEW.status = 'TRIAL';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover o trigger existente se houver
DROP TRIGGER IF EXISTS set_default_user_status ON users;

-- Criar o trigger para ser executado antes da inserção
CREATE TRIGGER set_default_user_status
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_default_user_status(); 