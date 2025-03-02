// Script alternativo para configurar a tabela de streams usando o driver pg diretamente
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Configurar caminhos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(rootDir, '.env') });

// Configuração da conexão com o banco de dados
const { Pool } = pg;
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// Função principal
const setupStreams = async () => {
  let client;
  
  try {
    console.log('Iniciando configuração da tabela de streams...');
    
    // Verificar se os arquivos existem
    const sqlFilePath = path.join(rootDir, 'scripts', 'create_streams_table.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFilePath}`);
    }
    
    // Ler o conteúdo do arquivo SQL
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Conectar ao banco de dados
    client = await pool.connect();
    console.log('Conexão com o banco de dados estabelecida');
    
    // Executar o script SQL para criar a tabela
    console.log('Criando tabela de streams...');
    await client.query(sqlContent);
    console.log('Tabela de streams criada com sucesso');
    
    // Importar dados do arquivo JSON
    console.log('Importando dados para a tabela de streams...');
    
    // Ler o arquivo JSON
    const streamsData = JSON.parse(fs.readFileSync(path.resolve('c:/dataradio/finger/streams.json'), 'utf8'));
    console.log(`Encontrados ${streamsData.length} streams para importar.`);
    
    // Inicia uma transação
    await client.query('BEGIN');
    
    // Limpa a tabela existente (opcional)
    await client.query('TRUNCATE TABLE streams RESTART IDENTITY CASCADE');
    
    // Prepara a query de inserção
    const insertQuery = `
      INSERT INTO streams (url, name, sheet, cidade, estado, regiao, segmento, index)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    // Insere cada stream no banco de dados
    for (const stream of streamsData) {
      const values = [
        stream.url,
        stream.name,
        stream.sheet,
        stream.cidade,
        stream.estado,
        stream.regiao,
        stream.segmento,
        stream.index
      ];
      
      const result = await client.query(insertQuery, values);
      console.log(`Inserido stream ID: ${result.rows[0].id}, Nome: ${stream.name}`);
    }
    
    // Finaliza a transação
    await client.query('COMMIT');
    console.log('Importação concluída com sucesso!');
    
    console.log('Configuração da tabela de streams concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a configuração:', error);
    
    // Em caso de erro, reverte a transação se estiver em uma
    if (client) {
      await client.query('ROLLBACK').catch(e => console.error('Erro ao fazer rollback:', e));
    }
    
    process.exit(1);
  } finally {
    // Liberar o cliente e encerrar o pool
    if (client) {
      client.release();
    }
    await pool.end();
  }
};

// Executar o script
setupStreams(); 