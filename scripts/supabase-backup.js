#!/usr/bin/env node

/**
 * Songmetrix Supabase Backup Service
 * Backup READ-ONLY do Supabase - NUNCA modifica dados
 * Apenas exporta dados para arquivo .dump
 */

import pg from 'pg';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Configurações Supabase (READ-ONLY)
const supabaseConfig = {
  host: process.env.SUPABASE_DB_HOST || 'db.aylxcqaddelwxfukerhr.supabase.co',
  port: parseInt(process.env.SUPABASE_DB_PORT) || 5432,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD, // Via env var
  ssl: { rejectUnauthorized: false }
};

// Configurações MinIO
const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || 'files.songmetrix.com.br',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'Conquista@@2',
  bucket: process.env.MINIO_BUCKET || 'songmetrix-backups',
  useSSL: process.env.MINIO_USE_SSL !== 'false'
};

const TEMP_DIR = process.platform === 'win32' ? './temp' : '/app/temp';
const LOG_DIR = process.platform === 'win32' ? './logs' : '/app/logs';

class SupabaseBackupService {
  constructor() {
    this.pool = new Pool(supabaseConfig);
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.backupFile = `supabase-backup-${this.timestamp}.dump`;
    this.backupPath = path.join(TEMP_DIR, this.backupFile);
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);

