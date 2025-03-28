// start-servers.js
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import net from 'net';

// Obter o diretório atual em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

// Cores para as mensagens no console
const colors = {
  main: '\x1b[36m%s\x1b[0m', // Ciano
  email: '\x1b[35m%s\x1b[0m', // Magenta
  error: '\x1b[31m%s\x1b[0m', // Vermelho
  success: '\x1b[32m%s\x1b[0m', // Verde
  warning: '\x1b[33m%s\x1b[0m', // Amarelo
  info: '\x1b[34m%s\x1b[0m', // Azul
  reset: '\x1b[0m'
};

// Função para exibir mensagens formatadas
function log(prefix, message, color) {
  console.log(color, `[${prefix}] ${message}`);
}

// Função para verificar se uma porta está em uso
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        // A porta está em uso
        resolve(true);
      })
      .once('listening', () => {
        // A porta está livre, fechar o servidor de teste
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

// Função para encontrar uma porta livre
async function findAvailablePort(startPort, maxAttempts = 10) {
  let port = startPort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
    port++;
    attempts++;
  }

  // Se todas as tentativas falharem, retornar null
  log('ERRO', `Não foi possível encontrar uma porta livre após ${maxAttempts} tentativas`, colors.error);
  return null;
}

// Verificar variáveis de ambiente críticas
function checkEnvironment() {
  log('INFO', 'Verificando variáveis de ambiente...', colors.info);
  
  const requiredVars = [
    'POSTGRES_USER',
    'POSTGRES_HOST',
    'POSTGRES_DB',
    'POSTGRES_PORT',
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SENDPULSE_CLIENT_ID',
    'SENDPULSE_CLIENT_SECRET'
  ];
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    log('ERRO', `Variáveis de ambiente necessárias não encontradas: ${missingVars.join(', ')}`, colors.error);
    log('DICA', 'Verifique se o arquivo .env está configurado corretamente', colors.warning);
    return false;
  }
  
  log('INFO', 'Todas as variáveis de ambiente necessárias estão configuradas', colors.success);
  return true;
}

// Verificar se os arquivos do servidor existem
const serverPath = path.join(__dirname, 'server', 'server.js');
const emailServerPath = path.join(__dirname, 'server-email.js');

if (!fs.existsSync(serverPath)) {
  log('ERRO', `Arquivo do servidor principal não encontrado: ${serverPath}`, colors.error);
  process.exit(1);
}

if (!fs.existsSync(emailServerPath)) {
  log('ERRO', `Arquivo do servidor de email não encontrado: ${emailServerPath}`, colors.error);
  process.exit(1);
}

// Verificar ambiente antes de iniciar os serviços
if (!checkEnvironment()) {
  log('AVISO', 'Iniciando servidores mesmo com configuração incompleta...', colors.warning);
  log('AVISO', 'Alguns recursos podem não funcionar corretamente', colors.warning);
}

// Função para iniciar um servidor
function startServer(serverName, command, args, color) {
  log('INFO', `Iniciando servidor ${serverName}...`, colors.info);
  
  const server = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env }
  });

  server.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        log(serverName, line, color);
      }
    });
  });

  server.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        log(`${serverName} ERRO`, line, colors.error);
      }
    });
  });

  server.on('close', (code) => {
    if (code !== 0) {
      log('ERRO', `Servidor ${serverName} encerrou com código ${code}`, colors.error);
      process.exit(code);
    }
  });

  return server;
}

// Iniciar o processo principal
async function start() {
  log('INFO', '🚀 Iniciando ambiente de desenvolvimento Songmetrix...', colors.success);

  // Verificar portas padrão e encontrar alternativas se necessário
  const defaultServerPort = 3001;
  const defaultEmailServerPort = 3003;

  // Verificar porta do servidor principal
  const serverPortInUse = await isPortInUse(defaultServerPort);
  let serverPort;
  if (serverPortInUse) {
    log('AVISO', `Porta padrão do servidor principal (${defaultServerPort}) já está em uso`, colors.warning);
    const alternativePort = await findAvailablePort(defaultServerPort + 1);
    if (alternativePort) {
      log('INFO', `Usando porta alternativa ${alternativePort} para o servidor principal`, colors.info);
      serverPort = alternativePort;
    } else {
      log('ERRO', 'Não foi possível encontrar uma porta livre para o servidor principal', colors.error);
      process.exit(1);
    }
  } else {
    serverPort = defaultServerPort;
  }
  process.env.SERVER_PORT = serverPort.toString();

  // Verificar porta do servidor de email (garantir que seja diferente do servidor principal)
  let emailPort;
  // Usar uma porta inicial diferente da porta do servidor principal
  const emailStartPort = (serverPort === defaultEmailServerPort) ? defaultEmailServerPort + 1 : defaultEmailServerPort;
  const emailPortInUse = await isPortInUse(emailStartPort);
  
  if (emailPortInUse) {
    log('AVISO', `Porta padrão do servidor de email (${emailStartPort}) já está em uso`, colors.warning);
    // Buscar uma porta disponível que não seja a mesma do servidor principal
    const alternativePort = await findAvailablePort(emailStartPort + 1);
    if (alternativePort && alternativePort !== serverPort) {
      log('INFO', `Usando porta alternativa ${alternativePort} para o servidor de email`, colors.info);
      emailPort = alternativePort;
    } else {
      // Se a porta for a mesma do servidor principal, buscar outra
      const nextPort = await findAvailablePort(alternativePort + 1);
      if (nextPort) {
        log('INFO', `Usando porta alternativa ${nextPort} para o servidor de email`, colors.info);
        emailPort = nextPort;
      } else {
        log('ERRO', 'Não foi possível encontrar uma porta livre para o servidor de email', colors.error);
        process.exit(1);
      }
    }
  } else {
    emailPort = emailStartPort;
  }
  process.env.EMAIL_SERVER_PORT = emailPort.toString();

  // Iniciar servidor principal com a porta configurada
  const mainServer = startServer(
    'SERVIDOR', 
    'node', 
    [serverPath],
    colors.main
  );

  // Aguardar 2 segundos antes de iniciar o servidor de email
  setTimeout(() => {
    // Iniciar servidor de email com a porta configurada
    const emailServer = startServer(
      'EMAIL', 
      'node', 
      [emailServerPath],
      colors.email
    );
    
    log('INFO', '✅ Ambos os servidores estão em execução', colors.success);
    log('INFO', `🔌 Servidor principal na porta: ${process.env.SERVER_PORT}`, colors.success);
    log('INFO', `📧 Servidor de email na porta: ${process.env.EMAIL_SERVER_PORT}`, colors.success);
    log('INFO', '⚠️ Pressione Ctrl+C para encerrar os servidores', colors.warning);
    
    // Gerenciar encerramento dos servidores
    process.on('SIGINT', () => {
      log('INFO', '🛑 Encerrando servidores...', colors.warning);
      
      mainServer.kill('SIGINT');
      emailServer.kill('SIGINT');
      
      setTimeout(() => {
        log('INFO', '👋 Servidores encerrados', colors.info);
        process.exit(0);
      }, 1000);
    });
  }, 2000);
}

// Executar o processo principal
start(); 