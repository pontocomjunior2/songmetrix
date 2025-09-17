#!/usr/bin/env node

/**
 * Teste de conectividade MinIO
 * Diagnóstico completo da integração MinIO
 */

console.log('🚀 Iniciando script test-minio.js...');

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
  useSSL: process.env.MINIO_USE_SSL !== 'false' // Default to true for HTTPS
};

const LOG_DIR = '/app/logs';

class MinIOTester {
  constructor() {
    this.aliasName = 'test-minio-alias';
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);

    try {
      const logFile = path.join(LOG_DIR, 'minio-test.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no log file:', error.message);
    }
  }

  async testMCInstallation() {
    try {
      this.log('🔍 Verificando instalação do MinIO client (mc)...');
      console.log('🔍 Procurando mc no PATH...');

      // Usar mc.exe diretamente do diretório atual
      const mcPath = './mc.exe';
      this.log(`🔍 Verificando mc em: ${mcPath}`);

      // Verificar se o arquivo existe
      const fs = await import('fs');
      if (!fs.existsSync(mcPath)) {
        throw new Error(`mc.exe não encontrado em ${mcPath}`);
      }

      this.log('✅ mc.exe encontrado');
      this.log('✅ mc encontrado em: ' + result.trim());

      const version = execSync('mc.exe --version', { encoding: 'utf8' });
      this.log('📋 Versão mc: ' + version.trim());

      return true;
    } catch (error) {
      this.log('❌ mc não encontrado ou não funcional', 'ERROR');
      this.log('💡 Instale o mc: wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc && chmod +x /usr/local/bin/mc');
      return false;
    }
  }

  async testMinIOConnection() {
    try {
      this.log('🌐 Testando conectividade com MinIO...');
      this.log(`📍 Endpoint: ${minioConfig.endpoint}`);
      this.log(`👤 Access Key: ${minioConfig.accessKey}`);
      this.log(`📦 Bucket: ${minioConfig.bucket}`);

      // Configurar alias
      this.log('🔧 Configurando alias MinIO...');
      const protocol = minioConfig.useSSL ? 'https' : 'http';
      execSync(`mc.exe alias set ${this.aliasName} ${protocol}://${minioConfig.endpoint} ${minioConfig.accessKey} ${minioConfig.secretKey}`, {
        stdio: 'pipe'
      });
      this.log('✅ Alias configurado');

      // Testar conexão
      this.log('🔗 Testando conexão...');
      const pingResult = execSync(`mc.exe ping ${this.aliasName}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      this.log('✅ Conexão OK: ' + pingResult.trim());

      return true;
    } catch (error) {
      this.log(`❌ Erro na conexão MinIO: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testBucketOperations() {
    try {
      this.log('📦 Testando operações de bucket...');

      // Criar bucket se não existir
      this.log(`📋 Criando/verificando bucket: ${minioConfig.bucket}`);
      execSync(`mc.exe mb ${this.aliasName}/${minioConfig.bucket} --ignore-existing`, {
        stdio: 'pipe'
      });
      this.log('✅ Bucket OK');

      // Listar conteúdo do bucket
      this.log('📋 Listando conteúdo do bucket...');
      const listResult = execSync(`mc.exe ls ${this.aliasName}/${minioConfig.bucket}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const files = listResult.trim().split('\n').filter(line => line.length > 0);
      this.log(`📊 Arquivos no bucket: ${files.length}`);

      if (files.length > 0) {
        this.log('📁 Arquivos encontrados:');
        files.slice(0, 5).forEach(file => {
          this.log(`   - ${file}`);
        });
        if (files.length > 5) {
          this.log(`   ... e mais ${files.length - 5} arquivos`);
        }
      }

      return true;
    } catch (error) {
      this.log(`❌ Erro nas operações de bucket: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testFileUpload() {
    try {
      this.log('📤 Testando upload de arquivo...');

      // Criar arquivo de teste
      const testFile = '/tmp/minio-test-file.txt';
      const testContent = `Teste MinIO - ${new Date().toISOString()}\nConteúdo de teste para verificar upload.`;

      fs.writeFileSync(testFile, testContent);
      this.log('📝 Arquivo de teste criado');

      // Fazer upload
      const remotePath = `test/minio-test-${Date.now()}.txt`;
      execSync(`mc.exe cp ${testFile} ${this.aliasName}/${minioConfig.bucket}/${remotePath}`, {
        stdio: 'inherit'
      });
      this.log(`✅ Upload concluído: ${remotePath}`);

      // Verificar upload
      const verifyResult = execSync(`mc.exe ls ${this.aliasName}/${minioConfig.bucket}/test/`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      if (verifyResult.includes(path.basename(remotePath))) {
        this.log('✅ Upload verificado');
      } else {
        this.log('⚠️ Upload não encontrado na listagem');
      }

      // Limpar arquivo de teste
      fs.unlinkSync(testFile);
      this.log('🧹 Arquivo de teste local removido');

      return true;
    } catch (error) {
      this.log(`❌ Erro no upload: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async generateReport(results) {
    try {
      this.log('📊 Gerando relatório de diagnóstico MinIO...');

      const report = {
        timestamp: new Date().toISOString(),
        configuration: minioConfig,
        tests: results,
        overall: 'unknown'
      };

      // Determinar status geral
      const passedTests = Object.values(results).filter(result => result === true).length;
      const totalTests = Object.keys(results).length;

      if (passedTests === totalTests) {
        report.overall = 'healthy';
        this.log('🎉 Todos os testes MinIO passaram!');
      } else if (passedTests >= totalTests - 1) {
        report.overall = 'warning';
        this.log('⚠️ Alguns testes falharam');
      } else {
        report.overall = 'critical';
        this.log('🚨 Múltiplos testes falharam', 'ERROR');
      }

      // Salvar relatório
      try {
        const reportPath = path.join(LOG_DIR, 'minio-diagnostic-report.json');
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
    this.log('🎯 Iniciando diagnóstico MinIO do Songmetrix');
    console.log('🔧 Configuração MinIO:', {
      endpoint: minioConfig.endpoint,
      accessKey: minioConfig.accessKey,
      bucket: minioConfig.bucket,
      useSSL: minioConfig.useSSL
    });

    const results = {
      mcInstallation: false,
      minioConnection: false,
      bucketOperations: false,
      fileUpload: false
    };

    try {
      console.log('1. Iniciando teste de instalação do mc...');
      // 1. Testar instalação do mc
      results.mcInstallation = await this.testMCInstallation();
      console.log('1. Teste de instalação concluído:', results.mcInstallation);

      if (!results.mcInstallation) {
        this.log('❌ Abortando testes - mc não instalado', 'ERROR');
        return false;
      }

      console.log('2. Iniciando teste de conexão MinIO...');
      // 2. Testar conexão MinIO
      results.minioConnection = await this.testMinIOConnection();
      console.log('2. Teste de conexão concluído:', results.minioConnection);

      if (!results.minioConnection) {
        this.log('❌ Abortando testes - conexão MinIO falhou', 'ERROR');
        return false;
      }

      // 3. Testar operações de bucket
      results.bucketOperations = await this.testBucketOperations();

      // 4. Testar upload de arquivo
      results.fileUpload = await this.testFileUpload();

      // 5. Gerar relatório
      await this.generateReport(results);

      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`✅ Diagnóstico MinIO concluído em ${duration}s`);

      return results.fileUpload; // Retorna true se upload funcionou

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`❌ Diagnóstico falhou após ${duration}s: ${error.message}`, 'ERROR');
      return false;
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MinIOTester();
  tester.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

export default MinIOTester;