// Script para diagnóstico e correção da tabela streams
// Execute no terminal do servidor: node fix-streams-terminal.js

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: '104.234.173.96',
  database: 'music_log',
  password: 'Conquista@@2',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('🔍 Verificando tabela streams...');

    // Verificar se tabela existe
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'streams'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('❌ Tabela streams NÃO existe. Criando...');

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

      console.log('✅ Tabela criada');
    } else {
      console.log('✅ Tabela streams existe');
    }

    // Verificar campos obrigatórios
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'streams'
    `);

    const existing = new Set(cols.rows.map(r => r.column_name));
    const required = ['url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index'];

    const missing = required.filter(field => !existing.has(field));

    if (missing.length > 0) {
      console.log('❌ Campos obrigatórios faltando:', missing.join(', '));
    } else {
      console.log('✅ Campos obrigatórios OK');
    }

    // Adicionar campos opcionais
    const optional = ['formato', 'frequencia', 'pais', 'facebook', 'instagram', 'twitter', 'youtube', 'site', 'monitoring_url', 'logo_url'];

    for (const field of optional) {
      if (!existing.has(field)) {
        await pool.query(`ALTER TABLE streams ADD COLUMN ${field} TEXT;`);
        console.log(`✅ Campo ${field} adicionado`);
      }
    }

    console.log('🎉 Tabela streams está pronta!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

main();