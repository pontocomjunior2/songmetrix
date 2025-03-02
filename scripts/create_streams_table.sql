-- Criação da tabela streams
CREATE TABLE IF NOT EXISTS streams (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sheet VARCHAR(255) NOT NULL,
  cidade VARCHAR(255) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  regiao VARCHAR(50) NOT NULL,
  segmento TEXT NOT NULL,
  index VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhorar a performance
CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name);
CREATE INDEX IF NOT EXISTS idx_streams_cidade ON streams(cidade);
CREATE INDEX IF NOT EXISTS idx_streams_estado ON streams(estado);
CREATE INDEX IF NOT EXISTS idx_streams_regiao ON streams(regiao);

-- Função para atualizar o timestamp de updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar o timestamp de updated_at
DROP TRIGGER IF EXISTS update_streams_modtime ON streams;
CREATE TRIGGER update_streams_modtime
BEFORE UPDATE ON streams
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Comentários na tabela e colunas
COMMENT ON TABLE streams IS 'Tabela que armazena informações sobre streams de rádios';
COMMENT ON COLUMN streams.url IS 'URL do stream da rádio';
COMMENT ON COLUMN streams.name IS 'Nome da rádio';
COMMENT ON COLUMN streams.sheet IS 'Nome da planilha associada à rádio';
COMMENT ON COLUMN streams.cidade IS 'Cidade onde a rádio está localizada';
COMMENT ON COLUMN streams.estado IS 'Estado onde a rádio está localizada (sigla)';
COMMENT ON COLUMN streams.regiao IS 'Região do Brasil onde a rádio está localizada';
COMMENT ON COLUMN streams.segmento IS 'Segmento musical da rádio';
COMMENT ON COLUMN streams.index IS 'Índice da rádio no sistema'; 