import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;
import { musicLogDbPool } from '../config/musicLogDb.js';
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(dirname(__dirname)), '.env.production'),
  path.join(dirname(dirname(__dirname)), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('[InsightGeneratorService] Loaded environment variables from:', envPath);
    break;
  }
}

// Configuração do logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Serviço para geração de insights musicais para usuários
 * Versão JavaScript para uso no backend Node.js
 */
export class InsightGeneratorService {
  /**
   * Construtor com injeção de dependência do LlmService
   * @param {Object} llmService Instância do serviço LLM para geração de conteúdo
   */
  constructor(llmService) {
    this.llmService = llmService;

    // Inicializar cliente Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL ou Service Role Key não configurados');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Inicializar pool PostgreSQL
    this.pgPool = new Pool({
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Método público principal para gerar insights para todos os usuários
   */
  async generateInsightsForAllUsers() {
    try {
      logger.info('Iniciando processo de geração de insights para todos os usuários.');

      // Buscar todos os usuários da tabela public.users
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id, email');

      if (usersError) {
        logger.error('Erro ao buscar usuários da tabela public.users', {
          error: usersError.message,
          code: usersError.code
        });
        throw usersError;
      }

      if (!users || users.length === 0) {
        logger.info('Nenhum usuário encontrado na tabela public.users');
        return;
      }

      logger.info(`Encontrados ${users.length} usuários para processamento`);

      // Iterar sobre cada usuário
      for (const user of users) {
        try {
          logger.info(`Processando usuário ${user.id} (${user.email})`);

          // Encontrar insight de crescimento para o usuário
          const insightData = await this._findGrowthTrendInsight(user);

          // Verificar se insight foi encontrado
          if (!insightData) {
            logger.info(`Nenhum insight encontrado para o usuário ${user.id}`);
            continue;
          }

          logger.info(`Insight encontrado para usuário ${user.id}`, {
            song: insightData.song_title,
            artist: insightData.artist,
            growth: `${insightData.current_week_plays}/${insightData.previous_week_plays}`
          });

          // Preparar dados para o LLM
          const llmInsightData = {
            userId: user.id,
            insightType: 'growth_trend',
            songTitle: insightData.song_title,
            artist: insightData.artist,
            currentWeekPlays: insightData.current_week_plays,
            previousWeekPlays: insightData.previous_week_plays,
            growthRate: (insightData.current_week_plays / insightData.previous_week_plays).toFixed(2)
          };

          // Gerar conteúdo usando LLM
          const emailContent = await this.llmService.generateEmailContent(llmInsightData);

          logger.info(`Conteúdo LLM gerado para usuário ${user.id}`, {
            subjectLength: emailContent.subject.length,
            bodyLength: emailContent.body_html.length
          });

          // Gerar deep link dinâmico
          const deepLink = `https://songmetrix.com.br/insights/growth-trend?song=${encodeURIComponent(insightData.song_title)}&artist=${encodeURIComponent(insightData.artist)}&user=${user.id}`;

          // Salvar rascunho na tabela generated_insight_emails
          const { error: insertError } = await this.supabase
            .from('generated_insight_emails')
            .insert({
              user_id: user.id,
              subject: emailContent.subject,
              body_html: emailContent.body_html,
              insight_data: llmInsightData,
              insight_type: 'growth_trend',
              deep_link: deepLink,
              status: 'draft',
              created_at: new Date().toISOString()
            });

          if (insertError) {
            logger.error(`Erro ao salvar rascunho para usuário ${user.id}`, {
              error: insertError.message,
              code: insertError.code
            });
            throw insertError;
          }

          logger.info(`Rascunho de insight criado com sucesso para o usuário ${user.id}`);

        } catch (error) {
          logger.error(`Erro ao processar usuário ${user.id}`, {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            userEmail: user.email
          });
          // Continuar com o próximo usuário
        }
      }

      logger.info('Processo de geração de insights concluído para todos os usuários');

    } catch (error) {
      logger.error('Erro geral no processo de geração de insights', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Método privado para encontrar insight de crescimento musical
   * @param {Object} user Objeto com id e email do usuário
   * @returns {Promise<Object|null>} Dados do insight ou null se não encontrado
   */
  async _findGrowthTrendInsight(user) {
    const client = await musicLogDbPool.connect();
    
    try {
      logger.debug(`Executando query de crescimento para usuário ${user.id}`);

      // Query SQL final e corrigida para encontrar música com maior crescimento
      const query = `
        -- Encontra a música com o maior crescimento percentual de execuções na última semana
        WITH weekly_plays AS (
          SELECT 
            isrc,
            MAX(artist) AS artist,
            MAX(song_title) AS song_title,
            EXTRACT(WEEK FROM date) AS week_number,
            COUNT(*) AS plays
          FROM public.music_log
          WHERE (date + time)::timestamp >= NOW() - INTERVAL '2 weeks'
            AND isrc IS NOT NULL
          GROUP BY isrc, week_number
        ),
        growth_calculation AS (
          SELECT 
            isrc,
            MAX(artist) AS artist,
            MAX(song_title) AS song_title,
            MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) THEN plays END) AS current_week_plays,
            MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) - 1 THEN plays END) AS previous_week_plays
          FROM weekly_plays
          GROUP BY isrc
        )
        SELECT 
          artist,
          song_title,
          current_week_plays,
          previous_week_plays
        FROM growth_calculation
        WHERE previous_week_plays > 5
        ORDER BY (COALESCE(current_week_plays, 0)::float / previous_week_plays) DESC
        LIMIT 1;
      `;

      const result = await client.query(query);

      logger.debug(`Query executada para usuário ${user.id}`, {
        rowCount: result.rows.length,
        query: query.substring(0, 200) + '...'
      });

      // Retornar primeiro resultado ou null
      if (result.rows.length > 0) {
        const insight = result.rows[0];
        logger.debug(`Insight encontrado para usuário ${user.id}`, insight);
        return insight;
      }

      return null;

    } catch (error) {
      logger.error(`Erro na query de crescimento para usuário ${user.id}`, {
        error: error.message,
        stack: error.stack,
        userId: user.id
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fechar conexões quando necessário
   */
  async close() {
    await this.pgPool.end();
    logger.info('Conexões do pool PostgreSQL fechadas');
  }
}