#!/usr/bin/env node
/**
 * Verificação rápida de saúde da aplicação
 */

import { checkPoolHealth } from '../server/db-optimized.js';

console.log('🏥 VERIFICAÇÃO RÁPIDA DE SAÚDE');
console.log('=' .repeat(50));

try {
  const health = checkPoolHealth();
  console.log('📊 Saúde do Pool de Conexões:');
  console.log(`   Total: ${health.total}`);
  console.log(`   Idle: ${health.idle}`);
  console.log(`   Waiting: ${health.waiting}`);
  console.log(`   Saudável: ${health.healthy ? '✅ Sim' : '❌ Não'}`);
  
  if (!health.healthy) {
    console.log('\n⚠️  PROBLEMAS DETECTADOS:');
    if (health.total === 0) console.log('   • Pool de conexões vazio');
    if (health.idle < 2) console.log('   • Poucas conexões disponíveis');
    if (health.waiting > 0) console.log('   • Conexões aguardando');
  } else {
    console.log('\n✅ Sistema funcionando normalmente');
  }
} catch (error) {
  console.error('❌ Erro ao verificar saúde:', error.message);
}
