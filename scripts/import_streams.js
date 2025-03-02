import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente
dotenv.config();

// Configuração da conexão com o banco de dados
const { Pool } = pg;
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

async function importStreams() {
  try {
    // Lê o arquivo JSON
    const streamsData = JSON.parse(fs.readFileSync(path.resolve('c:/dataradio/finger/streams.json'), 'utf8'));
    
    console.log(`Encontrados ${streamsData.length} streams para importar.`);
    
    // Conecta ao banco de dados
    const client = await pool.connect();
    
    try {
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
    } catch (error) {
      // Em caso de erro, reverte a transação
      await client.query('ROLLBACK');
      console.error('Erro durante a importação:', error);
      throw error;
    } finally {
      // Libera o cliente
      client.release();
    }
  } catch (error) {
    console.error('Erro ao importar streams:', error);
  } finally {
    // Encerra o pool de conexões
    await pool.end();
  }
}

// Executa a importação
importStreams(); 