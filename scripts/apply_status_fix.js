// Script para aplicar as migrações SQL que corrigem problemas de status de usuário
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
const envPaths = [
  path.join(process.cwd(), '.env.production'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log('Carregando variáveis de ambiente de:', envPath);
    dotenv.config({ path: envPath });
    break;
  }
}

// Verificar variáveis de ambiente necessárias
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Variáveis de ambiente necessárias estão faltando: VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Ler e executar as migrações
const runMigrations = async () => {
  try {
    // Caminho para as migrações
    const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');
    
    // Lista de arquivos de migração a serem executados
    const migrationFiles = [
      '20250316000001_update_policy_to_include_trial.sql',
      '20250316000002_fix_all_user_status_issues.sql'
    ];

    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationsPath, fileName);
      
      if (!fs.existsSync(filePath)) {
        console.error(`Arquivo de migração não encontrado: ${filePath}`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Executando migração: ${fileName}`);
      
      // Executar o SQL
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`Erro ao executar migração ${fileName}:`, error);
      } else {
        console.log(`Migração ${fileName} executada com sucesso`);
      }
    }

    // Atualizar todos os usuários existentes criados nos últimos 7 dias para TRIAL
    const { error: updateError } = await supabase.rpc('exec_sql', { 
      sql: `
        UPDATE users
        SET 
          status = 'TRIAL',
          updated_at = CURRENT_TIMESTAMP
        WHERE 
          created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
          AND status = 'INATIVO';
      `
    });

    if (updateError) {
      console.error('Erro ao atualizar status de usuários existentes:', updateError);
    } else {
      console.log('Status de usuários existentes atualizado com sucesso');
    }

    // Verificar e mostrar usuários atualizados
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (usersError) {
      console.error('Erro ao buscar usuários após migração:', usersError);
    } else {
      console.log('Usuários mais recentes após migração:');
      console.table(users);
    }

    console.log('Processo de migração concluído');
  } catch (error) {
    console.error('Erro durante a execução das migrações:', error);
  }
};

// Executar migrações
runMigrations(); 