#!/usr/bin/env node

/**
 * Script para implantar correções na sincronização com o Brevo
 * 
 * Este script aplica as alterações necessárias para:
 * 1. Adicionar suporte a eventos DELETE no trigger que sincroniza com o Brevo
 * 2. Atualizar a função Edge para lidar com exclusões de usuários
 * 
 * Execute com: node scripts/deploy-brevo-fixes.js
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

// Obter o diretório atual para o módulo ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Função auxiliar para log colorido
const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}${colors.bright}${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`),
};

// Função para executar comandos de shell
function executeCommand(command, silent = false) {
  try {
    if (!silent) log.info(`Executando: ${command}`);
    const output = execSync(command, { stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output: output.toString() };
  } catch (error) {
    if (!silent) log.error(`Erro ao executar comando: ${command}`);
    return { 
      success: false, 
      error, 
      output: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : ''
    };
  }
}

// Verifica se o projeto Supabase está linkado corretamente
function checkSupabaseProject() {
  try {
    // Verificar se existe o arquivo .supabase/config.json (criado pelo link)
    const configPath = path.join(process.cwd(), '.supabase', 'config.json');
    
    if (!fs.existsSync(configPath)) {
      log.warning('Arquivo de configuração .supabase/config.json não encontrado.');
      return false;
    }
    
    // Verificar se podemos listar as funções (teste de conectividade)
    const { success, output, stderr } = executeCommand('supabase functions list', true);
    
    if (!success) {
      log.warning('Não foi possível listar as funções do Supabase:');
      log.warning(stderr || 'Erro desconhecido');
      return false;
    }
    
    // Se chegou aqui, o projeto está provavelmente configurado corretamente
    return true;
  } catch (error) {
    log.error(`Erro ao verificar configuração do Supabase: ${error.message}`);
    return false;
  }
}

// Função principal
async function main() {
  log.title('🚀 Iniciando implantação das correções de sincronização com Brevo');
  
  // Verificar se o Supabase CLI está instalado
  const { success: cliCheck, stderr: cliError } = executeCommand('supabase --version', true);
  if (!cliCheck) {
    log.error('Supabase CLI não está instalado ou não está no PATH:');
    log.error(cliError || 'Erro ao executar supabase --version');
    log.info('Instale o Supabase CLI seguindo as instruções em: https://supabase.com/docs/guides/cli');
    process.exit(1);
  }
  
  // Verificar se o projeto está configurado
  log.info('Verificando configuração do projeto Supabase...');
  if (!checkSupabaseProject()) {
    log.error('O projeto Supabase não está configurado corretamente.');
    log.info('Execute: supabase login');
    log.info('E depois: supabase link --project-ref aylxcqaddelwxfukerhr');
    process.exit(1);
  }
  
  log.success('✅ Projeto Supabase configurado corretamente!');
  
  // Resolver o caminho do arquivo de migração relativo ao diretório do projeto
  const projectRoot = path.resolve(process.cwd());
  
  // Etapa 1: Implantar o script SQL que adiciona suporte a DELETE no trigger
  log.title('📦 Etapa 1: Implantando script SQL para adicionar suporte a DELETE');
  const sqlMigrationPath = path.join(projectRoot, 'supabase', 'migrations', 'add_delete_to_brevo_webhook.sql');
  
  log.info(`Verificando se o script existe: ${sqlMigrationPath}`);
  if (!fs.existsSync(sqlMigrationPath)) {
    log.error(`O arquivo de migração não foi encontrado: ${sqlMigrationPath}`);
    process.exit(1);
  }
  
  log.info('Implantando o script SQL no banco de dados...');
  const { success: migrationSuccess, stderr: migrationError } = executeCommand(`supabase db push --db-only "${sqlMigrationPath}"`, false);
  
  if (!migrationSuccess) {
    log.error('Falha ao implantar o script SQL:');
    log.error(migrationError || 'Erro desconhecido');
    process.exit(1);
  }
  
  log.success('✅ Script SQL implantado com sucesso!');
  
  // Etapa 2: Implantar a função Edge atualizada
  log.title('📦 Etapa 2: Implantando função Edge atualizada');
  log.info('Implantando a função Edge user-webhook...');
  
  const { success: functionSuccess, stderr: functionError } = executeCommand('supabase functions deploy user-webhook', false);
  
  if (!functionSuccess) {
    log.error('Falha ao implantar a função Edge:');
    log.error(functionError || 'Erro desconhecido');
    process.exit(1);
  }
  
  log.success('✅ Função Edge implantada com sucesso!');
  
  // Verificar se tudo foi implantado corretamente
  log.title('🔍 Verificando implantação');
  executeCommand('supabase functions list');
  
  log.title('✨ Implantação concluída com sucesso!');
  log.info('\nPara testar a nova funcionalidade:');
  log.info('1. Faça login no painel de administração do Supabase');
  log.info('2. Vá para a tabela "users"');
  log.info('3. Altere o status de um usuário ou exclua um usuário');
  log.info('4. Verifique se as alterações são refletidas corretamente no Brevo');
  
  log.title('📝 Logs');
  log.info('Para verificar os logs da função Edge, execute:');
  log.info('supabase functions logs user-webhook --tail');
}

// Executar o script
main().catch(error => {
  log.error(`Erro não tratado: ${error.message}`);
  process.exit(1);
}); 