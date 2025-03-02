// Script para configurar a tabela de streams e importar os dados
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';

// Configurar caminhos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(rootDir, '.env') });

// Função para executar comandos
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    console.log(`Executando: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro ao executar comando: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.warn(`Aviso: ${stderr}`);
      }
      console.log(`Saída: ${stdout}`);
      resolve(stdout);
    });
  });
};

// Função principal
const setupStreams = async () => {
  try {
    console.log('Iniciando configuração da tabela de streams...');
    
    // Verificar se os arquivos existem
    const sqlFilePath = path.join(rootDir, 'scripts', 'create_streams_table.sql');
    const importFilePath = path.join(rootDir, 'scripts', 'import_streams.js');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFilePath}`);
    }
    
    if (!fs.existsSync(importFilePath)) {
      throw new Error(`Arquivo de importação não encontrado: ${importFilePath}`);
    }
    
    // Executar o script SQL para criar a tabela
    console.log('Criando tabela de streams...');
    const pgUser = process.env.POSTGRES_USER;
    const pgHost = process.env.POSTGRES_HOST;
    const pgDb = process.env.POSTGRES_DB;
    const pgPassword = process.env.POSTGRES_PASSWORD;
    const pgPort = process.env.POSTGRES_PORT || 5432;
    
    // Comando para executar o script SQL (compatível com Windows)
    // No Windows, não podemos usar PGPASSWORD como prefixo do comando
    // Em vez disso, vamos criar um arquivo temporário com as credenciais
    const pgpassFilePath = path.join(rootDir, '.pgpass.tmp');
    fs.writeFileSync(pgpassFilePath, `${pgHost}:${pgPort}:${pgDb}:${pgUser}:${pgPassword}`);
    
    // Definir a variável de ambiente PGPASSFILE
    const sqlCommand = `set "PGPASSFILE=${pgpassFilePath}" && psql -U ${pgUser} -h ${pgHost} -d ${pgDb} -f "${sqlFilePath}" -w`;
    
    try {
      await runCommand(sqlCommand);
    } finally {
      // Remover o arquivo temporário após a execução
      if (fs.existsSync(pgpassFilePath)) {
        fs.unlinkSync(pgpassFilePath);
      }
    }
    
    // Executar o script de importação
    console.log('Importando dados para a tabela de streams...');
    const importCommand = `node "${importFilePath}"`;
    await runCommand(importCommand);
    
    console.log('Configuração da tabela de streams concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a configuração:', error);
    process.exit(1);
  }
};

// Executar o script
setupStreams(); 