#!/usr/bin/env node

/**
 * Songmetrix Backup Orchestrator
 * Coordena backups completos do PostgreSQL e Supabase
 */

import pg from 'pg';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Configurações do banco
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || '104.234.173.96',
  database: process.env.POSTGRES_DB || 'music_log',
  password: process.env.POSTGRES_PASSWORD || 'Conquista@@2',
  port: parseInt(process.env.POSTGRES_PORT) || 5433,
  ssl: { rejectUnauthorized: false }
};

// Configurações MinIO
const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || '93.127.141.215:9000',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'Conquista@@2',
  bucket: process.env.MINIO_BUCKET || 'songmetrix-backups',
  useSSL: process.env.MINIO_USE_SSL === 'true'
};

// Diretórios
const TEMP_DIR = '/app/temp';
const LOG_DIR = '/app/logs';

class BackupOrchestrator {
  constructor() {
    this.pool = new Pool(dbConfig);
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.backupFile = `songmetrix-backup-${this.timestamp}.sql.gz`;
    this.backupPath = path.join(TEMP_DIR, this.backupFile);
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);

    // Tentar escrever no arquivo de log
    try {
      const logFile = path.join(LOG_DIR, 'backup.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no log file:', error.message);
    }
  }

  async testDatabaseConnection() {
    try {
      this.log('🔍 Testando conexão com PostgreSQL...');
      await this.pool.query('SELECT 1');
      this.log('✅ Conexão com PostgreSQL OK');
      return true;
    } catch (error) {
      this.log(`❌ Erro na conexão PostgreSQL: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async getDatabaseInfo() {
    try {
      this.log('📊 Coletando informações do banco...');

      // Tamanho do banco
      const sizeResult = await this.pool.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as size,
          current_database() as database_name
      `);

      // Número de tabelas
      const tablesResult = await this.pool.query(`
        SELECT count(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);

      // Número de registros
      const recordsResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins - n_tup_del as rowcount
        FROM pg_stat_user_tables
        ORDER BY rowcount DESC
        LIMIT 5
      `);

      this.log(`📏 Tamanho do banco: ${sizeResult.rows[0].size}`);
      this.log(`📋 Número de tabelas: ${tablesResult.rows[0].table_count}`);
      this.log('📈 Tabelas com mais registros:');
      recordsResult.rows.forEach(row => {
        this.log(`   - ${row.tablename}: ${row.rowcount} registros`);
      });

      return {
        size: sizeResult.rows[0].size,
        tables: tablesResult.rows[0].table_count,
        topTables: recordsResult.rows
      };
    } catch (error) {
      this.log(`❌ Erro ao coletar informações: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async createBackup() {
    try {
      this.log(`💾 Criando backup: ${this.backupFile}`);

      // Garantir que o diretório temp existe
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
        this.log('📁 Diretório temp criado');
      }

      // Comando pg_dump com compressão
      const pgDumpCmd = `
        pg_dump --host=${dbConfig.host}
                --port=${dbConfig.port}
                --username=${dbConfig.user}
                --dbname=${dbConfig.database}
                --no-password
                --format=custom
                --compress=9
                --file=${this.backupPath}
                --verbose
      `.replace(/\s+/g, ' ').trim();

      this.log('🚀 Executando pg_dump...');

      // Configurar senha para pg_dump
      process.env.PGPASSWORD = dbConfig.password;

      execSync(pgDumpCmd, {
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: dbConfig.password }
      });

      // Verificar se o arquivo foi criado
      if (fs.existsSync(this.backupPath)) {
        const stats = fs.statSync(this.backupPath);
        this.log(`✅ Backup criado: ${this.backupPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      } else {
        throw new Error('Arquivo de backup não foi criado');
      }

    } catch (error) {
      this.log(`❌ Erro ao criar backup: ${error.message}`, 'ERROR');
      return false;
    } finally {
      // Limpar senha do ambiente
      delete process.env.PGPASSWORD;
    }
  }

  async uploadToMinIO() {
    try {
      this.log('☁️ Fazendo upload para MinIO...');

      // Verificar se mc (MinIO client) está disponível
      try {
        execSync('which mc', { stdio: 'pipe' });
      } catch (error) {
        this.log('⚠️ MinIO client (mc) não encontrado, pulando upload');
        return false;
      }

      // Configurar alias do MinIO (se não existir)
      const aliasName = 'songmetrix-backup-alias';
      try {
        execSync(`mc alias set ${aliasName} http://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`, {
          stdio: 'pipe'
        });
        this.log('✅ Alias MinIO configurado');
      } catch (error) {
        // Alias pode já existir, continuar
        this.log('ℹ️ Alias MinIO já existe ou erro na configuração');
      }

      // Criar bucket se não existir
      try {
        execSync(`mc mb ${aliasName}/${minioConfig.bucket} --ignore-existing`, {
          stdio: 'pipe'
        });
        this.log(`✅ Bucket ${minioConfig.bucket} verificado/criado`);
      } catch (error) {
        this.log(`ℹ️ Bucket ${minioConfig.bucket} já existe`);
      }

      // Fazer upload
      const remotePath = `daily/${this.backupFile}`;
      execSync(`mc cp ${this.backupPath} ${aliasName}/${minioConfig.bucket}/${remotePath}`, {
        stdio: 'inherit'
      });

      this.log(`✅ Upload concluído: ${minioConfig.bucket}/${remotePath}`);
      return true;

    } catch (error) {
      this.log(`❌ Erro no upload MinIO: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async cleanup() {
    try {
      this.log('🧹 Fazendo limpeza...');

      // Remover arquivo de backup local após upload
      if (fs.existsSync(this.backupPath)) {
        fs.unlinkSync(this.backupPath);
        this.log('✅ Arquivo local removido');
      }

      // Limpar arquivos temporários antigos (mais de 1 hora)
      const tempFiles = fs.readdirSync(TEMP_DIR);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      tempFiles.forEach(file => {
        const filePath = path.join(TEMP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < oneHourAgo) {
            fs.unlinkSync(filePath);
            this.log(`🗑️ Arquivo temporário removido: ${file}`);
          }
        } catch (error) {
          // Ignorar erros de limpeza
        }
      });

    } catch (error) {
      this.log(`⚠️ Erro na limpeza: ${error.message}`, 'WARN');
    }
  }

  async run() {
    const startTime = Date.now();
    this.log('🎯 Iniciando backup completo do Songmetrix');

    try {
      // 1. Testar conexão
      if (!await this.testDatabaseConnection()) {
        throw new Error('Falha na conexão com o banco');
      }

      // 2. Coletar informações
      await this.getDatabaseInfo();

      // 3. Criar backup
      if (!await this.createBackup()) {
        throw new Error('Falha na criação do backup');
      }

      // 4. Upload para MinIO
      if (!await this.uploadToMinIO()) {
        this.log('⚠️ Upload para MinIO falhou, mas backup local mantido', 'WARN');
      }

      // 5. Limpeza
      await this.cleanup();

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`🎉 Backup completo concluído em ${duration}s`);

      return true;

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`❌ Backup falhou após ${duration}s: ${error.message}`, 'ERROR');
      return false;
    } finally {
      await this.pool.end();
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = new BackupOrchestrator();
  orchestrator.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default BackupOrchestrator;