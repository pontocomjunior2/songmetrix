// Script para aplicar correções ao status TRIAL no Supabase
// Executa migrações SQL para garantir que 'TRIAL' seja um status válido em todas as políticas

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Obter o caminho absoluto da raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Configurar dotenv com path explícito para o arquivo .env na raiz
const envPath = resolve(rootDir, '.env');
console.log(`Tentando carregar variáveis de ambiente de: ${envPath}`);

try {
  // Verificar se o arquivo existe
  if (fs.existsSync(envPath)) {
    console.log(`Arquivo .env encontrado em: ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.log('Arquivo .env não encontrado na raiz do projeto');
    // Tentar carregar do .env.production como fallback
    const envProdPath = resolve(rootDir, '.env.production');
    if (fs.existsSync(envProdPath)) {
      console.log(`Arquivo .env.production encontrado, usando como fallback`);
      dotenv.config({ path: envProdPath });
    } else {
      console.log('Arquivo .env.production também não encontrado');
    }
  }

  // Carregar variáveis diretamente do processo se existirem
  console.log('Variáveis de ambiente carregadas:');
  console.log(`SUPABASE_URL definido: ${Boolean(process.env.SUPABASE_URL)}`);
  console.log(`SUPABASE_SERVICE_KEY definido: ${Boolean(process.env.SUPABASE_SERVICE_KEY)}`);
} catch (error) {
  console.error('Erro ao carregar variáveis de ambiente:', error);
}

// Variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY são necessárias');
  console.error('Por favor, verifique se o arquivo .env na raiz do projeto contém essas variáveis');
  console.error('Exemplo do conteúdo esperado no arquivo .env:');
  console.error('SUPABASE_URL=https://seu-projeto.supabase.co');
  console.error('SUPABASE_SERVICE_KEY=seu-service-key-aqui');
  process.exit(1);
}

// Criar cliente Supabase
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrations() {
  try {
    console.log('Iniciando aplicação das migrações...');
    
    // Carregar arquivos de migração
    const mainMigrationFile = resolve(rootDir, 'supabase/migrations/20250316000003_fix_trial_status_manual.sql');
    const fixNewErrorFile = resolve(rootDir, 'supabase/migrations/20250316000004_fix_new_reference_error.sql');
    
    if (!fs.existsSync(mainMigrationFile)) {
      throw new Error(`Arquivo de migração principal não encontrado: ${mainMigrationFile}`);
    }
    
    if (!fs.existsSync(fixNewErrorFile)) {
      console.warn(`Arquivo de correção NEW não encontrado: ${fixNewErrorFile}. Esta correção não será aplicada.`);
    }
    
    // Ler conteúdo dos arquivos
    const mainSqlContent = fs.readFileSync(mainMigrationFile, 'utf8');
    const fixNewSqlContent = fs.existsSync(fixNewErrorFile) 
      ? fs.readFileSync(fixNewErrorFile, 'utf8') 
      : null;
    
    // Executar migração principal
    console.log('\nAplicando migração principal...');
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: mainSqlContent });
      if (error) {
        console.error(`\nErro ao executar migração principal: ${error.message}`);
        
        if (error.message.includes('missing FROM-clause entry for table "new"') && fixNewSqlContent) {
          console.log('\nDetectado erro de referência a NEW. Tentando aplicar correção específica...');
          
          const { error: fixError } = await supabaseAdmin.rpc('exec_sql', { sql: fixNewSqlContent });
          if (fixError) {
            throw new Error(`Erro ao aplicar correção NEW: ${fixError.message}`);
          } else {
            console.log('Correção do erro NEW aplicada com sucesso!');
          }
        } else {
          throw new Error(`Erro ao executar migração principal: ${error.message}`);
        }
      } else {
        console.log('Migração principal aplicada com sucesso!');
      }
    } catch (sqlError) {
      if (sqlError.message.includes('missing FROM-clause entry for table "new"') && fixNewSqlContent) {
        console.log('\nDetectado erro de referência a NEW. Tentando aplicar correção específica...');
        
        const { error: fixError } = await supabaseAdmin.rpc('exec_sql', { sql: fixNewSqlContent });
        if (fixError) {
          throw new Error(`Erro ao aplicar correção NEW: ${fixError.message}`);
        } else {
          console.log('Correção do erro NEW aplicada com sucesso!');
        }
      } else {
        throw sqlError;
      }
    }
    
    // Atualizar usuários recentes
    console.log('\nAtualizando usuários recentes de INATIVO para TRIAL...');
    const { data: updatedUsers, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ status: 'TRIAL' })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'INATIVO')
      .select();
    
    if (updateError) {
      console.error(`Erro ao atualizar usuários: ${updateError.message}`);
    } else {
      console.log(`${updatedUsers?.length || 0} usuários atualizados de INATIVO para TRIAL`);
    }
    
    // Buscar usuários recentes para verificar
    console.log('\nVerificando usuários mais recentes...');
    const { data: recentUsers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('email, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (fetchError) {
      console.error(`Erro ao buscar usuários recentes: ${fetchError.message}`);
    } else if (recentUsers?.length) {
      console.log('Usuários mais recentes após migração:');
      recentUsers.forEach(user => {
        console.log(`- ${user.email}: ${user.status} (criado em ${new Date(user.created_at).toLocaleString()})`);
      });
    }
    
    console.log('\nMigração concluída com sucesso!');
  } catch (error) {
    console.error(`\nErro durante o processo de migração: ${error.message}`);
    process.exit(1);
  }
}

// Executar migrações
runMigrations(); 