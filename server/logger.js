import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Criar diretório de logs se não existir
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuração dos formatos
const formats = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Configuração dos transportes
const transports = [
  // Log de erros
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: formats
  }),
  // Log geral
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: formats
  }),
  // Log específico de emails
  new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'email-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: formats
  })
];

// Adicionar console em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: formats,
  transports,
  // Não finalizar em caso de erro não tratado
  exitOnError: false
});

// Funções auxiliares para logs específicos
export const logEmail = (message, meta = {}) => {
  logger.info(message, { ...meta, service: 'email' });
};

export const logError = (message, error = null, meta = {}) => {
  if (error) {
    logger.error(message, {
      ...meta,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });
  } else {
    logger.error(message, meta);
  }
};

export const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

export const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

export const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

export default logger; 