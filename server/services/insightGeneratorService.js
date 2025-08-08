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
   * Buscar dados do usuário para substituição de variáveis
   * @param {string} userId - ID do usuário
   * @returns {Object} Dados do usuário para variáveis
   */
  async fetchUserData(userId) {
    const client = await this.pgPool.connect();
    
    try {
      logger.info(`Buscando dados para usuário ${userId}`);

      // Buscar dados básicos do usuário
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        logger.warn(`Usuário ${userId} não encontrado`);
        return {};
      }

      // Buscar estatísticas musicais do usuário
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Query para música mais tocada
      const topSongQuery = `
        SELECT song_title, artist, COUNT(*) as play_count
        FROM music_log 
        WHERE name = $1 AND date >= $2
        GROUP BY song_title, artist
        ORDER BY play_count DESC
        LIMIT 1
      `;

      // Query para artista mais tocado
      const topArtistQuery = `
        SELECT artist, COUNT(*) as play_count
        FROM music_log 
        WHERE name = $1 AND date >= $2
        GROUP BY artist
        ORDER BY play_count DESC
        LIMIT 1
      `;

      // Query para total de execuções
      const totalPlaysQuery = `
        SELECT COUNT(*) as total_plays
        FROM music_log 
        WHERE name = $1
      `;

      // Query para execuções semanais
      const weeklyPlaysQuery = `
        SELECT COUNT(*) as weekly_plays
        FROM music_log 
        WHERE name = $1 AND date >= $2
      `;

      // Query para execuções mensais
      const monthlyPlaysQuery = `
        SELECT COUNT(*) as monthly_plays
        FROM music_log 
        WHERE name = $1 AND date >= $2
      `;

      // Query para horário de pico
      const peakHourQuery = `
        SELECT EXTRACT(HOUR FROM time::time) as hour, COUNT(*) as play_count
        FROM music_log 
        WHERE name = $1 AND date >= $2
        GROUP BY EXTRACT(HOUR FROM time::time)
        ORDER BY play_count DESC
        LIMIT 1
      `;

      // Executar queries em paralelo
      const [
        topSongResult,
        topArtistResult,
        totalPlaysResult,
        weeklyPlaysResult,
        monthlyPlaysResult,
        peakHourResult
      ] = await Promise.all([
        client.query(topSongQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]]),
        client.query(topArtistQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]]),
        client.query(totalPlaysQuery, [user.email]),
        client.query(weeklyPlaysQuery, [user.email, oneWeekAgo.toISOString().split('T')[0]]),
        client.query(monthlyPlaysQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]]),
        client.query(peakHourQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]])
      ]);

      // Calcular taxa de crescimento
      const currentWeekPlays = weeklyPlaysResult.rows[0]?.weekly_plays || 0;
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      const previousWeekQuery = `
        SELECT COUNT(*) as previous_week_plays
        FROM music_log 
        WHERE name = $1 AND date >= $2 AND date < $3
      `;
      
      const previousWeekResult = await client.query(previousWeekQuery, [
        user.email, 
        twoWeeksAgo.toISOString().split('T')[0],
        oneWeekAgo.toISOString().split('T')[0]
      ]);

      const previousWeekPlays = previousWeekResult.rows[0]?.previous_week_plays || 0;
      const growthRate = previousWeekPlays > 0 
        ? ((currentWeekPlays - previousWeekPlays) / previousWeekPlays * 100).toFixed(1) + '%'
        : currentWeekPlays > 0 ? '+100%' : '0%';

      // Calcular horas de escuta (estimativa: 3.5 minutos por música)
      const totalPlays = parseInt(totalPlaysResult.rows[0]?.total_plays || 0);
      const listeningHours = Math.round((totalPlays * 3.5) / 60);

      // Análise de fim de semana vs dias úteis
      const weekendQuery = `
        SELECT COUNT(*) as weekend_plays
        FROM music_log 
        WHERE name = $1 AND date >= $2 
        AND EXTRACT(DOW FROM date) IN (0, 6)
      `;
      
      const weekdayQuery = `
        SELECT COUNT(*) as weekday_plays
        FROM music_log 
        WHERE name = $1 AND date >= $2 
        AND EXTRACT(DOW FROM date) NOT IN (0, 6)
      `;

      const [weekendResult, weekdayResult] = await Promise.all([
        client.query(weekendQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]]),
        client.query(weekdayQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]])
      ]);

      const weekendPlays = parseInt(weekendResult.rows[0]?.weekend_plays || 0);
      const weekdayPlays = parseInt(weekdayResult.rows[0]?.weekday_plays || 0);
      const weekendVsWeekday = weekendPlays > weekdayPlays ? 'Mais ativo nos fins de semana' : 'Mais ativo durante a semana';

      // Contar descobertas (músicas únicas no último mês)
      const discoveryQuery = `
        SELECT COUNT(DISTINCT CONCAT(song_title, ' - ', artist)) as discovery_count
        FROM music_log 
        WHERE name = $1 AND date >= $2
      `;
      
      const discoveryResult = await client.query(discoveryQuery, [user.email, oneMonthAgo.toISOString().split('T')[0]]);

      // Compilar dados
      const userData = {
        topSong: topSongResult.rows[0] ? {
          title: topSongResult.rows[0].song_title,
          artist: topSongResult.rows[0].artist,
          playCount: topSongResult.rows[0].play_count
        } : null,
        topArtist: topArtistResult.rows[0] ? {
          name: topArtistResult.rows[0].artist,
          playCount: topArtistResult.rows[0].play_count
        } : null,
        totalPlays,
        weeklyPlays: currentWeekPlays,
        monthlyPlays: parseInt(monthlyPlaysResult.rows[0]?.monthly_plays || 0),
        growthRate,
        favoriteGenre: 'Variado', // Placeholder - pode ser implementado com análise mais complexa
        listeningHours,
        discoveryCount: parseInt(discoveryResult.rows[0]?.discovery_count || 0),
        peakHour: peakHourResult.rows[0] ? `${peakHourResult.rows[0].hour}:00` : 'N/A',
        weekendVsWeekday,
        moodAnalysis: 'Eclético' // Placeholder - pode ser implementado com análise de gêneros
      };

      logger.info(`Dados coletados para usuário ${userId}`, {
        topSong: userData.topSong?.title,
        totalPlays: userData.totalPlays,
        weeklyPlays: userData.weeklyPlays,
        growthRate: userData.growthRate
      });

      return userData;

    } catch (error) {
      logger.error(`Erro ao buscar dados do usuário ${userId}`, {
        error: error.message,
        stack: error.stack
      });
      return {};
    } finally {
      client.release();
    }
  }

  /**
   * Gerar dados realistas para um usuário baseados nos dados reais das rádios
   * @param {string} userId - ID do usuário
   * @returns {Object} Dados realistas do usuário
   */
  async generateRealisticUserData(userId) {
    const client = await this.pgPool.connect();
    
    try {
      logger.info(`Gerando dados realistas para usuário ${userId}`);

      // Buscar dados básicos do usuário
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        logger.warn(`Usuário ${userId} não encontrado`);
        return this.getDefaultRealisticData();
      }

      // Buscar músicas e artistas populares dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query para músicas mais tocadas
      const topSongsQuery = `
        SELECT song_title, artist, COUNT(*) as play_count
        FROM music_log 
        WHERE date >= $1 
          AND song_title IS NOT NULL 
          AND artist IS NOT NULL
        GROUP BY song_title, artist
        ORDER BY play_count DESC
        LIMIT 20
      `;

      // Query para artistas mais tocados
      const topArtistsQuery = `
        SELECT artist, COUNT(*) as play_count
        FROM music_log 
        WHERE date >= $1 
          AND artist IS NOT NULL
        GROUP BY artist
        ORDER BY play_count DESC
        LIMIT 20
      `;

      // Query para gêneros mais tocados
      const topGenresQuery = `
        SELECT genre, COUNT(*) as play_count
        FROM music_log 
        WHERE date >= $1 
          AND genre IS NOT NULL
        GROUP BY genre
        ORDER BY play_count DESC
        LIMIT 10
      `;

      // Executar queries
      const [topSongsResult, topArtistsResult, topGenresResult] = await Promise.all([
        client.query(topSongsQuery, [thirtyDaysAgo.toISOString().split('T')[0]]),
        client.query(topArtistsQuery, [thirtyDaysAgo.toISOString().split('T')[0]]),
        client.query(topGenresQuery, [thirtyDaysAgo.toISOString().split('T')[0]])
      ]);

      // Gerar dados realistas baseados nos dados reais
      const realisticData = this.generateUserProfile(
        topSongsResult.rows,
        topArtistsResult.rows,
        topGenresResult.rows,
        user
      );

      logger.info(`Dados realistas gerados para usuário ${userId}`, {
        topSong: realisticData.topSong?.title,
        topArtist: realisticData.topArtist?.name,
        totalPlays: realisticData.totalPlays,
        favoriteGenre: realisticData.favoriteGenre
      });

      return realisticData;

    } catch (error) {
      logger.error(`Erro ao gerar dados realistas para usuário ${userId}`, {
        error: error.message,
        stack: error.stack
      });
      return this.getDefaultRealisticData();
    } finally {
      client.release();
    }
  }

  /**
   * Gerar perfil de usuário baseado nos dados reais das rádios
   * @param {Array} topSongs - Músicas mais tocadas
   * @param {Array} topArtists - Artistas mais tocados
   * @param {Array} topGenres - Gêneros mais tocados
   * @param {Object} user - Dados do usuário
   * @returns {Object} Perfil realista do usuário
   */
  generateUserProfile(topSongs, topArtists, topGenres, user) {
    // Selecionar aleatoriamente uma música popular
    const randomSong = topSongs[Math.floor(Math.random() * Math.min(topSongs.length, 10))];
    
    // Selecionar aleatoriamente um artista popular
    const randomArtist = topArtists[Math.floor(Math.random() * Math.min(topArtists.length, 10))];
    
    // Selecionar aleatoriamente um gênero popular
    const randomGenre = topGenres[Math.floor(Math.random() * Math.min(topGenres.length, 5))];

    // Gerar números realistas baseados em padrões típicos de usuários
    const baseMultiplier = Math.random() * 0.8 + 0.6; // Entre 0.6 e 1.4
    const totalPlays = Math.floor((50 + Math.random() * 200) * baseMultiplier); // 30-280 plays
    const weeklyPlays = Math.floor(totalPlays * 0.15 + Math.random() * 10); // ~15% do total + variação
    const monthlyPlays = Math.floor(totalPlays * 0.6 + Math.random() * 20); // ~60% do total + variação
    
    // Calcular taxa de crescimento realista
    const growthVariation = (Math.random() - 0.5) * 60; // -30% a +30%
    const growthRate = growthVariation >= 0 ? `+${growthVariation.toFixed(1)}%` : `${growthVariation.toFixed(1)}%`;
    
    // Horário de pico realista (mais comum entre 14h-22h)
    const peakHours = [14, 15, 16, 17, 18, 19, 20, 21, 22];
    const peakHour = peakHours[Math.floor(Math.random() * peakHours.length)];
    
    // Padrão de escuta
    const weekendPatterns = [
      'Mais ativo nos fins de semana',
      'Mais ativo durante a semana',
      'Escuta equilibrada entre semana e fim de semana'
    ];
    const weekendVsWeekday = weekendPatterns[Math.floor(Math.random() * weekendPatterns.length)];
    
    // Análise de humor baseada no gênero
    const moodAnalysis = this.getMoodFromGenre(randomGenre?.genre);
    
    return {
      topSong: randomSong ? {
        title: randomSong.song_title,
        artist: randomSong.artist,
        playCount: Math.floor(Math.random() * 15) + 5 // 5-20 plays
      } : null,
      topArtist: randomArtist ? {
        name: randomArtist.artist,
        playCount: Math.floor(Math.random() * 25) + 10 // 10-35 plays
      } : null,
      totalPlays,
      weeklyPlays,
      monthlyPlays,
      growthRate,
      favoriteGenre: randomGenre?.genre || 'Pop',
      listeningHours: Math.floor(totalPlays * 3.5 / 60), // 3.5 min por música
      discoveryCount: Math.floor(Math.random() * 8) + 3, // 3-10 descobertas
      peakHour: `${peakHour}:00`,
      weekendVsWeekday,
      moodAnalysis
    };
  }

  /**
   * Obter análise de humor baseada no gênero
   * @param {string} genre - Gênero musical
   * @returns {string} Análise de humor
   */
  getMoodFromGenre(genre) {
    if (!genre) return 'Eclético';
    
    const genreLower = genre.toLowerCase();
    
    if (genreLower.includes('rock') || genreLower.includes('metal')) {
      return 'Energético e intenso';
    } else if (genreLower.includes('pop')) {
      return 'Animado e mainstream';
    } else if (genreLower.includes('sertanejo') || genreLower.includes('country')) {
      return 'Romântico e nostálgico';
    } else if (genreLower.includes('eletronic') || genreLower.includes('dance')) {
      return 'Dançante e moderno';
    } else if (genreLower.includes('jazz') || genreLower.includes('blues')) {
      return 'Sofisticado e relaxante';
    } else if (genreLower.includes('rap') || genreLower.includes('hip hop')) {
      return 'Urbano e expressivo';
    } else if (genreLower.includes('reggae')) {
      return 'Relaxado e positivo';
    } else {
      return 'Eclético e variado';
    }
  }

  /**
   * Obter dados realistas padrão quando não há dados disponíveis
   * @returns {Object} Dados padrão realistas
   */
  getDefaultRealisticData() {
    const defaultSongs = [
      { title: 'Blinding Lights', artist: 'The Weeknd' },
      { title: 'Watermelon Sugar', artist: 'Harry Styles' },
      { title: 'Levitating', artist: 'Dua Lipa' },
      { title: 'Good 4 U', artist: 'Olivia Rodrigo' },
      { title: 'Stay', artist: 'The Kid LAROI & Justin Bieber' }
    ];

    const defaultArtists = [
      'Taylor Swift', 'Ed Sheeran', 'Ariana Grande', 'Drake', 'Billie Eilish'
    ];

    const randomSong = defaultSongs[Math.floor(Math.random() * defaultSongs.length)];
    const randomArtist = defaultArtists[Math.floor(Math.random() * defaultArtists.length)];

    const totalPlays = Math.floor(Math.random() * 150) + 50; // 50-200 plays
    const weeklyPlays = Math.floor(totalPlays * 0.15 + Math.random() * 10);
    const monthlyPlays = Math.floor(totalPlays * 0.6 + Math.random() * 20);

    return {
      topSong: {
        title: randomSong.title,
        artist: randomSong.artist,
        playCount: Math.floor(Math.random() * 15) + 5
      },
      topArtist: {
        name: randomArtist,
        playCount: Math.floor(Math.random() * 25) + 10
      },
      totalPlays,
      weeklyPlays,
      monthlyPlays,
      growthRate: `+${(Math.random() * 30).toFixed(1)}%`,
      favoriteGenre: 'Pop',
      listeningHours: Math.floor(totalPlays * 3.5 / 60),
      discoveryCount: Math.floor(Math.random() * 8) + 3,
      peakHour: '19:00',
      weekendVsWeekday: 'Mais ativo durante a semana',
      moodAnalysis: 'Eclético e moderno'
    };
  }

  /**
   * Fechar conexões quando necessário
   */
  async close() {
    await this.pgPool.end();
    logger.info('Conexões do pool PostgreSQL fechadas');
  }
}