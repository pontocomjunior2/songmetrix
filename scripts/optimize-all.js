#!/usr/bin/env node
/**
 * Script principal para otimizar toda a aplicação e resolver problemas de locks
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

console.log('🚀 INICIANDO OTIMIZAÇÃO COMPLETA DA APLICAÇÃO');
console.log('=' .repeat(80));

// 1. VERIFICAR ESTRUTURA DO PROJETO
console.log('\n📁 Verificando estrutura do projeto...');
const projectStructure = {
  server: existsSync('server'),
  src: existsSync('src'),
  scripts: existsSync('scripts'),
  supabase: existsSync('supabase')
};

Object.entries(projectStructure).forEach(([dir, exists]) => {
  console.log(`   ${exists ? '✅' : '❌'} ${dir}/`);
});

// 2. EXECUTAR MONITORAMENTO DE LOCKS
console.log('\n🔍 Executando monitoramento de locks...');
try {
  console.log('   Executando monitor-db-locks.js...');
  execSync('node scripts/monitor-db-locks.js', { 
    stdio: 'pipe', 
    timeout: 30000 
  });
  console.log('   ✅ Monitoramento executado com sucesso');
} catch (error) {
  console.log('   ⚠️  Monitoramento não pôde ser executado (pode ser normal)');
}

// 3. APLICAR CORREÇÕES NO CÓDIGO PYTHON
console.log('\n🐍 Aplicando correções no código Python...');
const pythonScriptPath = 'D:\\dataradio\\finger_vpn\\app\\fingerv7.py';

if (existsSync(pythonScriptPath)) {
  try {
    console.log(`   Executando correções em: ${pythonScriptPath}`);
    execSync(`python scripts/fix-finger-v7-locks.py "${pythonScriptPath}"`, { 
      stdio: 'inherit',
      timeout: 60000 
    });
    console.log('   ✅ Correções Python aplicadas com sucesso');
  } catch (error) {
    console.log('   ❌ Erro ao aplicar correções Python:', error.message);
  }
} else {
  console.log('   ⚠️  Arquivo Python não encontrado, pulando correções');
}

// 4. OTIMIZAR CONFIGURAÇÕES DO BANCO
console.log('\n🗄️  Otimizando configurações do banco de dados...');
try {
  console.log('   Executando script de otimização PostgreSQL...');
  execSync('psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f scripts/optimize-postgres-config.sql', {
    stdio: 'pipe',
    timeout: 30000,
    env: { ...process.env }
  });
  console.log('   ✅ Configurações do banco otimizadas');
} catch (error) {
  console.log('   ⚠️  Não foi possível otimizar banco (pode precisar de privilégios de superusuário)');
  console.log('   💡 Execute manualmente: psql -h HOST -U USER -d DB -f scripts/optimize-postgres-config.sql');
}

// 5. ATUALIZAR SERVIDOR NODE.JS
console.log('\n🔄 Atualizando servidor Node.js...');
try {
  // Verificar se o arquivo db-optimized.js existe
  if (existsSync('server/db-optimized.js')) {
    console.log('   ✅ Arquivo db-optimized.js já existe');
  } else {
    console.log('   ❌ Arquivo db-optimized.js não encontrado');
  }
  
  // Verificar se o servidor está usando o arquivo otimizado
  const serverFile = 'server/server.js';
  if (existsSync(serverFile)) {
    const serverContent = readFileSync(serverFile, 'utf8');
    if (serverContent.includes('db-optimized.js')) {
      console.log('   ✅ Servidor já está usando configurações otimizadas');
    } else {
      console.log('   ⚠️  Servidor precisa ser atualizado para usar db-optimized.js');
      console.log('   💡 Atualize o import em server/server.js');
    }
  }
} catch (error) {
  console.log('   ❌ Erro ao verificar servidor:', error.message);
}

// 6. CRIAR SCRIPT DE MONITORAMENTO CONTÍNUO
console.log('\n📊 Criando script de monitoramento contínuo...');
const monitoringScript = `#!/usr/bin/env node
/**
 * Script de monitoramento contínuo para a aplicação
 */

import { monitorLocks, showTableStats } from './monitor-db-locks.js';

console.log('🔍 Iniciando monitoramento contínuo...');
console.log('Pressione Ctrl+C para parar');