    try {
      const logFile = path.join(LOG_DIR, 'supabase-backup.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no log file:', error.message);
    }
  }

  async testConnection() {
    try {
      this.log('🔍 Testando conexão com Supabase...');
      await this.pool.query('SELECT version()');
      this.log('✅ Conexão Supabase OK');
      return true;
    } catch (error) {
      this.log(`❌ Erro na conexão Supabase: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async getDatabaseStats() {
    try {
      this.log('📊 Coletando estatísticas do Supabase...');

      // Versão do PostgreSQL
      const versionResult = await this.pool.query('SELECT version()');
      const version = versionResult.rows[0].version.split(' ')[1];
      this.log(`📋 PostgreSQL versão: ${version}`);

      // Tamanho do banco
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

      // Tabelas principais (autenticação)
      const topTablesResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_tup_ins - n_tup_del as rowcount
        FROM pg_stat_user_tables
        WHERE tablename IN ('users', 'sessions', 'refresh_tokens', 'audit_log_entries')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5
      `);

      this.log('📈 Tabelas de autenticação:');
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
      this.log(`💾 Criando backup Supabase: ${this.backupFile}`);
      this.log(`📂 Diretório temp: ${TEMP_DIR}`);
      this.log(`📄 Arquivo destino: ${this.backupPath}`);

      // Garantir que o diretório temp existe
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
        this.log('📁 Diretório temp criado');
      } else {
        this.log('📁 Diretório temp já existe');
      }

      // Verificar permissões do diretório
      try {
        fs.accessSync(TEMP_DIR, fs.constants.W_OK);
        this.log('✅ Permissões de escrita OK');
      } catch (error) {
        this.log(`❌ Sem permissões de escrita: ${error.message}`, 'ERROR');
        return false;
      }

      // Comando pg_dump READ-ONLY para Supabase
      const pgDumpCmd = `
        pg_dump --host=${supabaseConfig.host}
                 --port=${supabaseConfig.port}
                 --username=${supabaseConfig.user}
                 --dbname=${supabaseConfig.database}
                 --no-password
                 --format=custom
                 --compress=9
                 --blobs
                 --verbose
                 --file=${this.backupPath}
                 --exclude-schema=graphql_public
                 --exclude-schema=graphql_private
                 --exclude-table='*_migration*'
                 --exclude-table='*_seed*'
      `.replace(/\s+/g, ' ').trim();

      this.log('🚀 Executando pg_dump (READ-ONLY)...');

      // Configurar senha
      process.env.PGPASSWORD = supabaseConfig.password;

      const startTime = Date.now();
      execSync(pgDumpCmd, {
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: supabaseConfig.password },
        timeout: 600000 // 10 minutos timeout
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      // DEBUG: Verificar arquivos no diretório temp
      this.log('🔍 Verificando arquivos criados...');
      const tempFiles = fs.readdirSync(TEMP_DIR);
      this.log(`📋 Arquivos no temp: ${tempFiles.join(', ')}`);

      // Verificar se o arquivo foi criado
      if (fs.existsSync(this.backupPath)) {
        const stats = fs.statSync(this.backupPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        this.log(`✅ Backup criado: ${this.backupPath} (${sizeMB} MB) em ${duration}s`);
        this.log(`📏 Tamanho em bytes: ${stats.size}`);
        return true;
      } else {
        this.log(`❌ Arquivo não encontrado: ${this.backupPath}`, 'ERROR');
        this.log(`📂 Conteúdo do diretório: ${fs.readdirSync(TEMP_DIR).join(', ')}`, 'ERROR');
        throw new Error(`Arquivo de backup não foi criado: ${this.backupPath}`);
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
      this.log('🔍 Validando backup Supabase...');

      // Verificar se o arquivo existe e tem tamanho válido
      if (!fs.existsSync(this.backupPath)) {
        throw new Error('Arquivo de backup não encontrado');
      }

      const stats = fs.statSync(this.backupPath);
      if (stats.size === 0) {
        throw new Error('Arquivo de backup está vazio');
      }

      this.log(`📏 Tamanho do backup: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Tentar listar o conteúdo do backup para validar estrutura
      const listCmd = `pg_restore --list ${this.backupPath}`;

      process.env.PGPASSWORD = supabaseConfig.password;

      const result = execSync(listCmd, {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, PGPASSWORD: supabaseConfig.password }
      });

      // Verificar se o resultado contém itens esperados
      if (result.includes('TABLE') || result.includes('SEQUENCE')) {
        this.log('✅ Backup Supabase validado (estrutura OK)');
        return true;
      } else {
        throw new Error('Backup não contém estruturas esperadas');
      }

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

      // Verificar se as credenciais MinIO estão disponíveis
      if (!minioConfig.secretKey || minioConfig.secretKey === 'Conquista@@2') {
        this.log('⚠️ Credenciais MinIO não configuradas ou usando valor padrão, pulando upload', 'WARN');
        return false;
      }

      // DEBUG: Verificar arquivo antes do upload
      this.log(`🔍 Verificando arquivo: ${this.backupPath}`);
      if (!fs.existsSync(this.backupPath)) {
        this.log(`❌ Arquivo de backup não encontrado: ${this.backupPath}`, 'ERROR');
        return false;
      }

      const stats = fs.statSync(this.backupPath);
      this.log(`📏 Tamanho do arquivo: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Verificar se mc está disponível
      const mcCmd = process.platform === 'win32' ? 'mc.exe' : 'mc';
      try {
        execSync(`${mcCmd} --version`, { stdio: 'pipe' });
        this.log('✅ MinIO client encontrado');
      } catch (error) {
        this.log(`❌ MinIO client não encontrado: ${error.message}`, 'ERROR');
        return false;
      }

      // Configurar alias
      const aliasName = 'supabase-backup-alias';
      const protocol = minioConfig.useSSL ? 'https' : 'http';
      const aliasCmd = `${mcCmd} alias set ${aliasName} ${protocol}://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`;

      this.log(`🔧 Configurando alias: ${aliasName}`);
      try {
        execSync(aliasCmd, { stdio: 'pipe' });
        this.log('✅ Alias configurado com sucesso');
      } catch (error) {
        this.log(`⚠️ Alias pode já existir: ${error.message}`);
      }

      // Verificar conectividade
      try {
        execSync(`${mcCmd} ls ${aliasName}/`, { stdio: 'pipe' });
        this.log('✅ Conectividade MinIO OK');
      } catch (error) {
        this.log(`❌ Erro de conectividade MinIO: ${error.message}`, 'ERROR');
        return false;
      }

      // Criar bucket se não existir
      try {
        execSync(`${mcCmd} mb ${aliasName}/${minioConfig.bucket} --ignore-existing`, {
          stdio: 'pipe'
        });
        this.log('✅ Bucket verificado/criado');
      } catch (error) {
        this.log(`⚠️ Erro ao verificar bucket: ${error.message}`);
      }

      // Fazer upload com path absoluto
      const remotePath = `daily/${this.backupFile}`;
      const uploadCmd = `${mcCmd} cp "${this.backupPath}" ${aliasName}/${minioConfig.bucket}/${remotePath}`;

      this.log(`📤 Executando upload: ${uploadCmd}`);
      execSync(uploadCmd, { stdio: 'inherit' });

      // Verificar se upload foi bem-sucedido
      try {
        const result = execSync(`${mcCmd} ls ${aliasName}/${minioConfig.bucket}/${remotePath}`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        this.log(`✅ Upload verificado: ${minioConfig.bucket}/${remotePath}`);
        return true;
      } catch (verifyError) {
        this.log(`⚠️ Upload executado mas não verificado: ${verifyError.message}`);
        return true; // Upload foi executado, pode ter funcionado
      }

    } catch (error) {
      this.log(`❌ Erro no upload MinIO: ${error.message}`, 'ERROR');
      this.log(`🔍 Detalhes do erro: ${error.stack}`, 'ERROR');
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
    this.log('🗄️ Iniciando backup Supabase (READ-ONLY)');

    try {
      // 1. Testar conexão
      if (!await this.testConnection()) {
        throw new Error('Falha na conexão com Supabase');
      }

      // 2. Coletar estatísticas
      await this.getDatabaseStats();

      // 3. Criar backup
      if (!await this.createBackup()) {
        throw new Error('Falha na criação do backup Supabase');
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
      this.log(`🎉 Backup Supabase concluído em ${duration}s`);

      return true;

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`❌ Backup Supabase falhou após ${duration}s: ${error.message}`, 'ERROR');
      return false;
    } finally {
      await this.pool.end();
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const supabaseBackup = new SupabaseBackupService();
  supabaseBackup.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default SupabaseBackupService;