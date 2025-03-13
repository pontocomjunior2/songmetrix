-- Script para adicionar novos campos à tabela streams
-- Este script adiciona os campos solicitados sem modificar os campos existentes

-- Adicionar campo formato (novo campo que substituirá segmento)
ALTER TABLE streams ADD COLUMN IF NOT EXISTS formato TEXT;

-- Adicionar campo frequencia
ALTER TABLE streams ADD COLUMN IF NOT EXISTS frequencia VARCHAR(50);

-- Adicionar campo pais
ALTER TABLE streams ADD COLUMN IF NOT EXISTS pais VARCHAR(100) DEFAULT 'Brasil';

-- Adicionar campos de redes sociais
ALTER TABLE streams ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS twitter TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS youtube TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS site TEXT;

-- Adicionar comentários para os novos campos
COMMENT ON COLUMN streams.formato IS 'Formato musical da rádio (substitui segmento)';
COMMENT ON COLUMN streams.frequencia IS 'Frequência da rádio (ex: 104,5 ou Web)';
COMMENT ON COLUMN streams.pais IS 'País onde a rádio está localizada';
COMMENT ON COLUMN streams.facebook IS 'URL da página do Facebook da rádio';
COMMENT ON COLUMN streams.instagram IS 'URL da página do Instagram da rádio';
COMMENT ON COLUMN streams.twitter IS 'URL da página do Twitter/X da rádio';
COMMENT ON COLUMN streams.youtube IS 'URL do canal do YouTube da rádio';
COMMENT ON COLUMN streams.site IS 'URL do site oficial da rádio';

-- Atualizar o campo formato com os valores do campo segmento para manter a compatibilidade
UPDATE streams SET formato = segmento WHERE formato IS NULL; 