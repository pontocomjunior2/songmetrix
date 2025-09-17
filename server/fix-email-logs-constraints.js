// Script para corrigir restrições de chave estrangeira nas tabelas relacionadas a email
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Obter diretório atual (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentar carregar variáveis de ambiente de múltiplos locais
const envPaths = [
  path.join(path.dirname(__dirname), '.env'),
  path.join(__dirname, '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  console.log(`Tentando carregar variáveis de ambiente de: ${envPath}`);
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Variáveis de ambiente carregadas de: ${envPath}`);
      envLoaded = true;
      break;
    } else {
      console.log(`Erro ao carregar variáveis de ambiente de ${envPath}:`, result.error);
    }
  } else {
    console.log(`Arquivo não encontrado: ${envPath}`);
  }
}

if (!envLoaded) {
  console.log('Tentando carregar variáveis de ambiente sem caminho específico');
  dotenv.config();
}

// Verificar variáveis críticas
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

console.log('Variáveis de ambiente carregadas:');
console.log('- SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTANDO');
console.log('- SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'OK' : 'FALTANDO');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Variáveis de ambiente do Supabase não configuradas');
  console.error('Por favor, verifique se o arquivo .env existe e contém as variáveis necessárias.');
  process.exit(1);
}

// Carregar o arquivo SQL
const sqlFilePath = path.join(__dirname, 'apply_email_logs_cascade.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`Erro: Arquivo SQL não encontrado: ${sqlFilePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlFilePath, 'utf8');
console.log('Arquivo SQL carregado com sucesso:', sqlFilePath);

// Configurar cliente Supabase com role de serviço
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyFixes() {
  console.log('Iniciando correção das restrições de chave estrangeira...');

  try {
    // Executar o SQL diretamente - sem função rpc
    console.log('Executando SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Erro ao executar SQL via RPC:', error);
      console.log('Tentando executar SQL via query direta...');
      
      // Tentar executar como consulta direta
      await supabase.from('_sql').select('*').limit(1);
      
      console.error('Não foi possível executar o SQL. Por favor, execute manualmente no SQL Editor do Supabase:');
      console.log('\n====== SQL A SER EXECUTADO ======');
      console.log(sql);
      console.log('==================================\n');
      process.exit(1);
    }

    console.log('Correções aplicadas com sucesso!');
    console.log('Agora as tabelas relacionadas a email terão exclusão em cascata quando um usuário for removido.');
    
    // Consultar se as restrições foram aplicadas corretamente
    const { data: checkData, error: checkError } = await supabase.rpc('exec_sql', { 
      sql: `
        SELECT 
          tc.table_name, 
          kcu.column_name,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
      `
    });

    if (checkError) {
      console.error('Erro ao verificar restrições:', checkError);
    } else {
      console.log('\nRestrições atualizadas:');
      console.table(checkData);
    }
  } catch (err) {
    console.error('Erro inesperado:', err);
    process.exit(1);
  }
}

// Executar o script
applyFixes();