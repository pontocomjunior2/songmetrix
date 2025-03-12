/**
 * Serviço centralizado para lidar com cálculos e normalização de popularidade
 * para uso nos indicadores visuais
 */

import { fetchTracksPopularity } from './spotify';
import { fetchTracksViewCounts } from './youtube';
import moment from 'moment';

// Interfaces para os dados de popularidade
export interface PopularityData {
  score: number;        // Pontuação de 0-100
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  rawScore?: number;    // Valor original (popularidade ou visualizações)
}

interface TrackData {
  title: string;
  artist: string;
}

/**
 * Converte a pontuação de popularidade do Spotify (já na escala 0-100) para o formato PopularityData
 * Inclui análise de tendência baseada em dados históricos simulados
 */
export const convertSpotifyPopularity = async (
  tracks: TrackData[],
  startDate: string,
  endDate: string
): Promise<Record<string, PopularityData>> => {
  // Primeiro, obter os dados atuais de popularidade do Spotify
  const currentPopularity = await fetchSpotifyRawData(tracks, startDate, endDate);
  
  // Simular dados históricos (30 dias antes) para calcular tendência
  const thirtyDaysAgo = moment(startDate).subtract(30, 'days').format('YYYY-MM-DD');
  const startDateHistory = thirtyDaysAgo;
  const endDateHistory = moment(startDate).subtract(1, 'days').format('YYYY-MM-DD');
  
  // Não precisamos fazer chamada API para dados históricos, vamos simular
  const historicalData: Record<string, number> = {};
  Object.entries(currentPopularity).forEach(([key, value]) => {
    // Simular variação de -15% a +15% para dados históricos
    const variationFactor = 1 + (Math.random() * 0.3 - 0.15);
    const historicalValue = Math.max(0, Math.min(100, Math.round(value * variationFactor)));
    historicalData[key] = historicalValue;
  });
  
  // Calcular tendências e converter para o formato PopularityData
  const result: Record<string, PopularityData> = {};
  
  Object.entries(currentPopularity).forEach(([key, currentValue]) => {
    const historicalValue = historicalData[key] || currentValue;
    const difference = currentValue - historicalValue;
    const percentChange = historicalValue > 0 
      ? Number(((difference / historicalValue) * 100).toFixed(1)) 
      : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (percentChange > 1) trend = 'up';
    else if (percentChange < -1) trend = 'down';
    
    result[key] = {
      score: currentValue,
      trend,
      trendPercentage: Math.abs(percentChange),
      rawScore: currentValue
    };
  });
  
  return result;
};

/**
 * Converte as visualizações do YouTube para uma escala de 0-100 e calcula tendências
 */
export const convertYouTubePopularity = async (
  tracks: TrackData[],
  startDate: string,
  endDate: string
): Promise<Record<string, PopularityData>> => {
  // Obter dados brutos do YouTube (contagem de visualizações)
  const viewCountsRaw = await fetchYouTubeRawData(tracks, startDate, endDate);
  
  // Encontrar o valor máximo para normalização
  const viewCounts: Record<string, number> = {};
  let maxViews = 0;
  
  Object.entries(viewCountsRaw).forEach(([key, value]) => {
    // Converter strings formatadas ("10k", "2.5mi", etc.) para números
    const numericValue = parseFormattedNumber(value);
    viewCounts[key] = numericValue;
    maxViews = Math.max(maxViews, numericValue);
  });
  
  // Normalizar para escala 0-100 usando uma função logarítmica para melhor distribuição
  const normalizedCounts: Record<string, number> = {};
  Object.entries(viewCounts).forEach(([key, views]) => {
    // Tratamento especial para valores muito baixos
    if (views <= 0) {
      normalizedCounts[key] = 0;
    } 
    // Para valores muito altos (mais de 1 bilhão), garantir pontuação alta
    else if (views > 1_000_000_000) {
      normalizedCounts[key] = Math.min(100, 90 + (Math.log10(views) - 9) * 5);
    }
    // Faixa média - usar escala logarítmica
    else {
      // log10(100) = 2, log10(1.000.000) = 6, log10(1.000.000.000) = 9
      // Mapear essa faixa para 20-90 na escala de popularidade
      const logValue = Math.log10(views);
      const minLog = 2;  // 100 views
      const maxLog = 9;  // 1 bilhão de views
      const normalizedScore = 20 + (logValue - minLog) * (70 / (maxLog - minLog));
      normalizedCounts[key] = Math.max(0, Math.min(100, Math.round(normalizedScore)));
    }
  });
  
  // Simular dados históricos para cálculo de tendência (similar ao Spotify)
  const historicalData: Record<string, number> = {};
  Object.entries(normalizedCounts).forEach(([key, value]) => {
    const variationFactor = 1 + (Math.random() * 0.3 - 0.15);
    const historicalValue = Math.max(0, Math.min(100, Math.round(value * variationFactor)));
    historicalData[key] = historicalValue;
  });
  
  // Calcular tendências e converter para o formato PopularityData
  const result: Record<string, PopularityData> = {};
  
  Object.entries(normalizedCounts).forEach(([key, currentValue]) => {
    const historicalValue = historicalData[key] || currentValue;
    const difference = currentValue - historicalValue;
    const percentChange = historicalValue > 0 
      ? Number(((difference / historicalValue) * 100).toFixed(1)) 
      : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (percentChange > 1) trend = 'up';
    else if (percentChange < -1) trend = 'down';
    
    result[key] = {
      score: currentValue,
      trend,
      trendPercentage: Math.abs(percentChange),
      rawScore: viewCounts[key]
    };
  });
  
  return result;
};

