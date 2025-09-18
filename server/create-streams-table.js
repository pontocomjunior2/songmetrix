import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env.production.bkp') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

async function createStreamsTable() {
  try {
    console.log('Conectando ao banco de dados...');

    // Criação da tabela streams
    await pool.query(`
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
    `);
    console.log('✓ Tabela streams criada com sucesso');

    // Índices para melhorar a performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_streams_cidade ON streams(cidade);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_streams_estado ON streams(estado);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_streams_regiao ON streams(regiao);`);
    console.log('✓ Índices criados com sucesso');

    // Função para atualizar o timestamp de updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
         NEW.updated_at = now();
         RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✓ Função update_modified_column criada com sucesso');

    // Trigger para atualizar o timestamp de updated_at
    await pool.query(`
      DROP TRIGGER IF EXISTS update_streams_modtime ON streams;
      CREATE TRIGGER update_streams_modtime
      BEFORE UPDATE ON streams
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_column();
    `);
    console.log('✓ Trigger update_streams_modtime criado com sucesso');

    // Comentários na tabela e colunas
    await pool.query(`COMMENT ON TABLE streams IS 'Tabela que armazena informações sobre streams de rádios';`);
    await pool.query(`COMMENT ON COLUMN streams.url IS 'URL do stream da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.name IS 'Nome da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.sheet IS 'Nome da planilha associada à rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.cidade IS 'Cidade onde a rádio está localizada';`);
    await pool.query(`COMMENT ON COLUMN streams.estado IS 'Estado onde a rádio está localizada (sigla)';`);
    await pool.query(`COMMENT ON COLUMN streams.regiao IS 'Região do Brasil onde a rádio está localizada';`);
    await pool.query(`COMMENT ON COLUMN streams.segmento IS 'Segmento musical da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.index IS 'Índice da rádio no sistema';`);
    console.log('✓ Comentários adicionados com sucesso');

    console.log('\n🎉 Tabela streams criada com sucesso!');
    console.log('Agora você pode testar o endpoint POST /api/streams');

  } catch (error) {
    console.error('❌ Erro ao criar tabela streams:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createStreamsTable();