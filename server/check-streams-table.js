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

async function checkStreamsTable() {
  try {
    console.log('🔍 Verificando tabela streams...\n');

    // Verificar se a tabela existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'streams'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela streams NÃO existe!');
      console.log('📋 Execute: node server/create-streams-table.js');
      return;
    }

    console.log('✅ Tabela streams existe');

    // Verificar colunas da tabela
    console.log('\n📊 Verificando colunas da tabela streams...');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'streams'
      ORDER BY ordinal_position;
    `);

    console.log('Colunas encontradas:');
    columnsResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  - ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
    });

    // Verificar campos obrigatórios
    const requiredFields = ['url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index'];
    const existingColumns = columnsResult.rows.map(col => col.column_name);
    const missingRequired = requiredFields.filter(field => !existingColumns.includes(field));

    if (missingRequired.length > 0) {
      console.log('\n❌ Campos obrigatórios faltando:');
      missingRequired.forEach(field => console.log(`  - ${field}`));
    } else {
      console.log('\n✅ Todos os campos obrigatórios estão presentes');
    }

    // Verificar campos opcionais
    const optionalFields = ['formato', 'frequencia', 'pais', 'facebook', 'instagram', 'twitter', 'youtube', 'site', 'monitoring_url', 'logo_url'];
    const missingOptional = optionalFields.filter(field => !existingColumns.includes(field));

    if (missingOptional.length > 0) {
      console.log('\n⚠️ Campos opcionais faltando:');
      missingOptional.forEach(field => console.log(`  - ${field}`));
      console.log('💡 Execute: node server/add-streams-fields.js');
    } else {
      console.log('\n✅ Todos os campos opcionais estão presentes');
    }

    // Verificar índices
    console.log('\n🔍 Verificando índices...');
    const indexesResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'streams';
    `);

    if (indexesResult.rows.length === 0) {
      console.log('❌ Nenhum índice encontrado');
    } else {
      console.log('Índices encontrados:');
      indexesResult.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
    }

    // Verificar triggers
    console.log('\n🔍 Verificando triggers...');
    const triggersResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'streams';
    `);

    if (triggersResult.rows.length === 0) {
      console.log('❌ Nenhum trigger encontrado');
    } else {
      console.log('Triggers encontrados:');
      triggersResult.rows.forEach(trg => {
        console.log(`  - ${trg.trigger_name} (${trg.event_manipulation})`);
      });
    }

    // Teste de inserção simples
    console.log('\n🧪 Testando inserção de exemplo...');
    try {
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

      // Verificar quais campos existem antes de tentar inserir
      const existingCols = new Set(existingColumns);
      const insertCols = [];
      const insertVals = [];
      const params = [];

      Object.entries(testData).forEach(([key, value]) => {
        if (existingCols.has(key)) {
          insertCols.push(key);
          params.push(`$${insertCols.length}`);
          insertVals.push(value);
        }
      });

      if (insertCols.length === 0) {
        console.log('❌ Nenhum campo válido para inserção');
      } else {
        const insertQuery = `INSERT INTO streams (${insertCols.join(', ')}) VALUES (${params.join(', ')}) RETURNING id`;
        const insertResult = await pool.query(insertQuery, insertVals);
        console.log(`✅ Inserção de teste bem-sucedida! ID: ${insertResult.rows[0].id}`);

        // Limpar o registro de teste
        await pool.query('DELETE FROM streams WHERE name = $1', ['Rádio Teste']);
        console.log('🧹 Registro de teste removido');
      }

    } catch (insertError) {
      console.log('❌ Erro na inserção de teste:', insertError.message);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar tabela streams:', error);
  } finally {
    await pool.end();
  }
}

checkStreamsTable();