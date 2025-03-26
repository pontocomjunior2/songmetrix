/**
 * Script para criar a função exec_sql no banco de dados Supabase
 * Esta função é necessária para permitir a execução direta de SQL
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

// Função principal para criar a função exec_sql
async function createExecSqlFunction() {
  try {
    console.log('📄 Criando função exec_sql no banco de dados...');
    
    // SQL para criar a função exec_sql
    const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result JSONB;
    BEGIN
      EXECUTE sql_query;
      result := '{"success": true}'::JSONB;
      RETURN result;
    EXCEPTION
      WHEN OTHERS THEN
        result := jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'detail', SQLSTATE
        );
        RETURN result;
    END;
    $$;
    
    -- Comentário na função
    COMMENT ON FUNCTION exec_sql(text) IS 'Executa SQL dinamicamente com tratamento de erros. Somente para administradores.';
    
    -- Revogar permissões de todos os roles
    REVOKE ALL ON FUNCTION exec_sql(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION exec_sql(text) FROM anon;
    REVOKE ALL ON FUNCTION exec_sql(text) FROM authenticated;
    
    -- Conceder permissão apenas para service_role
    GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
    `;
    
    // Executar o SQL diretamente via createClient - usando try/catch ao invés de .catch()
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: createFunctionSQL
      });
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Função exec_sql criada/atualizada com sucesso!');
    } catch (err) {
      // Se a função exec_sql ainda não existe, precisamos criá-la diretamente via SQL
      if (err.message && err.message.includes('function exec_sql(text) does not exist')) {
        console.log('⚠️ Função exec_sql não existe, criando diretamente...');
        try {
          // Tentar criar a função usando SQL direto
          const { error: sqlError } = await supabase.sql(createFunctionSQL);
          
          if (sqlError) {
            throw new Error(`Erro ao criar função via sql: ${sqlError.message}`);
          }
          
          console.log('✅ Função exec_sql criada com sucesso via SQL direto!');
        } catch (sqlErr) {
          console.error('❌ Erro ao criar função via SQL direto:', sqlErr);
          throw new Error(`Falha ao criar função exec_sql: ${sqlErr.message}`);
        }
      } else {
        throw err;
      }
    }
    
    // Verificar se a função foi criada
    try {
      const { data, error: testError } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT 'Teste de função exec_sql' AS teste;"
      });
      
      if (testError) {
        throw new Error(`Erro ao testar função exec_sql: ${testError.message}`);
      }
      
      console.log('✅ Teste da função exec_sql bem-sucedido!');
    } catch (testError) {
      console.warn('⚠️ Não foi possível testar a função, mas ela pode ter sido criada:', testError);
    }
  } catch (error) {
    console.error('❌ Erro durante a criação da função exec_sql:', error);
    process.exit(1);
  }
}

// Executar o script
createExecSqlFunction()
  .then(() => {
    console.log('⚡ Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal durante a execução do script:', error);
    process.exit(1);
  }); 