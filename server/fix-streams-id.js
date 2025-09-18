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

async function fixStreamsId() {
  try {
    console.log('🔧 CORRIGINDO COLUNA ID DA TABELA STREAMS\n');

    // 1. Verificar estrutura atual da coluna id
    console.log('1. Verificando estrutura da coluna id...');
    const idColumn = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default, is_identity
      FROM information_schema.columns
      WHERE table_name = 'streams' AND column_name = 'id';
    `);

    if (idColumn.rows.length === 0) {
      console.log('❌ Coluna id não existe!');
      return;
    }

    const idInfo = idColumn.rows[0];
    console.log('Coluna id atual:');
    console.log('  - Tipo:', idInfo.data_type);
    console.log('  - Nullable:', idInfo.is_nullable);
    console.log('  - Default:', idInfo.column_default);
    console.log('  - Is Identity:', idInfo.is_identity);
    console.log('');

    // 2. Verificar se já existe uma sequence
    console.log('2. Verificando sequences existentes...');
    const sequences = await pool.query(`
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_name LIKE '%streams%';
    `);

    console.log('Sequences encontradas:', sequences.rows.map(r => r.sequence_name));
    console.log('');

    // 3. Corrigir a coluna id
    console.log('3. Corrigindo coluna id...');

    // Primeiro, verificar se há dados na tabela
    const dataCheck = await pool.query('SELECT COUNT(*) as count FROM streams');
    const hasData = dataCheck.rows[0].count > 0;

    if (hasData) {
      console.log('⚠️ A tabela possui dados. Fazendo backup...');

      // Criar tabela temporária com estrutura correta
      await pool.query(`
        CREATE TABLE streams_backup AS
        SELECT * FROM streams;
      `);
      console.log('✅ Backup criado');
    }

    // Dropar constraints e indexes relacionados ao id
    try {
      await pool.query('DROP INDEX IF EXISTS streams_pkey');
      console.log('✅ Primary key removido');
    } catch (e) {
      console.log('ℹ️ Primary key não existia ou já foi removido');
    }

    // Recriar a coluna id corretamente
    if (hasData) {
      // Se há dados, precisamos preservar os IDs existentes
      console.log('📋 Recriando coluna id preservando dados...');

      // Adicionar nova coluna id_temp
      await pool.query('ALTER TABLE streams ADD COLUMN id_temp SERIAL PRIMARY KEY');

      // Atualizar os valores preservando os IDs originais
      await pool.query(`
        UPDATE streams
        SET id_temp = CASE
          WHEN id IS NOT NULL THEN id::integer
          ELSE nextval('streams_id_temp_seq')
        END;
      `);

      // Remover coluna id antiga
      await pool.query('ALTER TABLE streams DROP COLUMN id');

      // Renomear id_temp para id
      await pool.query('ALTER TABLE streams RENAME COLUMN id_temp TO id');

    } else {
      // Se não há dados, recriar do zero
      console.log('📋 Recriando coluna id (tabela vazia)...');

      // Remover coluna id existente
      await pool.query('ALTER TABLE streams DROP COLUMN IF EXISTS id');

      // Adicionar nova coluna id
      await pool.query('ALTER TABLE streams ADD COLUMN id SERIAL PRIMARY KEY');
    }

    console.log('✅ Coluna id corrigida\n');

    // 4. Verificar resultado
    console.log('4. Verificando resultado...');
    const newIdColumn = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default, is_identity
      FROM information_schema.columns
      WHERE table_name = 'streams' AND column_name = 'id';
    `);

    const newIdInfo = newIdColumn.rows[0];
    console.log('Nova coluna id:');
    console.log('  - Tipo:', newIdInfo.data_type);
    console.log('  - Nullable:', newIdInfo.is_nullable);
    console.log('  - Default:', newIdInfo.column_default);
    console.log('  - Is Identity:', newIdInfo.is_identity);
    console.log('');

    // 5. Teste de inserção
    console.log('5. Testando inserção...');
    const testData = {
      url: 'http://test.com/stream',
      name: 'Rádio Teste',
      sheet: 'teste',
      cidade: 'São Paulo',
      estado: 'SP',
      regiao: 'Sudeste',
      segmento: 'Pop',
      index: '001'
    };

    const insertCols = Object.keys(testData);
    const insertVals = Object.values(testData);
    const params = insertCols.map((_, i) => '$' + (i + 1));

    const insertQuery = 'INSERT INTO streams (' + insertCols.join(', ') + ') VALUES (' + params.join(', ') + ') RETURNING id';
    const insertResult = await pool.query(insertQuery, insertVals);

    console.log('✅ Inserção OK (ID gerado: ' + insertResult.rows[0].id + ')');

    // Limpar teste
    await pool.query('DELETE FROM streams WHERE name = $1', ['Rádio Teste']);
    console.log('🧹 Teste limpo\n');

    // 6. Verificar se backup pode ser removido
    if (hasData) {
      console.log('6. Backup disponível em streams_backup');
      console.log('💡 Você pode remover o backup com: DROP TABLE streams_backup;');
    }

    console.log('🎉 COLUNA ID CORRIGIDA!');
    console.log('✅ O endpoint POST /api/streams deve funcionar agora');

  } catch (error) {
    console.error('❌ Erro durante correção:', error.message);
    console.log('\n🔧 Backup disponível em streams_backup se algo deu errado');
  } finally {
    await pool.end();
  }
}

fixStreamsId();