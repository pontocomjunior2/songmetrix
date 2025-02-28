-- Remover a restrição users_status_check existente
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Adicionar a restrição novamente com o valor TRIAL incluído
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL'));

-- Atualizar a documentação
COMMENT ON CONSTRAINT users_status_check ON users IS 'Verifica se o status do usuário é válido: ADMIN, ATIVO, INATIVO ou TRIAL'; 