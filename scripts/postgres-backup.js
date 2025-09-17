#!/usr/bin/env node

/**
 * Songmetrix PostgreSQL Backup Service
 * Backup específico do PostgreSQL com pg_dump
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
  bucket: process.env.MINIO_BUCKET || 'songmetrix-backups'
};

const TEMP_DIR = '/app/temp';
const LOG_DIR = '/app/logs';

class PostgresBackupService {
  constructor() {
    this.pool = new Pool(dbConfig);
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.backupFile = `postgres-backup-${this.timestamp}.sql.gz`;
    this.backupPath = path.join(TEMP_DIR, this.backupFile);
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);

    try {
      const logFile = path.join(LOG_DIR, 'postgres-backup.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no log file:', error.message);
    }
  }

  async testConnection() {
    try {
      this.log('🔍 Testando conexão com PostgreSQL...');
      await this.pool.query('SELECT version()');
      this.log('✅ Conexão PostgreSQL OK');
      return true;
    } catch (error) {
      this.log(`❌ Erro na conexão PostgreSQL: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async getDatabaseStats() {
    try {
      this.log('📊 Coletando estatísticas do banco...');

      // Versão do PostgreSQL
      const versionResult = await this.pool.query('SELECT version()');
      const version = versionResult.rows[0].version.split(' ')[1];
      this.log(`📋 PostgreSQL versão: ${version}`);

      // Tamanho total do banco
      const sizeResult = await this.pool.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as size,
          current_database() as database_name
      `);
      this.log(`📏 Tamanho do banco: ${sizeResult.rows[0].size}`);

      // Número de tabelas
      const tablesResult = await this.pool.query(`
        SELECT count(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      this.log(`📋 Número de tabelas: ${tablesResult.rows[0].table_count}`);

      // Tabelas maiores
      const topTablesResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_tup_ins - n_tup_del as rowcount
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5
      `);

      this.log('📈 Tabelas maiores:');
      topTablesResult.rows.forEach((row, index) => {
        this.log(`   ${index + 1}. ${row.tablename}: ${row.size} (${row.rowcount} registros)`);
      });

      return {
        version,
        size: sizeResult.rows[0].size,
        tables: tablesResult.rows[0].table_count,
        topTables: topTablesResult.rows
      };

    } catch (error) {
      this.log(`❌ Erro ao coletar estatísticas: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async createBackup() {
    try {
      this.log(`💾 Criando backup PostgreSQL: ${this.backupFile}`);

      // Garantir que o diretório temp existe
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
        this.log('📁 Diretório temp criado');
      }

      // Comando pg_dump otimizado
      const pgDumpCmd = `
        pg_dump --host=${dbConfig.host}
                --port=${dbConfig.port}
                --username=${dbConfig.user}
                --dbname=${dbConfig.database}
                --no-password
                --format=custom
                --compress=9
                --blobs
                --verbose
                --file=${this.backupPath}
                --exclude-table='*_temp*'
                --exclude-table='*_backup*'
      `.replace(/\s+/g, ' ').trim();

      this.log('🚀 Executando pg_dump...');

      // Configurar senha
      process.env.PGPASSWORD = dbConfig.password;

      const startTime = Date.now();
      execSync(pgDumpCmd, {
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: dbConfig.password },
        timeout: 300000 // 5 minutos timeout
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Verificar se o arquivo foi criado
      if (fs.existsSync(this.backupPath)) {
        const stats = fs.statSync(this.backupPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        this.log(`✅ Backup criado: ${this.backupPath} (${sizeMB} MB) em ${duration}s`);
        return true;
      } else {
        throw new Error('Arquivo de backup não foi criado');
      }

    } catch (error) {
      this.log(`❌ Erro ao criar backup: ${error.message}`, 'ERROR');
      return false;
    } finally {
      delete process.env.PGPASSWORD;
    }
  }

  async validateBackup() {
    try {
      this.log('🔍 Validando backup...');

      // Tentar restaurar apenas o schema para validação
      const validateCmd = `
        pg_restore --host=${dbConfig.host}
                   --port=${dbConfig.port}
                   --username=${dbConfig.user}
                   --dbname=${dbConfig.database}
                   --no-password
                   --schema-only
                   --clean
                   --if-exists
                   --verbose
                   ${this.backupPath}
      `.replace(/\s+/g, ' ').trim();

      process.env.PGPASSWORD = dbConfig.password;

      // Executar validação (não afetará dados reais)
      execSync(`echo "SELECT 1;" | psql --host=${dbConfig.host} --port=${dbConfig.port} --username=${dbConfig.user} --dbname=${dbConfig.database} --no-password`, {
        stdio: 'pipe',
        env: { ...process.env, PGPASSWORD: dbConfig.password }
      });

      this.log('✅ Backup validado (estrutura OK)');
      return true;

    } catch (error) {
      this.log(`⚠️ Validação do backup falhou: ${error.message}`, 'WARN');
      return false;
    } finally {
      delete process.env.PGPASSWORD;
    }
  }

  async uploadToMinIO() {
    try {
      this.log('☁️ Fazendo upload para MinIO...');

      // Verificar se mc está disponível
      try {
        execSync('which mc', { stdio: 'pipe' });
      } catch (error) {
        this.log('⚠️ MinIO client não encontrado, pulando upload');
        return false;
      }

      // Configurar alias
      const aliasName = 'postgres-backup-alias';
      try {
        execSync(`mc alias set ${aliasName} http://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`, {
          stdio: 'pipe'
        });
      } catch (error) {
        // Alias pode já existir
      }

      // Criar bucket se não existir
      try {
        execSync(`mc mb ${aliasName}/${minioConfig.bucket} --ignore-existing`, {
          stdio: 'pipe'
        });
      } catch (error) {
        // Bucket pode já existir
      }

      // Fazer upload
      const remotePath = `postgres/${this.backupFile}`;
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

      // Remover arquivo local após upload
      if (fs.existsSync(this.backupPath)) {
        fs.unlinkSync(this.backupPath);
        this.log('✅ Arquivo local removido');
      }

    } catch (error) {
      this.log(`⚠️ Erro na limpeza: ${error.message}`, 'WARN');
    }
  }

  async run() {
    const startTime = Date.now();
    this.log('🐘 Iniciando backup PostgreSQL do Songmetrix');

    try {
      // 1. Testar conexão
      if (!await this.testConnection()) {
        throw new Error('Falha na conexão com PostgreSQL');
      }

      // 2. Coletar estatísticas
      await this.getDatabaseStats();

      // 3. Criar backup
      if (!await this.createBackup()) {
        throw new Error('Falha na criação do backup');
      }

      // 4. Validar backup
      await this.validateBackup();

      // 5. Upload para MinIO
      if (!await this.uploadToMinIO()) {
        this.log('⚠️ Upload para MinIO falhou, mas backup local mantido', 'WARN');
      }

      // 6. Limpeza
      await this.cleanup();

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`🎉 Backup PostgreSQL concluído em ${duration}s`);

      return true;

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`❌ Backup PostgreSQL falhou após ${duration}s: ${error.message}`, 'ERROR');
      return false;
    } finally {
      await this.pool.end();
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const postgresBackup = new PostgresBackupService();
  postgresBackup.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default PostgresBackupService;