import { scheduleConfig } from './schedule-config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Criar diretório de logs se não existir
const logDir = path.dirname(scheduleConfig.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Função para registrar log
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Registrar no console
  console.log(message);
  
  // Registrar no arquivo
  fs.appendFileSync(scheduleConfig.logging.file, logMessage);
}

// Função para verificar se deve executar o processamento
function shouldProcess() {
  const currentHour = new Date().getHours();
  return scheduleConfig.checkHours.includes(currentHour);
}

// Função para executar o processamento de emails
async function processEmails() {
  try {
    log('Iniciando processamento de emails agendados...');
    await execAsync('node scripts/send-scheduled-emails.js');
    log('Processamento de emails concluído com sucesso');
  } catch (error) {
    log(`Erro ao processar emails: ${error.message}`);
  }
}

// Função principal do agendador
async function main() {
  log('Iniciando agendador de emails...');
  
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
  
  log(`Agendador configurado para verificar a cada ${scheduleConfig.interval} minutos`);
  log(`Horários de verificação: ${scheduleConfig.checkHours.join(', ')}`);
}

// Executar agendador
main().catch(error => {
  log(`Erro fatal no agendador: ${error.message}`);
  process.exit(1);
}); 