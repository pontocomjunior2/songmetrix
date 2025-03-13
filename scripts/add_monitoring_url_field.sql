-- Script para adicionar o campo de URL de monitoramento de ouvintes à tabela streams

-- Adicionar campo monitoring_url
ALTER TABLE streams ADD COLUMN IF NOT EXISTS monitoring_url TEXT;

-- Adicionar comentário para o novo campo
COMMENT ON COLUMN streams.monitoring_url IS 'URL para monitoramento de ouvintes da rádio'; 