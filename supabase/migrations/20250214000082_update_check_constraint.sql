-- Remover a restrição check_valid_status existente
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_valid_status;

-- Adicionar a restrição novamente com o valor TRIAL incluído
ALTER TABLE users ADD CONSTRAINT check_valid_status CHECK (status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL'));

-- Atualizar a documentação
COMMENT ON CONSTRAINT check_valid_status ON users IS 'Verifica se o status do usuário é válido: ADMIN, ATIVO, INATIVO ou TRIAL'; 