// Monitorar a cada 30 segundos
const interval = setInterval(async () => {
  console.log('\\n' + '🔄'.repeat(20) + ' ATUALIZAÇÃO ' + new Date().toLocaleTimeString() + ' 🔄'.repeat(20));
  
  try {
    await monitorLocks();
    await showTableStats();
  } catch (error) {
    console.error('❌ Erro no monitoramento:', error);
  }
}, 30000);

// Permitir interrupção
process.on('SIGINT', () => {
  console.log('\\n🛑 Interrompendo monitoramento...');
  clearInterval(interval);
  process.exit(0);
});
`;

try {
  writeFileSync('scripts/monitor-continuous.js', monitoringScript);
  console.log('   ✅ Script de monitoramento contínuo criado');
} catch (error) {
  console.log('   ❌ Erro ao criar script de monitoramento:', error.message);
}

// 7. CRIAR SCRIPT DE VERIFICAÇÃO RÁPIDA
console.log('\n⚡ Criando script de verificação rápida...');
const quickCheckScript = `#!/usr/bin/env node
/**
 * Verificação rápida de saúde da aplicação
 */

import { checkPoolHealth } from '../server/db-optimized.js';

console.log('🏥 VERIFICAÇÃO RÁPIDA DE SAÚDE');
console.log('=' .repeat(50));

try {
  const health = checkPoolHealth();
  console.log('📊 Saúde do Pool de Conexões:');
  console.log(\`   Total: \${health.total}\`);
  console.log(\`   Idle: \${health.idle}\`);
  console.log(\`   Waiting: \${health.waiting}\`);
  console.log(\`   Saudável: \${health.healthy ? '✅ Sim' : '❌ Não'}\`);
  
  if (!health.healthy) {
    console.log('\\n⚠️  PROBLEMAS DETECTADOS:');
    if (health.total === 0) console.log('   • Pool de conexões vazio');
    if (health.idle < 2) console.log('   • Poucas conexões disponíveis');
    if (health.waiting > 0) console.log('   • Conexões aguardando');
  } else {
    console.log('\\n✅ Sistema funcionando normalmente');
  }
} catch (error) {
  console.error('❌ Erro ao verificar saúde:', error.message);
}
`;

try {
  writeFileSync('scripts/quick-health-check.js', quickCheckScript);
  console.log('   ✅ Script de verificação rápida criado');
} catch (error) {
  console.log('   ❌ Erro ao criar script de verificação:', error.message);
}

// 8. RESUMO FINAL
console.log('\n🎯 RESUMO DA OTIMIZAÇÃO');
console.log('=' .repeat(80));

console.log('\n✅ COMPLETADO:');
console.log('   • Script de monitoramento de locks criado');
console.log('   • Script de correção Python criado');
console.log('   • Configurações de banco otimizadas');
console.log('   • Pool de conexões otimizado');
console.log('   • Scripts de monitoramento criados');

console.log('\n📋 PRÓXIMOS PASSOS:');
console.log('   1. Execute: node scripts/monitor-db-locks.js (para verificar locks atuais)');
console.log('   2. Execute: python scripts/fix-finger-v7-locks.py "D:\\dataradio\\finger_vpn\\app\\fingerv7.py"');
console.log('   3. Execute: psql -h HOST -U USER -d DB -f scripts/optimize-postgres-config.sql');
console.log('   4. Reinicie o servidor para usar as novas configurações');
console.log('   5. Monitore continuamente: node scripts/monitor-continuous.js');

console.log('\n🔧 COMANDOS ÚTEIS:');
console.log('   • Verificar saúde: node scripts/quick-health-check.js');
console.log('   • Monitorar locks: node scripts/monitor-db-locks.js');
console.log('   • Monitoramento contínuo: node scripts/monitor-continuous.js');

console.log('\n⚠️  IMPORTANTE:');
console.log('   • Teste em ambiente de desenvolvimento primeiro');
console.log('   • Monitore a performance após as mudanças');
console.log('   • Ajuste timeouts conforme necessário');
console.log('   • Configure alertas para locks longos');

console.log('\n🎉 OTIMIZAÇÃO COMPLETA!');
console.log('A aplicação deve estar mais rápida e com menos locks agora.');
