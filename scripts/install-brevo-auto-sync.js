/**
 * Script de instalação completa do sistema de sincronização automática com o Brevo
 * Este script executa:
 * 1. Criação da função exec_sql no banco de dados
 * 2. Instalação do trigger de sincronização automática para novos usuários TRIAL
 */
import { execSync } from 'child_process';
import path from 'path';

console.log('🔄 Iniciando instalação do sistema de sincronização automática com o Brevo');

try {
  // Passo 1: Tentativa com o método normal
  console.log('\n📦 Tentando método padrão...');
  
  try {
    // Passo 1.1: Criar a função exec_sql
    console.log('\n📦 Passo 1: Criando função exec_sql...');
    execSync('node scripts/create-exec-sql-function.js', { stdio: 'inherit' });
    
    // Passo 1.2: Instalar o trigger de sincronização automática
    console.log('\n📦 Passo 2: Instalando trigger de sincronização automática...');
    execSync('node scripts/apply-trigger-sql.js', { stdio: 'inherit' });
    
    console.log('\n✅ Instalação concluída com sucesso!');
  } catch (error) {
    // Se falhar, tentar o método direto
    console.log('\n⚠️ Método padrão falhou, tentando método alternativo direto...');
    console.log('\n📦 Aplicando SQL diretamente...');
    
    execSync('node scripts/direct-sql-setup.js', { stdio: 'inherit' });
    
    console.log('\n✅ Instalação concluída com sucesso usando método alternativo!');
  }
  
  console.log('\n✅ Agora novos usuários TRIAL serão automaticamente sincronizados com o Brevo.');
  
} catch (error) {
  console.error('\n❌ Erro durante a instalação:', error.message);
  console.log('\n⚠️ Tente executar o método alternativo manualmente:');
  console.log('npm run direct-sql-setup');
  process.exit(1);
} 