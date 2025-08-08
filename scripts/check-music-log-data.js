#!/usr/bin/env node

/**
 * Script para verificar se há dados na tabela music_log
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Carregar variáveis de ambiente
dotenv.config();

async function checkMusicLogData() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    ssl: false
  });

  try {
    console.log('🔍 VERIFICANDO DADOS NA TABELA MUSIC_LOG\n');
    console.log('=====================================\n');

    // 1. Verificar se a tabela existe
    console.log('1️⃣ VERIFICANDO SE A TABELA EXISTE...');
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'music_log'
      );
    `;
    
    const tableResult = await pool.query(tableExistsQuery);
    const tableExists = tableResult.rows[0].exists;
    
    console.log(`   Tabela music_log existe: ${tableExists ? '✅ SIM' : '❌ NÃO'}\n`);
    
    if (!tableExists) {
      console.log('❌ A tabela music_log não existe!');
      return;
    }

    // 2. Contar total de registros
    console.log('2️⃣ CONTANDO REGISTROS TOTAIS...');
    const countQuery = 'SELECT COUNT(*) as total FROM music_log';
    const countResult = await pool.query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].total);
    
    console.log(`   Total de registros: ${totalRecords.toLocaleString()}\n`);

    if (totalRecords === 0) {
      console.log('⚠️  A tabela music_log está vazia!');
      return;
    }

    // 3. Verificar estrutura da tabela
    console.log('3️⃣ VERIFICANDO ESTRUTURA DA TABELA...');
    const structureQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'music_log' 
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await pool.query(structureQuery);
    console.log('   Colunas da tabela:');
    structureResult.rows.forEach(row => {
      console.log(`      ${row.column_name}: ${row.data_type}`);
    });
    console.log('');

    // 4. Verificar dados recentes
    console.log('4️⃣ VERIFICANDO DADOS RECENTES...');
    const recentQuery = `
      SELECT name, song_title, artist, date, time
      FROM music_log 
      ORDER BY date DESC, time DESC 
      LIMIT 10
    `;
    
    const recentResult = await pool.query(recentQuery);
    console.log('   Últimos 10 registros:');
    recentResult.rows.forEach((row, index) => {
      console.log(`      ${index + 1}. ${row.name} - ${row.song_title} (${row.artist}) - ${row.date} ${row.time}`);
    });
    console.log('');

    // 5. Verificar nomes únicos (rádios)
    console.log('5️⃣ VERIFICANDO RÁDIOS DISPONÍVEIS...');
    const radiosQuery = `
      SELECT name, COUNT(*) as total_plays
      FROM music_log 
      GROUP BY name 
      ORDER BY total_plays DESC 
      LIMIT 10
    `;
    
    const radiosResult = await pool.query(radiosQuery);
    console.log('   Top 10 rádios por execuções:');
    radiosResult.rows.forEach((row, index) => {
      console.log(`      ${index + 1}. ${row.name}: ${parseInt(row.total_plays).toLocaleString()} execuções`);
    });
    console.log('');

    // 6. Verificar se há correspondência com emails de usuários
    console.log('6️⃣ VERIFICANDO CORRESPONDÊNCIA COM USUÁRIOS...');
    
    // Buscar alguns emails de usuários do Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: users } = await supabase
      .from('users')
      .select('email')
      .limit(5);

    if (users && users.length > 0) {
      console.log('   Verificando se emails de usuários existem como nomes de rádio:');
      
      for (const user of users) {
        const userDataQuery = `
          SELECT COUNT(*) as plays
          FROM music_log 
          WHERE name = $1
        `;
        
        const userDataResult = await pool.query(userDataQuery, [user.email]);
        const plays = parseInt(userDataResult.rows[0].plays);
        
        console.log(`      ${user.email}: ${plays} execuções ${plays > 0 ? '✅' : '❌'}`);
      }
    }

    console.log('\n=====================================');
    console.log('🏁 VERIFICAÇÃO CONCLUÍDA!');
    console.log('=====================================');

  } catch (error) {
    console.error('💥 Erro na verificação:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Executar verificação
checkMusicLogData().then(() => {
  console.log('\n🎯 Verificação finalizada!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});