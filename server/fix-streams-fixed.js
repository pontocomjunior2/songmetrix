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

async function main() {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DA TABELA STREAMS\n');

    // 1. Testar conexão
    console.log('1. Testando conexão com banco...');
    await pool.query('SELECT 1');
    console.log('✅ Conexão OK\n');

    // 2. Verificar se tabela existe
    console.log('2. Verificando tabela streams...');
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'streams'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('❌ Criando tabela streams...\n');
      await pool.query(`
        CREATE TABLE streams (
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
      console.log('✅ Tabela criada\n');
    } else {
      console.log('✅ Tabela existe\n');
    }

    // 3. Verificar campos obrigatórios
    console.log('3. Verificando campos obrigatórios...');
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'streams'
    `);

    const existing = new Set(cols.rows.map(r => r.column_name));
    const required = ['url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index'];
    const missing = required.filter(field => !existing.has(field));

    if (missing.length > 0) {
      console.log('❌ Campos obrigatórios faltando:', missing.join(', '));
      return;
    }
    console.log('✅ Campos obrigatórios OK\n');

    // 4. Adicionar campos opcionais
    console.log('4. Verificando campos opcionais...');
    const optional = ['formato', 'frequencia', 'pais', 'facebook', 'instagram', 'twitter', 'youtube', 'site', 'monitoring_url', 'logo_url'];

    let added = 0;
    for (const field of optional) {
      if (!existing.has(field)) {
        await pool.query(`ALTER TABLE streams ADD COLUMN ${field} TEXT;`);
        console.log(`✅ Campo ${field} adicionado`);
        added++;
      }
    }

    if (added === 0) {
      console.log('✅ Todos os campos opcionais já existem');
    }
    console.log('');

    // 5. Teste de inserção
    console.log('5. Testando funcionalidade...');
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

    const insertQuery = `INSERT INTO streams (${insertCols.join(', ')}) VALUES (${params.join(', ')}) RETURNING id`;
    const insertResult = await pool.query(insertQuery, insertVals);

    console.log(`✅ Inserção OK (ID: ${insertResult.rows[0].id})`);

    // Limpar teste
    await pool.query('DELETE FROM streams WHERE name = $1', ['Rádio Teste']);
    console.log('🧹 Teste limpo\n');

    console.log('🎉 TABELA STREAMS ESTÁ PRONTA!');
    console.log('✅ O endpoint POST /api/streams deve funcionar agora');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

main();