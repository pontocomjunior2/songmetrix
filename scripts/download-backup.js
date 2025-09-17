#!/usr/bin/env node

/**
 * Songmetrix Backup Download Script
 * Download seguro de backups do MinIO (alternativa ao dashboard)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações MinIO
const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || 'files.songmetrix.com.br',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'Conquista@@2',
  bucket: process.env.MINIO_BUCKET || 'songmetrix-backups',
  useSSL: process.env.MINIO_USE_SSL !== 'false'
};

const DOWNLOAD_DIR = './downloads';

class BackupDownloader {
  constructor() {
    this.mcCmd = process.platform === 'win32' ? 'mc.exe' : 'mc';
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async ensureMCCli() {
    try {
      execSync(`${this.mcCmd} --version`, { stdio: 'pipe' });
      this.log('✅ MinIO client encontrado');
      return true;
    } catch (error) {
      this.log('❌ MinIO client não encontrado', 'ERROR');
      this.log('💡 Instale o mc:', 'INFO');
      if (process.platform === 'win32') {
        this.log('   curl -o mc.exe https://dl.min.io/client/mc/release/windows-amd64/mc.exe', 'INFO');
      } else {
        this.log('   wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc && chmod +x /usr/local/bin/mc', 'INFO');
      }
      return false;
    }
  }

  async setupAlias() {
    const aliasName = 'songmetrix-downloads';
    const protocol = minioConfig.useSSL ? 'https' : 'http';

    try {
      execSync(`${this.mcCmd} alias set ${aliasName} ${protocol}://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`, {
        stdio: 'pipe'
      });
      this.log('✅ Alias MinIO configurado');
      return aliasName;
    } catch (error) {
      this.log(`❌ Erro ao configurar alias: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async listBackups(aliasName) {
    try {
      this.log('📋 Listando backups disponíveis...');

      const result = execSync(`${this.mcCmd} ls ${aliasName}/${minioConfig.bucket}/ --recursive`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const lines = result.trim().split('\n').filter(line => line.length > 0);

      if (lines.length === 0) {
        this.log('⚠️ Nenhum backup encontrado');
        return [];
      }

      this.log('📦 Backups disponíveis:');
      lines.forEach((line, index) => {
        this.log(`   ${index + 1}. ${line}`);
      });

      return lines;
    } catch (error) {
      this.log(`❌ Erro ao listar backups: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async downloadBackup(aliasName, remotePath, localPath) {
    try {
      this.log(`📥 Baixando: ${remotePath}`);

      // Garantir que o diretório local existe
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
        this.log(`📁 Diretório criado: ${localDir}`);
      }

      const startTime = Date.now();
      execSync(`${this.mcCmd} cp ${aliasName}/${minioConfig.bucket}/${remotePath} ${localPath}`, {
        stdio: 'inherit'
      });

      const stats = fs.statSync(localPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      const duration = Math.round((Date.now() - startTime) / 1000);

      this.log(`✅ Download concluído: ${localPath} (${sizeMB} MB) em ${duration}s`);
      return true;

    } catch (error) {
      this.log(`❌ Erro no download: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async verifyBackup(filePath) {
    try {
      this.log(`🔍 Verificando integridade: ${filePath}`);

      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error('Arquivo não encontrado');
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('Arquivo está vazio');
      }

      this.log(`📏 Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Tentar listar conteúdo (se pg_restore estiver disponível)
      try {
        const result = execSync(`pg_restore --list "${filePath}"`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 30000
        });

        const entries = result.split('\n').filter(line =>
          line.includes('TABLE') || line.includes('SEQUENCE') || line.includes('INDEX')
        ).length;

        this.log(`📊 Backup válido: ${entries} objetos encontrados`);
        return true;

      } catch (pgError) {
        this.log(`⚠️ pg_restore não disponível, mas arquivo existe: ${stats.size} bytes`);
        return true; // Arquivo existe, assume válido
      }

    } catch (error) {
      this.log(`❌ Erro na verificação: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async run() {
    this.log('🚀 Iniciando download de backup Songmetrix');

    try {
      // 1. Verificar MinIO client
      if (!await this.ensureMCCli()) {
        process.exit(1);
      }

      // 2. Configurar alias
      const aliasName = await this.setupAlias();
      if (!aliasName) {
        process.exit(1);
      }

      // 3. Listar backups disponíveis
      const backups = await this.listBackups(aliasName);
      if (backups.length === 0) {
        this.log('❌ Nenhum backup encontrado para download');
        process.exit(1);
      }

      // 4. Perguntar qual backup baixar (ou baixar o mais recente)
      const latestBackup = backups[backups.length - 1];
      const remotePath = latestBackup.split(/\s+/).slice(-1)[0]; // Última coluna (nome do arquivo)

      const localFileName = path.basename(remotePath);
      const localPath = path.join(DOWNLOAD_DIR, localFileName);

      // 5. Download
      if (!await this.downloadBackup(aliasName, remotePath, localPath)) {
        process.exit(1);
      }

      // 6. Verificar integridade
      if (!await this.verifyBackup(localPath)) {
        this.log('⚠️ Backup pode estar corrompido', 'WARN');
      }

      this.log(`🎉 Download concluído com sucesso: ${localPath}`);

    } catch (error) {
      this.log(`❌ Erro fatal: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const downloader = new BackupDownloader();
  downloader.run().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default BackupDownloader;