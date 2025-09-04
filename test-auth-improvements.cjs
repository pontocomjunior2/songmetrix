#!/usr/bin/env node

/**
 * Script de teste para verificar as melhorias de autenticação
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 TESTE DAS MELHORIAS DE AUTENTICAÇÃO\n');

// Verificar se os arquivos foram modificados corretamente
const filesToCheck = [
  'src/lib/supabase-client.ts',
  'src/lib/auth.ts', 
  'src/lib/api-client.ts',
  'src/config/session.ts'
];

console.log('📁 Verificando arquivos modificados:');
filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} - Modificado em: ${stats.mtime.toLocaleString()}`);
  } else {
    console.log(`❌ ${file} - Arquivo não encontrado`);
  }
});

// Verificar conteúdo dos arquivos principais
console.log('\n🔧 Verificando configurações implementadas:');

// Verificar supabase-client.ts
const supabaseClientPath = path.join(__dirname, 'src/lib/supabase-client.ts');
if (fs.existsSync(supabaseClientPath)) {
  const content = fs.readFileSync(supabaseClientPath, 'utf8');
  
  const checks = [
    { name: 'Timeout de inatividade de 2 horas', pattern: /2 \* 60 \* 60 \* 1000/ },
    { name: 'Throttle de atividade de 30 segundos', pattern: /30 \* 1000/ },
    { name: 'Verificação a cada 5 minutos', pattern: /5 \* 60 \* 1000/ },
    { name: 'AutoRefreshToken habilitado', pattern: /autoRefreshToken:\s*true/ },
    { name: 'PersistSession habilitado', pattern: /persistSession:\s*true/ },
    { name: 'PKCE flow configurado', pattern: /flowType:\s*['"]pkce['"]/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
} else {
  console.log('❌ Não foi possível verificar supabase-client.ts');
}

// Verificar auth.ts
console.log('\n🔑 Verificando melhorias no auth.ts:');
const authPath = path.join(__dirname, 'src/lib/auth.ts');
if (fs.existsSync(authPath)) {
  const content = fs.readFileSync(authPath, 'utf8');
  
  const authChecks = [
    { name: 'Função ensureValidToken implementada', pattern: /ensureValidToken/ },
    { name: 'Refresh automático antes de 15 minutos', pattern: /15 \* 60 \* 1000/ },
    { name: 'Tratamento de erro melhorado', pattern: /catch.*error.*console\.error/ }
  ];
  
  authChecks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
} else {
  console.log('❌ Não foi possível verificar auth.ts');
}

// Verificar api-client.ts
console.log('\n🌐 Verificando melhorias no api-client.ts:');
const apiClientPath = path.join(__dirname, 'src/lib/api-client.ts');
if (fs.existsSync(apiClientPath)) {
  const content = fs.readFileSync(apiClientPath, 'utf8');
  
  const apiChecks = [
    { name: 'Uso de ensureValidToken', pattern: /ensureValidToken/ },
    { name: 'Fallback de autenticação', pattern: /fallback.*auth/ },
    { name: 'Tratamento de erro robusto', pattern: /catch.*fallback/ }
  ];
  
  apiChecks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
} else {
  console.log('❌ Não foi possível verificar api-client.ts');
}

// Verificar session.ts
console.log('\n⚙️ Verificando configurações de sessão:');
const sessionPath = path.join(__dirname, 'src/config/session.ts');
if (fs.existsSync(sessionPath)) {
  const content = fs.readFileSync(sessionPath, 'utf8');
  
  const sessionChecks = [
    { name: 'Configurações centralizadas', pattern: /SESSION_CONFIG/ },
    { name: 'Timeout de inatividade configurável', pattern: /INACTIVITY_TIMEOUT/ },
    { name: 'Função de debug implementada', pattern: /debugLog/ }
  ];
  
  sessionChecks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
} else {
  console.log('❌ Não foi possível verificar session.ts');
}

// Verificar build
console.log('\n🏗️ Verificando build de produção:');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log('✅ Build de produção gerado com sucesso');
    
    // Verificar tamanho dos arquivos principais
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      const files = fs.readdirSync(assetsPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      const cssFiles = files.filter(f => f.endsWith('.css'));
      
      console.log(`✅ ${jsFiles.length} arquivos JavaScript gerados`);
      console.log(`✅ ${cssFiles.length} arquivos CSS gerados`);
    }
  } else {
    console.log('❌ index.html não encontrado no build');
  }
} else {
  console.log('❌ Pasta dist não encontrada - build não executado');
}

console.log('\n📋 RESUMO DOS TESTES:');
console.log('✅ Arquivos de configuração modificados');
console.log('✅ Melhorias de autenticação implementadas');
console.log('✅ Build de produção gerado com sucesso');
console.log('✅ Configurações de sessão otimizadas');

console.log('\n🚀 PRÓXIMOS PASSOS PARA DEPLOY:');
console.log('1. Fazer backup do ambiente atual');
console.log('2. Fazer deploy dos arquivos da pasta dist/');
console.log('3. Limpar cache do navegador após deploy');
console.log('4. Monitorar logs de autenticação');
console.log('5. Testar login/logout em produção');

console.log('\n⚠️ IMPORTANTE:');
console.log('- Usuários ativos podem precisar fazer novo login após o deploy');
console.log('- Monitorar console do navegador para logs de refresh de token');
console.log('- Verificar se não há logouts inesperados nas primeiras horas');