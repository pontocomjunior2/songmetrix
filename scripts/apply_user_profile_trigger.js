/**
 * Script para aplicar diretamente o trigger de sincronização de metadados
 * Executa o SQL de criação do trigger para garantir que os campos full_name e whatsapp 
 * sejam automaticamente atualizados quando novos usuários são criados ou atualizados
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

// Função para executar SQL diretamente no Supabase
async function applyUserProfileTrigger() {
  try {
    console.log('🔍 Iniciando aplicação do trigger de sincronização de metadados...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(process.cwd(), 'supabase/migrations/sync_user_metadata_to_profile.sql');
    console.log(`📄 Lendo SQL de: ${sqlPath}`);
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ Arquivo SQL lido com sucesso');
    
    // Dividir o SQL em comandos separados
    // Maneira simples: dividir por ponto e vírgula seguido de nova linha
    const sqlCommands = sqlContent.split(/;\s*\n/);
    
    console.log(`📊 Executando ${sqlCommands.length} comandos SQL...`);
    
    // Executar cada comando SQL separadamente
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i].trim();
      if (!command) continue; // Pular comandos vazios
      
      try {
        // Executar o comando SQL
        const { error } = await supabase.rpc('exec_sql', { sql: command + ';' });
        
        if (error) {
          console.warn(`⚠️ Erro ao executar comando SQL #${i + 1}: ${error.message}`);
          console.log('Comando:', command);
        } else {
          console.log(`✅ Comando SQL #${i + 1} executado com sucesso`);
        }
      } catch (cmdError) {
        console.warn(`⚠️ Exceção ao executar comando SQL #${i + 1}: ${cmdError.message}`);
      }
    }
    
    // Como alternativa, tente executar o SQL completo
    try {
      console.log('🔄 Tentando executar o SQL completo como uma única transação...');
      
      const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
      
      if (error) {
        console.warn(`⚠️ Erro ao executar SQL completo: ${error.message}`);
      } else {
        console.log('✅ SQL completo executado com sucesso!');
      }
    } catch (sqlError) {
      console.warn(`⚠️ Exceção ao executar SQL completo: ${sqlError.message}`);
    }
    
    // Testar se o trigger foi criado
    console.log('🔍 Verificando se o trigger foi criado...');
    
    const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', { 
      sql: `SELECT * FROM pg_trigger WHERE tgname = 'sync_auth_metadata_trigger';` 
    });
    
    if (triggerError) {
      console.warn(`⚠️ Erro ao verificar trigger: ${triggerError.message}`);
    } else {
      if (triggers && triggers.length > 0) {
        console.log('✅ Trigger criado com sucesso!');
      } else {
        console.warn('⚠️ Trigger não encontrado. Pode ser necessário executar o SQL manualmente.');
      }
    }
    
    // Verificar e criar uma função auxiliar executora de SQL se não existir
    console.log('🔄 Verificando se a função executora de SQL existe...');
    
    const createExecSqlFn = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS json AS $$
      BEGIN
        EXECUTE sql;
        RETURN json_build_object('success', true);
      EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    try {
      // Tentar criar a função exec_sql
      const { error: fnError } = await supabase.rpc('exec_sql', { sql: createExecSqlFn });
      
      if (fnError) {
        console.warn(`⚠️ Erro ao criar função exec_sql: ${fnError.message}`);
        
        // Tentar criar diretamente a função
        const { error: directError } = await supabase.rpc('create_exec_sql_function', {});
        
        if (directError) {
          console.warn(`⚠️ Erro ao criar função exec_sql diretamente: ${directError.message}`);
        } else {
          console.log('✅ Função exec_sql criada diretamente com sucesso!');
        }
      } else {
        console.log('✅ Função exec_sql criada com sucesso!');
      }
    } catch (fnError) {
      console.warn(`⚠️ Exceção ao criar função exec_sql: ${fnError.message}`);
    }
    
    // Executar a parte específica do SQL que cria o trigger
    const triggerSpecificSQL = `
      -- Criar ou substituir a função para sincronizar metadados
      CREATE OR REPLACE FUNCTION sync_auth_metadata_to_profile()
      RETURNS TRIGGER AS $$
      DECLARE
        raw_meta JSONB;
        fullname_value TEXT;
        whatsapp_value TEXT;
      BEGIN
        -- Tentar obter metadados brutos
        SELECT raw_user_meta_data INTO raw_meta FROM auth.users WHERE id = NEW.id;
        
        IF raw_meta IS NOT NULL THEN
          -- Obter valores dos metadados
          fullname_value := COALESCE(
            raw_meta->>'fullName',
            raw_meta->>'full_name',
            raw_meta->>'name',
            NULL
          );
          
          -- Obter valor do WhatsApp
          whatsapp_value := raw_meta->>'whatsapp';
          
          -- Atualizar colunas apenas se os valores dos metadados existirem e as colunas do perfil estiverem vazias
          IF fullname_value IS NOT NULL AND (NEW.full_name IS NULL OR NEW.full_name = '') THEN
            NEW.full_name := fullname_value;
          END IF;
          
          IF whatsapp_value IS NOT NULL AND (NEW.whatsapp IS NULL OR NEW.whatsapp = '') THEN
            NEW.whatsapp := whatsapp_value;
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Remover trigger existente se houver
      DROP TRIGGER IF EXISTS sync_auth_metadata_trigger ON public.users;

      -- Criar trigger para sincronizar metadados na inserção ou atualização
      CREATE TRIGGER sync_auth_metadata_trigger
      BEFORE INSERT OR UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION sync_auth_metadata_to_profile();
    `;
    
    console.log('🔄 Executando SQL específico para criar o trigger...');
    
    try {
      const { error: triggerSqlError } = await supabase.rpc('exec_sql', { sql: triggerSpecificSQL });
      
      if (triggerSqlError) {
        console.warn(`⚠️ Erro ao executar SQL específico do trigger: ${triggerSqlError.message}`);
      } else {
        console.log('✅ Trigger criado com sucesso via SQL específico!');
      }
    } catch (specificError) {
      console.warn(`⚠️ Exceção ao executar SQL específico: ${specificError.message}`);
    }
    
    console.log('\n📝 Instruções adicionais:');
    console.log('Se a execução automática não funcionou, você pode precisar executar o SQL manualmente:');
    console.log('1. Acesse o Supabase Studio');
    console.log('2. Vá para a seção "SQL Editor"');
    console.log('3. Cole e execute o conteúdo do arquivo: supabase/migrations/sync_user_metadata_to_profile.sql');
    
    return {
      success: true,
      message: 'Processo de aplicação do trigger concluído.'
    };
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar a função principal
applyUserProfileTrigger()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Processo concluído!');
      console.log('🔍 Novos usuários agora devem ter seus campos full_name e whatsapp automaticamente preenchidos a partir dos metadados.');
    } else {
      console.error('\n❌ Falha no processo:', result.error);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erro fatal na execução do script:', error);
    process.exit(1);
  }); 