/**
 * Função auxiliar para converter strings formatadas como "10k", "2.5mi" em números
 */
function parseFormattedNumber(formatted: string): number {
  if (!formatted) return 0;
  
  const cleanStr = formatted.trim().toLowerCase();
  
  if (cleanStr === '0') return 0;
  
  // Expressão regular para extrair o número e o sufixo
  const matches = cleanStr.match(/^([\d.,]+)(k|mi|bi)?$/);
  if (!matches) return 0;
  
  let num = parseFloat(matches[1].replace(',', '.'));
  const suffix = matches[2];
  
  // Multiplicar com base no sufixo
  if (suffix === 'k') num *= 1_000;
  else if (suffix === 'mi') num *= 1_000_000;
  else if (suffix === 'bi') num *= 1_000_000_000;
  
  return num;
}

/**
 * Busca os dados brutos de popularidade do Spotify (0-100)
 */
async function fetchSpotifyRawData(
  tracks: TrackData[],
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  // Obter os dados formatados do Spotify
  const formattedData = await fetchTracksPopularity(tracks, startDate, endDate);
  
  // Extrair os dados de popularidade
  const result: Record<string, number> = {};
  
  // Como precisamos dos valores numéricos sem formatação, vamos obter diretamente da API
  // Aqui, simulamos que os valores brutos de popularidade estão na faixa de 0-100
  Object.entries(formattedData).forEach(([key, formattedValue]) => {
    // Usar o parseFormattedNumber como uma forma simplificada de obter um valor aproximado
    const estimatedPlays = parseFormattedNumber(formattedValue);
    
    // Converter de volta para uma escala de 0-100
    let popularity: number;
    
    if (estimatedPlays <= 0) {
      popularity = 0;
    } else if (estimatedPlays < 50_000) {
      popularity = Math.round((estimatedPlays / 50_000) * 20);
    } else if (estimatedPlays < 500_000) {
      popularity = Math.round(20 + ((estimatedPlays - 50_000) / 450_000) * 20);
    } else if (estimatedPlays < 5_000_000) {
      popularity = Math.round(40 + ((estimatedPlays - 500_000) / 4_500_000) * 20);
    } else if (estimatedPlays < 50_000_000) {
      popularity = Math.round(60 + ((estimatedPlays - 5_000_000) / 45_000_000) * 20);
    } else {
      popularity = Math.round(80 + ((estimatedPlays - 50_000_000) / 950_000_000) * 20);
    }
    
    // Garantir que está na faixa 0-100
    result[key] = Math.max(0, Math.min(100, popularity));
  });
  
  return result;
}

/**
 * Busca os dados brutos de visualizações do YouTube
 */
async function fetchYouTubeRawData(
  tracks: TrackData[],
  startDate: string,
  endDate: string
): Promise<Record<string, string>> {
  return await fetchTracksViewCounts(tracks, startDate, endDate);
}

/**
 * Busca e processa os dados de popularidade de todas as fontes
 * @param tracks Lista de faixas para buscar dados
 * @param startDate Data inicial do período
 * @param endDate Data final do período
 * @param options Opções para controlar quais dados buscar
 */
export const fetchAllPopularityData = async (
  tracks: TrackData[],
  startDate: string,
  endDate: string,
  options: {
    includeSpotify?: boolean;
    includeYoutube?: boolean;
  } = { includeSpotify: true, includeYoutube: true }
): Promise<{
  spotify: Record<string, PopularityData>;
  youtube: Record<string, PopularityData>;
}> => {
  // Definir resultados vazios por padrão
  let spotifyData: Record<string, PopularityData> = {};
  let youtubeData: Record<string, PopularityData> = {};
  
  // Array para armazenar as promessas de busca
  const promises: Promise<any>[] = [];
  
  // Adicionar promessa do Spotify se necessário
  if (options.includeSpotify) {
    promises.push(
      convertSpotifyPopularity(tracks, startDate, endDate)
        .then(data => { spotifyData = data; })
        .catch(error => {
          console.error('Erro ao obter dados do Spotify:', error);
          return {}; // Retornar objeto vazio em caso de erro
        })
    );
  }
  
  // Adicionar promessa do YouTube se necessário
  if (options.includeYoutube) {
    promises.push(
      convertYouTubePopularity(tracks, startDate, endDate)
        .then(data => { youtubeData = data; })
        .catch(error => {
          console.error('Erro ao obter dados do YouTube:', error);
          return {}; // Retornar objeto vazio em caso de erro
        })
    );
  }
  
  // Aguardar todas as promessas necessárias
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  return {
    spotify: spotifyData,
    youtube: youtubeData
  };
}; 