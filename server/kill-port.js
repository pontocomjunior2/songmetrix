// Script para liberar a porta 3001 que pode estar em uso
const { exec } = require('child_process');

// Porta para liberar
const PORT = 3001;

console.log(`Tentando liberar a porta ${PORT}...`);

// No Windows, usamos netstat para encontrar o PID e taskkill para matá-lo
if (process.platform === 'win32') {
  // Primeiro, encontrar o PID
  exec(`netstat -ano | findstr :${PORT}`, (error, stdout, stderr) => {
    if (error) {
      console.log(`Nenhum processo encontrado usando a porta ${PORT}`);
      return;
    }

    // Extrair o PID
    const lines = stdout.trim().split('\n');
    if (lines.length === 0) {
      console.log(`Nenhum processo encontrado usando a porta ${PORT}`);
      return;
    }

    for (const line of lines) {
      // Formato da saída do netstat: protocolo ip:porta estado pid
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      
      const pid = parts[parts.length - 1];
      console.log(`Encontrado processo ${pid} usando a porta ${PORT}`);
      
      // Matar o processo
      exec(`taskkill /F /PID ${pid}`, (killError, killStdout, killStderr) => {
        if (killError) {
          console.error(`Erro ao matar processo ${pid}:`, killError);
          return;
        }
        console.log(`Processo ${pid} encerrado com sucesso!`);
      });
    }
  });
} else {
  // Para sistemas baseados em Unix
  exec(`lsof -i :${PORT} | grep LISTEN`, (error, stdout, stderr) => {
    if (error || !stdout) {
      console.log(`Nenhum processo encontrado usando a porta ${PORT}`);
      return;
    }

    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      
      const pid = parts[1];
      console.log(`Encontrado processo ${pid} usando a porta ${PORT}`);
      
      exec(`kill -9 ${pid}`, (killError) => {
        if (killError) {
          console.error(`Erro ao matar processo ${pid}:`, killError);
          return;
        }
        console.log(`Processo ${pid} encerrado com sucesso!`);
      });
    }
  });
}

// Verificação adicional para processos Node.js que possam estar usando a porta
if (process.platform === 'win32') {
  exec('tasklist | findstr node.exe', (error, stdout, stderr) => {
    if (error || !stdout) {
      return;
    }
    
    console.log('\nProcessos Node.js ativos:');
    console.log(stdout);
    console.log('Para encerrar todos os processos Node.js: taskkill /F /IM node.exe');
  });
} 