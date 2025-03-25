// Configuração do agendador de tarefas
export const scheduleConfig = {
  // Intervalo entre execuções (em minutos)
  interval: 60,
  
  // Horários específicos para verificar emails pendentes
  checkHours: [
    0,  // Meia-noite
    6,  // 6h da manhã
    12, // Meio-dia
    18  // 6h da tarde
  ],
  
  // Configurações de retry
  retry: {
    maxAttempts: 3,
    delayMinutes: 30
  },
  
  // Configurações de log
  logging: {
    level: 'info',
    file: 'logs/scheduled-emails.log'
  }
}; 