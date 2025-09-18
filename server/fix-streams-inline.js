import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração manual do banco (ajuste se necessário)
const dbConfig = {
  user: 'postgres',
  host: '104.234.173.96',
  database: 'music_log',
  password: 'Conquista@@2',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
};

const { Pool } = pg;
const pool = new Pool(dbConfig);

async function diagnoseAndFixStreams() {
  try {
    console.log('🔍 DIAGNÓSTICO DA TABELA STREAMS\n');

    // 1. Verificar se tabela existe
    console.log('1. Verificando se tabela streams existe...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'streams'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela streams NÃO existe!');
      console.log('📋 Criando tabela streams...\n');

      // Criar tabela
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
      console.log('✅ Tabela streams criada');

      // Criar índices
      await pool.query(`CREATE INDEX idx_streams_name ON streams(name);`);
      await pool.query(`CREATE INDEX idx_streams_cidade ON streams(cidade);`);
      await pool.query(`CREATE INDEX idx_streams_estado ON streams(estado);`);
      await pool.query(`CREATE INDEX idx_streams_regiao ON streams(regiao);`);
      console.log('✅ Índices criados');

      // Criar trigger
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
        CREATE TRIGGER update_streams_modtime
        BEFORE UPDATE ON streams
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
      `);
      console.log('✅ Trigger criado\n');

    } else {
      console.log('✅ Tabela streams existe');
    }

    // 2. Verificar colunas obrigatórias
    console.log('2. Verificando campos obrigatórios...');
    const requiredFields = ['url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index'];
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'streams';
    `);

    const existingColumns = new Set(columnsResult.rows.map(r => r.column_name));
    const missingRequired = requiredFields.filter(field => !existingColumns.has(field));

    if (missingRequired.length > 0) {
      console.log('❌ Campos obrigatórios faltando:', missingRequired.join(', '));
      return;
    }
    console.log('✅ Todos os campos obrigatórios estão presentes');

    // 3. Adicionar campos opcionais se não existirem
    console.log('\n3. Verificando campos opcionais...');
    const optionalFields = [
      { name: 'formato', type: 'TEXT' },
      { name: 'frequencia', type: 'VARCHAR(50)' },
      { name: 'pais', type: 'VARCHAR(100)', default: "'Brasil'" },
      { name: 'facebook', type: 'TEXT' },
      { name: 'instagram', type: 'TEXT' },
      { name: 'twitter', type: 'TEXT' },
      { name: 'youtube', type: 'TEXT' },
      { name: 'site', type: 'TEXT' },
      { name: 'monitoring_url', type: 'TEXT' },
      { name: 'logo_url', type: 'TEXT' }
    ];

    let addedFields = 0;
    for (const field of optionalFields) {
      if (!existingColumns.has(field.name)) {
        const defaultClause = field.default ? ` DEFAULT ${field.default}` : '';
        await pool.query(`ALTER TABLE streams ADD COLUMN ${field.name} ${field.type}${defaultClause};`);
        console.log(`✅ Campo ${field.name} adicionado`);
        addedFields++;
      }
    }

    if (addedFields === 0) {
      console.log('✅ Todos os campos opcionais já existem');
    }

    // 4. Teste de inserção
    console.log('\n4. Testando inserção...');
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

      const insertCols = Object.keys(testData);
      const insertVals = Object.values(testData);
      const params = insertCols.map((_, i) => `$${i + 1}`);

      const insertQuery = `INSERT INTO streams (${insertCols.join(', ')}) VALUES (${params.join(', ')}) RETURNING id`;
      const result = await pool.query(insertQuery, insertVals);

      console.log(`✅ Inserção de teste bem-sucedida! ID: ${result.rows[0].id}`);

      // Limpar teste
      await pool.query('DELETE FROM streams WHERE name = $1', ['Rádio Teste']);
      console.log('🧹 Registro de teste removido');

    } catch (insertError) {
      console.log('❌ Erro na inserção de teste:', insertError.message);
      return;
    }

    console.log('\n🎉 TABELA STREAMS ESTÁ PRONTA!');
    console.log('✅ O endpoint POST /api/streams deve funcionar agora');
    console.log('✅ Você pode adicionar/editar/remover streams normalmente');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n🔧 Verifique:');
    console.log('- Conectividade com o banco de dados');
    console.log('- Credenciais do banco');
    console.log('- Permissões do usuário PostgreSQL');
  } finally {
    await pool.end();
  }
}

diagnoseAndFixStreams();