/**
 * Script para aplicar SQL diretamente sem depender da função exec_sql
 * Esta é uma abordagem alternativa para criar o trigger de sincronização com o Brevo
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Pool } = pg;

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase para operações de autenticação
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validar configurações
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

// Criar cliente Supabase com chave de serviço
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Caminho para o arquivo SQL
const sqlFilePath = path.join(process.cwd(), 'supabase', 'migrations', 'auto_sync_trial_users.sql');

// Dividir o SQL em blocos executáveis
function splitSqlIntoBlocks(sqlContent) {
  // Identificamos os blocos DO $$ ... $$ e os tratamos como unidades atômicas
  const blocks = [];
  let currentBlock = '';
  let insideDoBlock = false;
  let blockStartCount = 0;
  
  // Dividir o SQL em linhas
  const lines = sqlContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Verificar se estamos entrando em um bloco DO
    if (trimmedLine.startsWith('DO $$')) {
      insideDoBlock = true;
      blockStartCount = 1; // Contamos o número de $$ para lidar com $$ aninhados
      currentBlock = line + '\n';
    } 
    // Se estamos dentro de um bloco DO
    else if (insideDoBlock) {
      currentBlock += line + '\n';
      
      // Contar $$ para garantir que só sairemos quando todos forem fechados
      if (trimmedLine.includes('$$')) {
        const matches = trimmedLine.match(/\$\$/g) || [];
        blockStartCount += matches.length;
        
        // Se o número de $$ for par, podemos ter saído do bloco
        if (blockStartCount % 2 === 0) {
          // Verificar se este é o fim do bloco DO
          if (blockStartCount === 2 || trimmedLine === '$$;') {
            insideDoBlock = false;
            blocks.push(currentBlock.trim());
            currentBlock = '';
          }
        }
      }
    } 
    // Se não estamos em um bloco DO e temos conteúdo significativo
    else if (trimmedLine && !trimmedLine.startsWith('--')) {
      // Verificar se é uma instrução completa
      if (trimmedLine.endsWith(';')) {
        // Se já temos algo no bloco atual, adicione a linha e salve o bloco
        if (currentBlock) {
          currentBlock += line;
          blocks.push(currentBlock.trim());
          currentBlock = '';
        } 
        // Caso contrário, a linha é uma instrução completa por si só
        else {
          blocks.push(line.trim());
        }
      } 
      // Se não termina com ponto e vírgula, faz parte de uma instrução mais longa
      else {
        currentBlock += line + '\n';
      }
    } 
    // Preservar comentários e linhas vazias dentro de blocos
    else if (insideDoBlock) {
      currentBlock += line + '\n';
    }
  }
  
  // Se ainda tivermos conteúdo no bloco atual, adicioná-lo também
  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }
  
  return blocks.filter(block => block.trim() !== '');
}

// Função para executar os comandos SQL no Supabase diretamente
async function executeSupabaseSQL(sql) {
  try {
    // Configurar conexão PostgreSQL direta
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'postgres',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.NODE_ENV === 'production'
    });
    
    // Executar a consulta e retornar resultados
    const result = await pool.query(sql);
    
    // Fechar pool após uso
    await pool.end();
    
    return { data: result.rows, success: true };
  } catch (error) {
    console.error('Erro ao executar SQL:', error);
    throw error;
  }
}

// Função principal
async function applyDirectSQL() {
  try {
    console.log('🔑 Conectando ao Supabase:', supabaseUrl);
    
    console.log('📄 Lendo arquivo SQL:', sqlFilePath);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFilePath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('📝 Conteúdo SQL lido, dividindo em blocos executáveis...');
    
    // Dividir o SQL em blocos executáveis
    const sqlBlocks = splitSqlIntoBlocks(sqlContent);
    console.log(`🧩 SQL dividido em ${sqlBlocks.length} blocos`);
    
    // Executar cada bloco separadamente
    for (let i = 0; i < sqlBlocks.length; i++) {
      const block = sqlBlocks[i];
      console.log(`\n📦 Executando bloco SQL ${i + 1}/${sqlBlocks.length}...`);
      
      try {
        const result = await executeSupabaseSQL(block);
        console.log(`✅ Bloco ${i + 1} executado com sucesso`);
      } catch (blockError) {
        console.error(`❌ Erro no bloco ${i + 1}:`, blockError.message);
        console.log('⚠️ Conteúdo do bloco com erro:');
        console.log(block);
        console.log('\n⚠️ Continuando com o próximo bloco...');
      }
    }
    
    console.log('\n🔍 Verificando se o trigger foi criado...');
    
    // Verificar se o trigger foi criado
    try {
      const { data, error } = await executeSupabaseSQL(
        "SELECT tgname, pg_get_triggerdef(t.oid) FROM pg_trigger t WHERE tgname = 'trigger_sync_new_trial_user_to_brevo';"
      );
      
      if (error) {
        console.warn('⚠️ Erro ao verificar trigger:', error.message);
      } else if (data && data.length > 0) {
        console.log('📋 Verificação do trigger:');
        console.log(data);
        console.log('✅ Trigger instalado e funcionando corretamente!');
      } else {
        console.warn('⚠️ Trigger não encontrado na verificação');
      }
    } catch (verifyError) {
      console.warn('⚠️ Não foi possível verificar o trigger:', verifyError.message);
    }
    
    console.log('\n✅ Processo de aplicação SQL concluído!');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar SQL diretamente:', error.message);
    
    // Fornecer instruções para execução manual se necessário
    console.log('\n⚠️ Você pode precisar executar o SQL manualmente no console do Supabase:');
    console.log('1. Acesse https://supabase.com/dashboard');
    console.log('2. Selecione seu projeto');
    console.log('3. Acesse "SQL Editor"');
    console.log('4. Cole o conteúdo do arquivo auto_sync_trial_users.sql');
    console.log('5. Execute-o\n');
    
    throw error;
  }
}

// Executar o script
applyDirectSQL()
  .then(() => {
    console.log('⚡ Script finalizado com sucesso.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal durante a execução do script:', error);
    process.exit(1);
  }); 