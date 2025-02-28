-- Adicionar o valor TRIAL ao enum user_status
ALTER TYPE user_status ADD VALUE 'TRIAL';

-- Atualizar a documentação
COMMENT ON TYPE user_status IS 'Status do usuário: ADMIN, ATIVO, INATIVO ou TRIAL'; 