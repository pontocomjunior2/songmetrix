import { scheduleConfig } from './schedule-config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logInfo, logError, logDebug } from '../server/logger.js';

const execAsync = promisify(exec);

// Função para verificar se deve executar o processamento
function shouldProcess() {
  const currentHour = new Date().getHours();
  return scheduleConfig.checkHours.includes(currentHour);
}

// Função para executar o processamento de emails
async function processEmails() {
  try {
    logInfo('Iniciando processamento de emails agendados...');
    await execAsync('node scripts/send-scheduled-emails.js');
    logInfo('Processamento de emails concluído com sucesso');
  } catch (error) {
    logError('Erro ao processar emails', error);
  }
}

// Função principal do agendador
async function main() {
  logInfo('Iniciando agendador de emails...');
  
  // Executar imediatamente se estiver no horário
  if (shouldProcess()) {
    await processEmails();
  }
  
  // Configurar intervalo de verificação
  setInterval(async () => {
    if (shouldProcess()) {
      await processEmails();
    }
  }, scheduleConfig.interval * 60 * 1000);
  
  logInfo('Agendador configurado', {
    interval: scheduleConfig.interval,
    checkHours: scheduleConfig.checkHours
  });
}

// Executar agendador
main().catch(error => {
  logError('Erro fatal no agendador', error);
  process.exit(1);
}); 