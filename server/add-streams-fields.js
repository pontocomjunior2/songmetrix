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

async function addStreamsFields() {
  try {
    console.log('Conectando ao banco de dados...');

    // Verificar se a tabela streams existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'streams'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.error('❌ Tabela streams não existe. Execute primeiro o script create-streams-table.js');
      process.exit(1);
    }

    console.log('✓ Tabela streams encontrada');

    // Adicionar campos opcionais
    console.log('Adicionando campos opcionais...');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS formato TEXT;`);
    console.log('✓ Campo formato adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS frequencia VARCHAR(50);`);
    console.log('✓ Campo frequencia adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS pais VARCHAR(100) DEFAULT 'Brasil';`);
    console.log('✓ Campo pais adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS facebook TEXT;`);
    console.log('✓ Campo facebook adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS instagram TEXT;`);
    console.log('✓ Campo instagram adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS twitter TEXT;`);
    console.log('✓ Campo twitter adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS youtube TEXT;`);
    console.log('✓ Campo youtube adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS site TEXT;`);
    console.log('✓ Campo site adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS monitoring_url TEXT;`);
    console.log('✓ Campo monitoring_url adicionado');

    await pool.query(`ALTER TABLE streams ADD COLUMN IF NOT EXISTS logo_url TEXT;`);
    console.log('✓ Campo logo_url adicionado');

    // Adicionar comentários
    await pool.query(`COMMENT ON COLUMN streams.formato IS 'Formato musical da rádio (substitui segmento)';`);
    await pool.query(`COMMENT ON COLUMN streams.frequencia IS 'Frequência da rádio (ex: 104,5 ou Web)';`);
    await pool.query(`COMMENT ON COLUMN streams.pais IS 'País onde a rádio está localizada';`);
    await pool.query(`COMMENT ON COLUMN streams.facebook IS 'URL da página do Facebook da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.instagram IS 'URL da página do Instagram da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.twitter IS 'URL da página do Twitter/X da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.youtube IS 'URL do canal do YouTube da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.site IS 'URL do site oficial da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.monitoring_url IS 'URL para monitoramento de ouvintes da rádio';`);
    await pool.query(`COMMENT ON COLUMN streams.logo_url IS 'URL da imagem do logotipo da rádio';`);

    console.log('✓ Comentários adicionados');

    console.log('\n🎉 Campos opcionais adicionados com sucesso!');
    console.log('A tabela streams agora está completa e pronta para uso.');

  } catch (error) {
    console.error('❌ Erro ao adicionar campos à tabela streams:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addStreamsFields();