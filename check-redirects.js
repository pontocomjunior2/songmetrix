console.log('Verificando configurações de redirecionamento do Supabase...');
console.log('SUPABASE_REDIRECT_URL:', process.env.SUPABASE_REDIRECT_URL);
console.log('SITE_URL:', process.env.SITE_URL);
console.log('VITE_SITE_URL:', process.env.VITE_SITE_URL);
console.log('VITE_AGENT_REDIRECT_URL:', process.env.VITE_AGENT_REDIRECT_URL);

// Verificar se as variáveis estão configuradas corretamente
const redirectUrl = process.env.SUPABASE_REDIRECT_URL || process.env.SITE_URL || process.env.VITE_SITE_URL;
if (!redirectUrl) {
  console.error('ERRO: URL de redirecionamento não configurada!');
} else {
  console.log('URL de redirecionamento configurada:', redirectUrl);
  
  // Verificar se a URL termina com /login
  if (!redirectUrl.endsWith('/login')) {
    console.warn('AVISO: A URL de redirecionamento não termina com /login!');
  } else {
    console.log('✓ URL de redirecionamento configurada corretamente.');
  }
}

console.log('Verificação concluída.');
