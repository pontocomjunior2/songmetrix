-- Script para adicionar o campo de logotipo à tabela streams

-- Adicionar campo logo_url
ALTER TABLE streams ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Adicionar comentário para o novo campo
COMMENT ON COLUMN streams.logo_url IS 'URL da imagem do logotipo da rádio'; 