-- Atualizar a função do trigger para aceitar o status TRIAL
CREATE OR REPLACE FUNCTION validate_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar se o status é válido
    IF NEW.status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
        RAISE EXCEPTION 'Status inválido: %', NEW.status;
    END IF;
    
    -- Atualizar o campo updated_at
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql; 