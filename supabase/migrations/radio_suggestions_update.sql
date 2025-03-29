-- Adicionar o campo country à tabela radio_suggestions
ALTER TABLE IF EXISTS radio_suggestions 
ADD COLUMN IF NOT EXISTS country TEXT;

-- Adicionar comentário para o novo campo
COMMENT ON COLUMN radio_suggestions.country IS 'País de origem da rádio';

-- Atualizar os registros existentes para terem Brasil como país padrão
UPDATE radio_suggestions 
SET country = 'BR' 
WHERE country IS NULL; 