// Configurações de sessão centralizadas
export const SESSION_CONFIG = {
  // Tempo de inatividade antes de expirar a sessão (2 horas)
  INACTIVITY_TIMEOUT: 2 * 60 * 60 * 1000,
  
  // Intervalo para verificar expiração (5 minutos)
  CHECK_INTERVAL: 5 * 60 * 1000,
  
  // Throttle para atualizações de atividade (30 segundos)
  ACTIVITY_THROTTLE: 30 * 1000,
  
  // Tempo antes do vencimento para fazer refresh do token (15 minutos)
  TOKEN_REFRESH_THRESHOLD: 15 * 60 * 1000,
  
  // Chave para armazenar última atividade
  LAST_ACTIVITY_KEY: 'songmetrix_last_activity',
} as const;

// Função utilitária para verificar se estamos em desenvolvimento
export const isDevelopment = () => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
};

// Função para log de debug apenas em desenvolvimento
export const debugLog = (message: string, ...args: unknown[]) => {
  if (isDevelopment()) {
    console.log(`[Session Debug] ${message}`, ...args);
  }
};