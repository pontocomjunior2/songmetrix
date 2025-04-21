import express from 'express';
import { authenticateBasicUser } from '../auth-middleware.js';
import pkg from 'pg';
import supabaseAdmin from '../supabase-admin.js';

const { Pool } = pkg;
const router = express.Router();

// Configuração da conexão com o banco de dados
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para executar consultas com tratamento de erro robusto
const safeQuery = async (query, params = [], retries = 3) => {
  let lastError = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Tentativa ${attempt + 1}/${retries} de executar query:`, { query, params });
      const result = await pool.query(query, params);
      console.log('Query executada com sucesso');
      return result;
    } catch (error) {
      console.error(`Erro na tentativa ${attempt + 1}/${retries}:`, error);
      lastError = error;
      
      // Esperar antes de tentar novamente (backoff exponencial)
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s, etc.
        console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`Todas as ${retries} tentativas falharam. Último erro:`, lastError);
  return { rows: [] }; // Retorna resultado vazio em caso de erro
};

// Rota para obter status das rádios
router.get('/status', authenticateBasicUser, async (req, res) => {
  console.log('*** [Radios Router] Rota /status ACESSADA ***'); // Log de acesso
  try {
    // Obter preferências do usuário do middleware
    const userMetadata = req.user?.user_metadata || {};
    const favoriteSegments = userMetadata.favorite_segments || [];
    const favoriteRadios = userMetadata.favorite_radios || []; // Manter para fallback

    console.log('[Radios Router /status] Preferências:', { favoriteSegments, favoriteRadios });

    let favoriteRadiosSet = new Set(favoriteRadios); // Inicia com rádios antigas (fallback inicial)

    // ** Lógica Correta: Priorizar Segmentos **
    if (favoriteSegments.length > 0) {
      console.log(`[Radios Router /status] Buscando rádios para os segmentos:`, favoriteSegments);
      try {
        const segmentsQuery = `SELECT name FROM streams WHERE formato = ANY($1::text[])`;
        console.log(`[Radios Router /status] Executando query de segmentos:`, segmentsQuery, favoriteSegments);
        const segmentsResult = await safeQuery(segmentsQuery, [favoriteSegments]);
        console.log(`[Radios Router /status] Resultado da query de segmentos:`, segmentsResult?.rows?.length ?? 0, 'rows');

        if (segmentsResult?.rows?.length > 0) {
          // Sobrescreve o Set com base nos segmentos ENCONTRADOS
          favoriteRadiosSet = new Set(segmentsResult.rows.map(row => row.name));
          console.log(`[Radios Router /status] Rádios favoritas ATUALIZADAS baseadas em segmentos:`, favoriteRadiosSet.size);
        } else {
          console.log(`[Radios Router /status] Query de segmentos não retornou rádios. Verificando fallback de favorite_radios.`);
          // Se segmentos não retornaram nada, mas tínhamos favorite_radios, usamos eles.
          // Se não tínhamos favorite_radios, o Set continua vazio.
          if (favoriteRadios.length > 0) {
             console.log(`[Radios Router /status] Usando fallback de favorite_radios (tamanho ${favoriteRadiosSet.size}).`);
          } else {
             console.log(`[Radios Router /status] Sem segmentos ou fallback de favorite_radios. Set de favoritas vazio.`);
             favoriteRadiosSet = new Set(); // Garante que está vazio
          }
        }
      } catch (segmentError) {
        console.error("[Radios Router /status] ERRO ao buscar rádios por segmento:", segmentError);
        console.error(`[Radios Router /status] Mantendo favoriteRadiosSet inicial (fallback de favorite_radios, tamanho ${favoriteRadiosSet.size}) devido ao erro.`);
        // Mantém o favoriteRadiosSet inicial (baseado em favorite_radios)
      }
    } else if (favoriteRadios.length > 0) {
       // Se não há segmentos, mas há favorite_radios, usa o fallback
       console.log(`[Radios Router /status] Sem segmentos definidos. Usando fallback de favorite_radios (tamanho ${favoriteRadiosSet.size}).`);
    } else {
       // Sem segmentos e sem favorite_radios
       console.log('[Radios Router /status] Sem segmentos ou rádios favoritas definidas.');
       favoriteRadiosSet = new Set(); // Garante que está vazio
    }

    // Query principal para buscar TODAS as rádios e seu status (online/offline e last_update)
    const query = `
      WITH latest_entries AS (
        SELECT
          name,
          MAX(date + time::time) as last_update
        FROM music_log
        GROUP BY name
      ),
      all_radios AS (
        SELECT name, created_at, updated_at, cidade, estado, formato FROM streams ORDER BY name
      )
      SELECT
        r.name,
        l.last_update,
        r.created_at,
        r.updated_at,
        r.cidade,
        r.estado,
        r.formato
      FROM all_radios r
      LEFT JOIN latest_entries l ON r.name = l.name
      ORDER BY r.name;
    `;

    // Tentar obter dados diretamente do PostgreSQL
    try {
      console.log('[Radios Router /status] Executando consulta principal para status das rádios...');
      const result = await safeQuery(query);

      if (!result || !result.rows) { // safeQuery retorna { rows: [] } em caso de erro
        console.error('[Radios Router /status] Erro na consulta principal ou nenhum resultado. Retornando array vazio.');
        return res.json([]); // Retorna array vazio em caso de erro grave na query
      }

      console.log(`[Radios Router /status] Consulta principal retornou ${result.rows.length} rádios.`);

      // Verificar dados recentes para determinar quais rádios estão online
      const recentActivityQuery = `
        SELECT DISTINCT name
        FROM music_log
        WHERE ((date + time::time) AT TIME ZONE 'America/Sao_Paulo') > (NOW() - INTERVAL '10 minutes')
      `;
      // TESTE: Executar diretamente sem safeQuery
      console.log('[Radios Router /status] TESTE: Executando recentActivityQuery diretamente...');
      let recentActivity;
      try {
          recentActivity = await pool.query(recentActivityQuery);
          console.log('[Radios Router /status] TESTE: Execução direta retornou:', recentActivity?.rowCount, 'linhas');
      } catch (directQueryError) {
          console.error('[Radios Router /status] TESTE: Erro na execução direta:', directQueryError);
          recentActivity = { rows: [] }; // Simular retorno vazio em caso de erro no teste
      }
      // FIM TESTE
      // const recentActivity = await safeQuery(recentActivityQuery); // Linha original comentada
      const onlineRadiosSet = new Set(recentActivity.rows.map(row => row.name));
      console.log(`[Radios Router /status] Rádios com atividade recente (online): ${onlineRadiosSet.size}`);

      // Processar os resultados, definindo isFavorite com base no favoriteRadiosSet FINAL
      const radiosStatus = result.rows.map(row => {
        const isOnline = onlineRadiosSet.has(row.name);
        const isFavorite = favoriteRadiosSet.has(row.name);

        return {
          name: row.name,
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          lastUpdate: row.last_update || row.updated_at || row.created_at,
          isFavorite: isFavorite,
          city: row.cidade,
          state: row.estado,
          formato: row.formato
        };
      });

      console.log(`[Radios Router /status] Enviando ${radiosStatus.length} status de rádios para o cliente.`);
      return res.json(radiosStatus);

    } catch (postgresError) {
      // Erro na query principal ou na query de atividade recente
      console.error('[Radios Router /status] Erro durante consulta ao PostgreSQL:', postgresError);
      // Retorna array vazio em caso de erro, em vez de dados de exemplo
      return res.json([]);
    }
  } catch (error) {
    console.error('[Radios Router /status] ERRO ao obter status das rádios:', error);
    return res.status(500).json({ error: 'Erro ao obter status das rádios' });
  }
});

export default router;