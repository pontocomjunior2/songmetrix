#!/usr/bin/env node

/**
 * Songmetrix Monitoring Service
 * Monitora saúde do sistema e conexões
 */

import pg from 'pg';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Configurações
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || '104.234.173.96',
  database: process.env.POSTGRES_DB || 'music_log',
  password: process.env.POSTGRES_PASSWORD || 'Conquista@@2',
  port: parseInt(process.env.POSTGRES_PORT) || 5433,
  ssl: { rejectUnauthorized: false }
};

const minioConfig = {
  endpoint: process.env.MINIO_ENDPOINT || '93.127.141.215:9000',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'Conquista@@2',
  bucket: process.env.MINIO_BUCKET || 'songmetrix-backups'
};

const LOG_DIR = '/app/logs';

class MonitoringService {
  constructor() {
    this.pool = new Pool(dbConfig);
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);

    try {
      const logFile = path.join(LOG_DIR, 'monitoring.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no log file:', error.message);
    }
  }

  async checkDatabaseHealth() {
    try {
      this.log('🔍 Verificando saúde do PostgreSQL...');

      // Teste básico de conexão
      await this.pool.query('SELECT 1');

      // Verificar conexões ativas
      const connectionsResult = await this.pool.query(`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `);

      // Verificar locks
      const locksResult = await this.pool.query(`
        SELECT count(*) as locks_count
        FROM pg_locks
        WHERE NOT granted
      `);

      // Verificar espaço em disco
      const diskResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 3
      `);

      this.log(`✅ PostgreSQL OK - Conexões ativas: ${connectionsResult.rows[0].active_connections}`);
      this.log(`🔒 Locks pendentes: ${locksResult.rows[0].locks_count}`);

      if (diskResult.rows.length > 0) {
        this.log('📏 Tabelas maiores:');
        diskResult.rows.forEach(row => {
          this.log(`   - ${row.tablename}: ${row.size}`);
        });
      }

      return {
        status: 'healthy',
        connections: connectionsResult.rows[0].active_connections,
        locks: locksResult.rows[0].locks_count,
        topTables: diskResult.rows
      };

    } catch (error) {
      this.log(`❌ PostgreSQL com problemas: ${error.message}`, 'ERROR');
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkMinIOHealth() {
    try {
      this.log('☁️ Verificando saúde do MinIO...');

      // Verificar se mc está disponível
      try {
        execSync('which mc', { stdio: 'pipe' });
      } catch (error) {
        this.log('⚠️ MinIO client não encontrado');
        return { status: 'unknown', error: 'mc not found' };
      }

      // Configurar alias temporário
      const aliasName = 'monitoring-alias';
      try {
        execSync(`mc alias set ${aliasName} http://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`, {
          stdio: 'pipe'
        });
      } catch (error) {
        // Alias pode já existir
      }

      // Verificar bucket
      try {
        const result = execSync(`mc ls ${aliasName}/${minioConfig.bucket}`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        const files = result.trim().split('\n').filter(line => line.length > 0);
        this.log(`✅ MinIO OK - Arquivos no bucket: ${files.length}`);

        return {
          status: 'healthy',
          files: files.length,
          bucket: minioConfig.bucket
        };

      } catch (error) {
        this.log(`❌ MinIO com problemas: ${error.message}`, 'ERROR');
        return { status: 'unhealthy', error: error.message };
      }

    } catch (error) {
      this.log(`❌ Erro no monitoramento MinIO: ${error.message}`, 'ERROR');
      return { status: 'error', error: error.message };
    }
  }

  async checkSystemResources() {
    try {
      this.log('💻 Verificando recursos do sistema...');

      // Verificar espaço em disco
      try {
        const diskUsage = execSync('df -h / | tail -1', { encoding: 'utf8' });
        this.log(`💾 Disco: ${diskUsage.trim()}`);
      } catch (error) {
        this.log('⚠️ Não foi possível verificar espaço em disco');
      }

      // Verificar memória
      try {
        const memUsage = execSync('free -h', { encoding: 'utf8' });
        const memLines = memUsage.trim().split('\n');
        if (memLines.length >= 2) {
          this.log(`🧠 Memória: ${memLines[1]}`);
        }
      } catch (error) {
        this.log('⚠️ Não foi possível verificar memória');
      }

      // Verificar processos do container
      try {
        const processes = execSync('ps aux | wc -l', { encoding: 'utf8' });
        this.log(`🔄 Processos ativos: ${processes.trim()}`);
      } catch (error) {
        this.log('⚠️ Não foi possível verificar processos');
      }

      return { status: 'checked' };

    } catch (error) {
      this.log(`⚠️ Erro na verificação de recursos: ${error.message}`, 'WARN');
      return { status: 'partial', error: error.message };
    }
  }

  async generateReport() {
    try {
      this.log('📊 Gerando relatório de monitoramento...');

      const report = {
        timestamp: new Date().toISOString(),
        database: await this.checkDatabaseHealth(),
        minio: await this.checkMinIOHealth(),
        system: await this.checkSystemResources(),
        overall: 'unknown'
      };

      // Determinar status geral
      const services = [report.database, report.minio, report.system];
      const healthyCount = services.filter(s => s.status === 'healthy' || s.status === 'checked').length;

      if (healthyCount === services.length) {
        report.overall = 'healthy';
        this.log('🎉 Todos os serviços funcionando corretamente');
      } else if (healthyCount >= services.length - 1) {
        report.overall = 'warning';
        this.log('⚠️ Alguns serviços com problemas menores');
      } else {
        report.overall = 'critical';
        this.log('🚨 Múltiplos serviços com problemas', 'ERROR');
      }

      // Salvar relatório
      try {
        const reportPath = path.join(LOG_DIR, 'monitoring-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        this.log(`✅ Relatório salvo em: ${reportPath}`);
      } catch (error) {
        this.log(`⚠️ Não foi possível salvar relatório: ${error.message}`, 'WARN');
      }

      return report;

    } catch (error) {
      this.log(`❌ Erro ao gerar relatório: ${error.message}`, 'ERROR');
      return { status: 'error', error: error.message };
    }
  }

  async run() {
    const startTime = Date.now();
    this.log('👀 Iniciando monitoramento do Songmetrix');

    try {
      const report = await this.generateReport();

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`✅ Monitoramento concluído em ${duration}s`);

      // Retornar status baseado no relatório
      return report.overall === 'healthy';

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`❌ Monitoramento falhou após ${duration}s: ${error.message}`, 'ERROR');
      return false;
    } finally {
      await this.pool.end();
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitoring = new MonitoringService();
  monitoring.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default MonitoringService;