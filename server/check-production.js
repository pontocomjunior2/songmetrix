// Script para verificar se o ambiente está pronto para produção
import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tentar carregar .env.production se existir
const envProdPath = join(dirname(__dirname), '.env.production');
const envPath = join(dirname(__dirname), '.env');

if (fs.existsSync(envProdPath)) {
  console.log('Carregando variáveis de ambiente de produção de:', envProdPath);
  dotenv.config({ path: envProdPath });
} else {
  console.log('Arquivo .env.production não encontrado, usando .env:', envPath);
  dotenv.config({ path: envPath });
}

const { Pool } = pg;

// Tabelas necessárias para o funcionamento do sistema
const requiredTables = [
  'users',
  'music_log',
  'streams',
  'radios',
  'user_favorites',
  'subscriptions',
  'payments'
];

// Verificar a conexão com o banco de dados
async function checkDatabase() {
  console.log('\n=== VERIFICAÇÃO DO BANCO DE DADOS ===');
  
  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
  });

  try {
    // Testar conexão
    console.log('Testando conexão com o banco de dados...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');

    // Verificar tabelas
    console.log('\nVerificando tabelas...');
    const { rows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);

    const existingTables = rows.map(row => row.table_name);
    console.log('Tabelas encontradas:', existingTables.join(', '));

    // Verificar se todas as tabelas necessárias existem
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.error('❌ Tabelas ausentes:', missingTables.join(', '));
    } else {
      console.log('✅ Todas as tabelas necessárias existem.');
    }

    // Verificar índices na tabela music_log
    console.log('\nVerificando índices na tabela music_log...');
    const indexesResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'music_log';
    `);

    if (indexesResult.rows.length > 0) {
      console.log('Índices encontrados:');
      indexesResult.rows.forEach(row => {
        console.log(`- ${row.indexname}: ${row.indexdef}`);
      });
    } else {
      console.warn('⚠️ Nenhum índice encontrado na tabela music_log. Recomenda-se criar índices para melhorar o desempenho.');
    }

    // Verificar permissões
    console.log('\nVerificando permissões do usuário...');
    const permissionsResult = await pool.query(`
      SELECT grantee, privilege_type, table_name
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
      AND grantee = $1;
    `, [process.env.POSTGRES_USER]);

    console.log(`Permissões para o usuário ${process.env.POSTGRES_USER}:`);
    if (permissionsResult.rows.length > 0) {
      permissionsResult.rows.forEach(row => {
        console.log(`- ${row.privilege_type} em ${row.table_name}`);
      });
    } else {
      console.error('❌ Nenhuma permissão encontrada para o usuário. Isso pode causar problemas de acesso.');
    }

    // Verificar configurações de Supabase
    console.log('\nVerificando configurações do Supabase...');
    if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
      console.log('✅ Variáveis de ambiente do Supabase estão definidas.');
    } else {
      console.error('❌ Variáveis de ambiente do Supabase ausentes ou incompletas.');
    }

    // Verificar configurações da API
    console.log('\nVerificando configurações da API...');
    if (process.env.VITE_API_BASE_URL) {
      console.log(`✅ URL base da API definida: ${process.env.VITE_API_BASE_URL}`);
    } else {
      console.error('❌ URL base da API não definida.');
    }

    console.log('\n=== RESUMO DA VERIFICAÇÃO ===');
    console.log('Banco de dados: ✅');
    console.log(`Tabelas: ${missingTables.length > 0 ? '❌' : '✅'}`);
    console.log(`Permissões: ${permissionsResult.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`Supabase: ${(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) ? '✅' : '❌'}`);
    console.log(`API: ${process.env.VITE_API_BASE_URL ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar o banco de dados:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar a verificação
checkDatabase().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
}); 