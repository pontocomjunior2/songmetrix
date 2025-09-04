#!/usr/bin/env node
/**
 * Script de monitoramento contínuo para a aplicação
 */

import { monitorLocks, showTableStats } from './monitor-db-locks.js';

console.log('🔍 Iniciando monitoramento contínuo...');
console.log('Pressione Ctrl+C para parar');

// Monitorar a cada 30 segundos
const interval = setInterval(async () => {
  console.log('\n' + '🔄'.repeat(20) + ' ATUALIZAÇÃO ' + new Date().toLocaleTimeString() + ' 🔄'.repeat(20));
  
  try {
    await monitorLocks();
    await showTableStats();
  } catch (error) {
    console.error('❌ Erro no monitoramento:', error);
  }
}, 30000);

// Permitir interrupção
process.on('SIGINT', () => {
  console.log('\n🛑 Interrompendo monitoramento...');
  clearInterval(interval);
  process.exit(0);
});
