import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: '104.234.173.96',
  database: 'music_log',
  password: 'Conquista@@2',
  port: 5433,
  ssl: { rejectUnauthorized: false }
});

async function fixStreamsWithData() {
  try {
    console.log('🔧 CORRIGINDO TABELA STREAMS COM DADOS EXISTENTES\n');

    // 1. Verificar dados atuais
    console.log('1. Analisando dados existentes...');
    const dataCheck = await pool.query('SELECT COUNT(*) as count FROM streams');
    console.log('Total de registros:', dataCheck.rows[0].count);

    // Verificar IDs existentes
    const idsCheck = await pool.query(`
      SELECT id, COUNT(*) as count
      FROM streams
      GROUP BY id
      HAVING COUNT(*) > 1
      ORDER BY id;
    `);

    if (idsCheck.rows.length > 0) {
      console.log('❌ IDs duplicados encontrados:');
      idsCheck.rows.forEach(row => {
        console.log(`  - ID ${row.id}: ${row.count} ocorrências`);
      });
    } else {
      console.log('✅ Não há IDs duplicados');
    }

    // Verificar IDs NULL ou inválidos
    const nullIds = await pool.query(`
      SELECT COUNT(*) as count
      FROM streams
      WHERE id IS NULL OR id::text = '';
    `);
    console.log('IDs NULL/inválidos:', nullIds.rows[0].count);

    // Verificar range de IDs
    const idRange = await pool.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id
      FROM streams
      WHERE id IS NOT NULL AND id::text != '';
    `);
    console.log('Range de IDs válidos:', idRange.rows[0].min_id, 'até', idRange.rows[0].max_id);
    console.log('');

    // 2. Estratégia de correção
    console.log('2. Aplicando correção...');

    // Criar nova tabela com estrutura correta
    console.log('📋 Criando nova tabela streams_fixed...');
    await pool.query(`
      CREATE TABLE streams_fixed (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        sheet VARCHAR(255) NOT NULL,
        cidade VARCHAR(255) NOT NULL,
        estado VARCHAR(2) NOT NULL,
        regiao VARCHAR(50) NOT NULL,
        segmento TEXT NOT NULL,
        index VARCHAR(10) NOT NULL,
        formato TEXT,
        frequencia VARCHAR(50),
        pais VARCHAR(100) DEFAULT 'Brasil',
        facebook TEXT,
        instagram TEXT,
        twitter TEXT,
        youtube TEXT,
        site TEXT,
        monitoring_url TEXT,
        logo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Nova tabela criada');

    // Migrar dados preservando informações importantes
    console.log('📋 Migrando dados...');
    const migrationResult = await pool.query(`
      INSERT INTO streams_fixed (
        url, name, sheet, cidade, estado, regiao, segmento, index,
        formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url,
        created_at, updated_at
      )
      SELECT
        COALESCE(url, ''),
        COALESCE(name, ''),
        COALESCE(sheet, ''),
        COALESCE(cidade, ''),
        COALESCE(estado, ''),
        COALESCE(regiao, ''),
        COALESCE(segmento, ''),
        COALESCE(index, ''),
        formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url,
        COALESCE(created_at, CURRENT_TIMESTAMP),
        COALESCE(updated_at, CURRENT_TIMESTAMP)
      FROM streams
      ORDER BY
        CASE
          WHEN id IS NOT NULL AND id::text != '' THEN id::integer
          ELSE 999999
        END ASC,
        name ASC;
    `);

    console.log('✅ Dados migrados:', migrationResult.rowCount, 'registros');

    // Verificar se a migração foi bem-sucedida
    const newCount = await pool.query('SELECT COUNT(*) as count FROM streams_fixed');
    console.log('Registros na nova tabela:', newCount.rows[0].count);
    console.log('');

    // 3. Substituir tabelas
    console.log('3. Substituindo tabelas...');

    // Renomear tabelas
    await pool.query('ALTER TABLE streams RENAME TO streams_old');
    await pool.query('ALTER TABLE streams_fixed RENAME TO streams');
    console.log('✅ Tabelas trocadas');

    // Recriar índices
    console.log('📋 Recriando índices...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_streams_cidade ON streams(cidade)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_streams_estado ON streams(estado)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_streams_regiao ON streams(regiao)');
    console.log('✅ Índices criados');

    // Recriar trigger
    console.log('📋 Recriando trigger...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
         NEW.updated_at = now();
         RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_streams_modtime ON streams;
      CREATE TRIGGER update_streams_modtime
      BEFORE UPDATE ON streams
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_column();
    `);
    console.log('✅ Trigger criado');

    // 4. Teste final
    console.log('\n4. Teste final...');
    const testData = {
      url: 'http://test.com/stream',
      name: 'Rádio Teste Final',
      sheet: 'teste',
      cidade: 'São Paulo',
      estado: 'SP',
      regiao: 'Sudeste',
      segmento: 'Pop',
      index: '999'
    };

    const insertCols = Object.keys(testData);
    const insertVals = Object.values(testData);
    const params = insertCols.map((_, i) => '$' + (i + 1));

    const insertQuery = 'INSERT INTO streams (' + insertCols.join(', ') + ') VALUES (' + params.join(', ') + ') RETURNING id';
    const insertResult = await pool.query(insertQuery, insertVals);

    console.log('✅ Inserção de teste OK (ID: ' + insertResult.rows[0].id + ')');

    // Limpar teste
    await pool.query('DELETE FROM streams WHERE name = $1', ['Rádio Teste Final']);
    console.log('🧹 Teste limpo');

    // 5. Verificar resultado final
    console.log('\n5. Verificação final...');
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM streams');
    console.log('Total de registros na tabela corrigida:', finalCount.rows[0].count);

    const finalStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'streams' AND column_name = 'id';
    `);

    console.log('Coluna id corrigida:');
    console.log('  - Tipo:', finalStructure.rows[0].data_type);
    console.log('  - Default:', finalStructure.rows[0].column_default);
    console.log('');

    console.log('🎉 TABELA STREAMS CORRIGIDA COM SUCESSO!');
    console.log('✅ Backup disponível em: streams_old');
    console.log('✅ O endpoint POST /api/streams deve funcionar agora');
    console.log('');
    console.log('💡 Para remover backup: DROP TABLE streams_old;');

  } catch (error) {
    console.error('❌ Erro durante correção:', error.message);
    console.log('\n🔧 Situação:');
    console.log('- streams_old: tabela original (backup)');
    console.log('- streams_fixed: tabela nova (se foi criada)');
    console.log('- streams: tabela atual (pode estar inconsistente)');
  } finally {
    await pool.end();
  }
}

fixStreamsWithData();