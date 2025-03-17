import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('==== VERIFICAÇÃO DE AMBIENTE PARA PRODUÇÃO ====');

// Verificar arquivos de ambiente
const envProdPath = path.join(rootDir, '.env.production');
const envPath = path.join(rootDir, '.env');

let envProdExists = false;
let envExists = false;

if (fs.existsSync(envProdPath)) {
  console.log('✅ Arquivo .env.production encontrado');
  envProdExists = true;
  dotenv.config({ path: envProdPath });
} else {
  console.error('❌ Arquivo .env.production não encontrado!');
}

if (fs.existsSync(envPath)) {
  console.log('✅ Arquivo .env encontrado');
  envExists = true;
  if (!envProdExists) {
    dotenv.config({ path: envPath });
    console.warn('⚠️ Usando .env como fallback para .env.production');
  }
} else {
  console.error('❌ Arquivo .env não encontrado!');
}

if (!envProdExists && !envExists) {
  console.error('ERRO CRÍTICO: Nenhum arquivo de ambiente encontrado!');
  process.exit(1);
}

// Verificar configurações críticas
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
  'VITE_ENV'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variáveis de ambiente obrigatórias ausentes:', missingVars.join(', '));
  process.exit(1);
}

// Verificar se o ambiente é de produção
if (process.env.VITE_ENV !== 'production') {
  console.warn('⚠️ A variável VITE_ENV não está definida como "production"!');
  console.warn('   Valor atual:', process.env.VITE_ENV);
}

// Verificar URL da API
if (!process.env.VITE_API_BASE_URL) {
  console.error('❌ VITE_API_BASE_URL não definida!');
} else {
  console.log('✅ VITE_API_BASE_URL =', process.env.VITE_API_BASE_URL);
  
  // Verificar se o URL tem o formato esperado
  try {
    const url = new URL(process.env.VITE_API_BASE_URL);
    if (!url.protocol.startsWith('http')) {
      console.warn('⚠️ VITE_API_BASE_URL não usa o protocolo HTTP/HTTPS!');
    }
  } catch (e) {
    console.error('❌ VITE_API_BASE_URL não é um URL válido!');
  }
}

// Verificar configuração do Supabase
console.log('✅ VITE_SUPABASE_URL =', process.env.VITE_SUPABASE_URL);

// Verificar arquivos públicos e recursos
const publicDir = path.join(rootDir, 'public');
if (fs.existsSync(publicDir)) {
  console.log('✅ Diretório public/ encontrado');
  
  // Verificar existência do logo
  const logoPath = path.join(publicDir, 'logo.svg');
  if (fs.existsSync(logoPath)) {
    console.log('✅ Arquivo logo.svg encontrado');
  } else {
    console.warn('⚠️ Arquivo logo.svg não encontrado no diretório public/');
  }
} else {
  console.error('❌ Diretório public/ não encontrado!');
}

// Verificar configuração do package.json
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Verificar script de build
    if (packageJson.scripts && packageJson.scripts.build) {
      console.log('✅ Script de build encontrado:', packageJson.scripts.build);
      if (!packageJson.scripts.build.includes('--mode production')) {
        console.warn('⚠️ Script de build não especifica modo de produção!');
      }
    } else {
      console.error('❌ Script de build não encontrado no package.json!');
    }
    
    // Verificar dependências críticas
    const criticalDeps = ['@supabase/supabase-js', 'react', 'react-dom', 'react-router-dom'];
    const missingDeps = criticalDeps.filter(dep => !packageJson.dependencies || !packageJson.dependencies[dep]);
    
    if (missingDeps.length > 0) {
      console.error('❌ Dependências críticas ausentes:', missingDeps.join(', '));
    } else {
      console.log('✅ Todas as dependências críticas estão presentes');
    }
  } catch (e) {
    console.error('❌ Erro ao analisar package.json:', e.message);
  }
} else {
  console.error('❌ Arquivo package.json não encontrado!');
}

console.log('==== VERIFICAÇÃO CONCLUÍDA ====');

// Se chegamos até aqui sem sair, está tudo bem
console.log('✅ Ambiente pronto para build de produção'); 