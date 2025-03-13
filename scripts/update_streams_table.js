import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar caminhos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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
const updateStreamsTable = async () => {
  let client;
  
  try {
    console.log('Iniciando atualização da tabela de streams...');
    
    // Verificar se o arquivo SQL existe
    const sqlFilePath = path.join(rootDir, 'scripts', 'alter_streams_table.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFilePath}`);
    }
    
    // Ler o conteúdo do arquivo SQL
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Conectar ao banco de dados
    client = await pool.connect();
    console.log('Conexão com o banco de dados estabelecida');
    
    // Executar o script SQL para atualizar a tabela
    console.log('Atualizando tabela de streams...');
    await client.query(sqlContent);
    console.log('Tabela de streams atualizada com sucesso');
    
    console.log('Atualização da tabela de streams concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a atualização:', error);
    
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

// Executar a função principal
updateStreamsTable(); 