/**
 * Script para aplicar SQL para sincronizar automaticamente usuários TRIAL com o Brevo
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

console.log('🔑 Conectando ao Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Caminho para o arquivo SQL
const sqlFilePath = path.join(process.cwd(), 'supabase', 'migrations', 'auto_sync_trial_users.sql');

// Função principal para aplicar o SQL
async function applyTriggerSQL() {
  try {
    console.log('📄 Lendo arquivo SQL:', sqlFilePath);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFilePath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('📝 Conteúdo SQL lido, executando no banco de dados...');
    
    // Executar o SQL usando try/catch
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: sqlContent
      });
      
      if (error) {
        throw new Error(`Erro ao executar SQL: ${error.message}`);
      }
      
      console.log('✅ SQL executado com sucesso!');
      console.log('✅ Trigger de sincronização automática de usuários TRIAL instalado!');
    } catch (execError) {
      // Tentar método alternativo se a função exec_sql não existir
      if (execError.message && execError.message.includes('function exec_sql(text) does not exist')) {
        console.log('⚠️ Função exec_sql não encontrada, tente executar primeiro:');
        console.log('npm run create-exec-sql');
        throw new Error('A função exec_sql precisa ser instalada primeiro. Execute: npm run create-exec-sql');
      } else {
        throw execError;
      }
    }
    
    // Verificar se o trigger foi criado
    try {
      const { data: triggerData, error: triggerError } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT tgname, pg_get_triggerdef(t.oid) FROM pg_trigger t WHERE tgname = 'trigger_sync_new_trial_user_to_brevo';"
      });
      
      if (triggerError) {
        console.warn('⚠️ Erro ao verificar criação do trigger:', triggerError.message);
      } else {
        console.log('📋 Verificação do trigger:');
        console.log(triggerData);
      }
    } catch (verifyError) {
      console.warn('⚠️ Não foi possível verificar o trigger, mas ele pode ter sido criado:', verifyError.message);
    }
  } catch (error) {
    console.error('❌ Erro durante a aplicação do SQL:', error);
    process.exit(1);
  }
}

// Executar o script
applyTriggerSQL()
  .then(() => {
    console.log('⚡ Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal durante a execução do script:', error);
    process.exit(1);
  }); 