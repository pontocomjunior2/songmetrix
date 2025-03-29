// Importar módulos necessários
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname } from 'path';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env.production
const envProductionPath = path.resolve(__dirname, '.env.production');
if (fs.existsSync(envProductionPath)) {
  console.log('Carregando configurações de:', envProductionPath);
  const productionConfig = dotenv.config({ path: envProductionPath });
  if (productionConfig.error) {
    console.error('Erro ao carregar .env.production:', productionConfig.error);
  }
} else {
  console.error('Arquivo .env.production não encontrado!');
}

// Verificar configurações críticas
console.log('\nVERIFICAÇÃO DE CONFIGURAÇÕES DE REDIRECIONAMENTO:\n');
console.log('SUPABASE_REDIRECT_URL:', process.env.SUPABASE_REDIRECT_URL || 'NÃO DEFINIDO');
console.log('SITE_URL:', process.env.SITE_URL || 'NÃO DEFINIDO');
console.log('VITE_SITE_URL:', process.env.VITE_SITE_URL || 'NÃO DEFINIDO');
console.log('VITE_AGENT_REDIRECT_URL:', process.env.VITE_AGENT_REDIRECT_URL || 'NÃO DEFINIDO');

// Verificar se as variáveis estão configuradas corretamente
const redirectUrl = process.env.SUPABASE_REDIRECT_URL || process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.VITE_AGENT_REDIRECT_URL;
if (!redirectUrl) {
  console.error('\n❌ ERRO: URL de redirecionamento não configurada!');
} else {
  console.log('\nURL de redirecionamento configurada:', redirectUrl);
  
  // Verificar se a URL termina com /login
  if (!redirectUrl.endsWith('/login')) {
    console.warn('⚠️ AVISO: A URL de redirecionamento não termina com /login!');
  } else {
    console.log('✅ URL de redirecionamento configurada corretamente para terminar com /login.');
  }
}

// Outras verificações importantes
console.log('\nVERIFICAÇÃO DE CONFIGURAÇÕES DO SUPABASE:\n');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'DEFINIDO' : 'NÃO DEFINIDO');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDO' : 'NÃO DEFINIDO');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'DEFINIDO' : 'NÃO DEFINIDO');

console.log('\nVerificação concluída.'); 