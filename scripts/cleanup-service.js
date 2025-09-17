#!/usr/bin/env node

/**
 * Songmetrix Cleanup Service
 * Remove backups antigos baseado na política de retenção
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = '/app/logs';

// Configurações de retenção
const RETENTION_CONFIG = {
  daily: parseInt(process.env.BACKUP_RETENTION_DAILY) || 7,
  weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY) || 4,
  monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY) || 12
};

// Configurações MinIO
const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || '93.127.141.215:9000',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'Conquista@@2',
  bucket: process.env.MINIO_BUCKET || 'songmetrix-backups'
};

class CleanupService {
  constructor() {
    this.aliasName = 'cleanup-alias';
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);

    try {
      const logFile = path.join(LOG_DIR, 'cleanup.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no log file:', error.message);
    }
  }

  async setupMinIOAlias() {
    try {
      // Verificar se mc está disponível
      try {
        execSync('which mc', { stdio: 'pipe' });
      } catch (error) {
        this.log('⚠️ MinIO client não encontrado');
        return false;
      }

      // Configurar alias
      execSync(`mc alias set ${this.aliasName} http://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`, {
        stdio: 'pipe'
      });

      this.log('✅ Alias MinIO configurado para limpeza');
      return true;

    } catch (error) {
      this.log(`❌ Erro ao configurar alias MinIO: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async listBackups(type) {
    try {
      const prefix = `${type}/`;
      const result = execSync(`mc ls ${this.aliasName}/${minioConfig.bucket}/${prefix} --json`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const backups = result.trim().split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return null;
          }
        })
        .filter(item => item && item.key)
        .map(item => ({
          key: item.key,
          size: item.size,
          lastModified: new Date(item.lastModified)
        }))
        .sort((a, b) => b.lastModified - a.lastModified); // Mais recente primeiro

      this.log(`📋 Encontrados ${backups.length} backups ${type}`);
      return backups;

    } catch (error) {
      this.log(`❌ Erro ao listar backups ${type}: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async cleanupBackups(type, backups, retentionDays) {
    if (backups.length <= retentionDays) {
      this.log(`✅ ${type}: ${backups.length} backups (dentro do limite de ${retentionDays})`);
      return 0;
    }

    const toDelete = backups.slice(retentionDays);
    let deletedCount = 0;

    this.log(`🗑️ ${type}: Removendo ${toDelete.length} backups antigos (mantendo ${retentionDays})`);

    for (const backup of toDelete) {
      try {
        const fullPath = `${this.aliasName}/${minioConfig.bucket}/${backup.key}`;
        execSync(`mc rm ${fullPath}`, { stdio: 'pipe' });

        this.log(`✅ Removido: ${backup.key} (${this.formatSize(backup.size)})`);
        deletedCount++;

      } catch (error) {
        this.log(`❌ Erro ao remover ${backup.key}: ${error.message}`, 'ERROR');
      }
    }

    return deletedCount;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async cleanupLocalFiles() {
    try {
      this.log('🧹 Limpando arquivos locais antigos...');

      const tempDir = '/app/temp';
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      let cleanedCount = 0;

      if (!fs.existsSync(tempDir)) {
        this.log('📁 Diretório temp não existe');
        return 0;
      }

      const files = fs.readdirSync(tempDir);

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          const age = Date.now() - stats.mtime.getTime();

          if (age > maxAge) {
            fs.unlinkSync(filePath);
            this.log(`🗑️ Arquivo local removido: ${file}`);
            cleanedCount++;
          }
        } catch (error) {
          this.log(`⚠️ Erro ao verificar arquivo ${file}: ${error.message}`, 'WARN');
        }
      }

      this.log(`✅ ${cleanedCount} arquivos locais removidos`);
      return cleanedCount;

    } catch (error) {
      this.log(`❌ Erro na limpeza local: ${error.message}`, 'ERROR');
      return 0;
    }
  }

  async generateReport(deletedCounts) {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        retention: RETENTION_CONFIG,
        deleted: deletedCounts,
        totalDeleted: Object.values(deletedCounts).reduce((sum, count) => sum + count, 0)
      };

      this.log('📊 Relatório de limpeza:');
      this.log(`   - Backups diários removidos: ${deletedCounts.daily}`);
      this.log(`   - Backups semanais removidos: ${deletedCounts.weekly}`);
      this.log(`   - Backups mensais removidos: ${deletedCounts.monthly}`);
      this.log(`   - Arquivos locais removidos: ${deletedCounts.local}`);
      this.log(`   - Total removido: ${report.totalDeleted}`);

      // Salvar relatório
      try {
        const reportPath = path.join(LOG_DIR, 'cleanup-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        this.log(`✅ Relatório salvo em: ${reportPath}`);
      } catch (error) {
        this.log(`⚠️ Não foi possível salvar relatório: ${error.message}`, 'WARN');
      }

      return report;

    } catch (error) {
      this.log(`❌ Erro ao gerar relatório: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async run() {
    const startTime = Date.now();
    this.log('🧹 Iniciando limpeza de backups antigos');

    try {
      // Configurar MinIO
      if (!await this.setupMinIOAlias()) {
        throw new Error('Falha na configuração do MinIO');
      }

      const deletedCounts = {
        daily: 0,
        weekly: 0,
        monthly: 0,
        local: 0
      };

      // Limpar backups diários
      const dailyBackups = await this.listBackups('daily');
      deletedCounts.daily = await this.cleanupBackups('daily', dailyBackups, RETENTION_CONFIG.daily);

      // Limpar backups semanais
      const weeklyBackups = await this.listBackups('weekly');
      deletedCounts.weekly = await this.cleanupBackups('weekly', weeklyBackups, RETENTION_CONFIG.weekly);

      // Limpar backups mensais
      const monthlyBackups = await this.listBackups('monthly');
      deletedCounts.monthly = await this.cleanupBackups('monthly', monthlyBackups, RETENTION_CONFIG.monthly);

      // Limpar arquivos locais
      deletedCounts.local = await this.cleanupLocalFiles();

      // Gerar relatório
      await this.generateReport(deletedCounts);

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`✅ Limpeza concluída em ${duration}s`);

      return true;

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`❌ Limpeza falhou após ${duration}s: ${error.message}`, 'ERROR');
      return false;
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleanup = new CleanupService();
  cleanup.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default CleanupService;