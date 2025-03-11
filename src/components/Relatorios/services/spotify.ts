// Importar tipos necessários
import { SpotifyTrack } from '../../Spotify/types';
import moment from 'moment';

// Usar as credenciais do arquivo .env
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "6454790e98c04c22b3fecc25dcd9e75c";
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || "b9d28568c7e04ad79735bf8fddb750ed";

// Implementar um mecanismo de throttling
const THROTTLE_DELAY = 1000; // 1 segundo entre requisições
let lastRequestTime = 0;

const throttleRequest = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < THROTTLE_DELAY) {
    const waitTime = THROTTLE_DELAY - timeSinceLastRequest;
    console.log(`Aguardando ${waitTime}ms antes da próxima requisição...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
};

/**
 * Converte o índice de popularidade do Spotify (0-100) em uma estimativa de número de reproduções
 * e formata o resultado com sufixos apropriados (k, mi, bi)
 * Considera o período selecionado para ajustar a estimativa
 */
const popularityToPlays = (popularity: number, startDate: string, endDate: string): string => {
  // Primeiro, calcular o número total estimado de reproduções com base na popularidade
  let totalPlays: number;
  
  // A pontuação de popularidade do Spotify vai de 0 a 100
  if (popularity <= 0) {
    return "0";
  } else if (popularity < 20) {
    // Entre 0-20: estimativa de até 50 mil plays
    totalPlays = Math.round((popularity / 20) * 50000);
  } else if (popularity < 40) {
    // Entre 20-40: estimativa de 50k a 500k plays
    totalPlays = Math.round(50000 + ((popularity - 20) / 20) * 450000);
  } else if (popularity < 60) {
    // Entre 40-60: estimativa de 500k a 5M plays
    totalPlays = Math.round(500000 + ((popularity - 40) / 20) * 4500000);
  } else if (popularity < 80) {
    // Entre 60-80: estimativa de 5M a 50M plays
    totalPlays = Math.round(5000000 + ((popularity - 60) / 20) * 45000000);
  } else {
    // Entre 80-100: estimativa de 50M a 1B+ plays
    totalPlays = Math.round(50000000 + ((popularity - 80) / 20) * 950000000);
  }

  // Agora, ajustar com base no período selecionado
  // Vamos considerar que o número total é para um período de 3 meses (90 dias)
  // E ajustar para o período específico
  const start = moment(startDate);
  const end = moment(endDate);
  const daysDifference = end.diff(start, 'days') + 1; // +1 para incluir o dia final
  
  // Limitar a um mínimo de 1 dia e máximo de 365 dias (1 ano)
  const adjustedDays = Math.max(1, Math.min(daysDifference, 365));
  
  // Ajustar o número de plays com base no período
  // Fator de ajuste: período selecionado / período padrão (90 dias)
  const adjustmentFactor = adjustedDays / 90;
  const periodAdjustedPlays = Math.round(totalPlays * adjustmentFactor);
  
  // Formatar o número com sufixos
  if (periodAdjustedPlays < 1000) {
    return periodAdjustedPlays.toString();
  } else if (periodAdjustedPlays < 1000000) {
    return Math.round(periodAdjustedPlays / 1000) + "k";
  } else if (periodAdjustedPlays < 1000000000) {
    return (periodAdjustedPlays / 1000000).toFixed(1).replace('.0', '') + "mi";
  } else {
    return (periodAdjustedPlays / 1000000000).toFixed(1).replace('.0', '') + "bi";
  }
};

/**
 * Obtém um token de acesso do Spotify
 * Documentação: https://developer.spotify.com/documentation/web-api/reference/get-an-access-token
 */
export const fetchSpotifyToken = async (): Promise<string | null> => {
  const tokenUrl = "https://accounts.spotify.com/api/token";

  try {
    await throttleRequest();
    
    console.log("Obtendo token do Spotify para relatórios");
    
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET),
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar token do Spotify: ${response.status} - ${JSON.stringify(errorData)}`);
      return null;
    }

    const data = await response.json();
    console.log("Token do Spotify obtido com sucesso");
    return data.access_token;
  } catch (error) {
    console.error("Erro ao buscar o token do Spotify:", error);
    return null;
  }
};

/**
 * Limpa o nome da música e do artista para busca
 */
const cleanSearchTerms = (title: string, artist: string): string => {
  // Remover caracteres especiais e normalizar
  let cleanTitle = title.replace(/[&/\\#,+()$~%.'":*?<>{}]/g, ' ').trim();
  let cleanArtist = artist.replace(/[&/\\#,+()$~%.'":*?<>{}]/g, ' ').trim();
  
  // Normalizar acentos
  cleanTitle = cleanTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  cleanArtist = cleanArtist.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Combinar título e artista para uma busca mais precisa
  return encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
};

/**
 * Busca informações de uma música no Spotify
 * Documentação: https://developer.spotify.com/documentation/web-api/reference/search
 */
export const searchTrackOnSpotify = async (
  title: string,
  artist: string,
  accessToken: string
): Promise<SpotifyTrack | null> => {
  try {
    await throttleRequest();
    
    const searchTerm = cleanSearchTerms(title, artist);
    const searchUrl = `https://api.spotify.com/v1/search?q=${searchTerm}&type=track&market=BR&limit=1`;
    
    console.log(`Buscando música no Spotify: ${title} - ${artist}`);
    
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar música "${title} - ${artist}": ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return searchTrackOnSpotify(title, artist, accessToken);
      }
      
      return null;
    }

    const data = await response.json();
    
    if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
      console.log(`Nenhuma música encontrada para: ${title} - ${artist}`);
      return null;
    }
    
    const track = data.tracks.items[0];
    return {
      id: track.id,
      name: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      albumCover: track.album.images[0]?.url || '',
      popularity: track.popularity || 0,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      preview_url: track.preview_url || '',
      external_url: track.external_urls?.spotify || ''
    };
  } catch (error) {
    console.error(`Erro ao buscar música "${title} - ${artist}":`, error);
    return null;
  }
};

/**
 * Busca o número de plays de várias músicas no Spotify para o período selecionado
 * Retorna um objeto com o ID da música como chave e o número formatado de plays como valor
 */
export const fetchTracksPopularity = async (
  tracks: Array<{ title: string; artist: string }>,
  startDate: string,
  endDate: string
): Promise<{ [key: string]: string }> => {
  const accessToken = await fetchSpotifyToken();
  if (!accessToken) {
    console.error("Não foi possível obter token do Spotify");
    return {};
  }
  
  const result: { [key: string]: string } = {};
  
  console.log(`Buscando dados para o período: ${startDate} a ${endDate}`);
  
  // Processar as músicas em lotes para evitar muitas requisições simultâneas
  const batchSize = 5;
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    
    // Processar cada música do lote em paralelo
    const promises = batch.map(async ({ title, artist }) => {
      const trackInfo = await searchTrackOnSpotify(title, artist, accessToken);
      if (trackInfo) {
        // Usar um ID único baseado no título e artista para identificar a música
        const trackKey = `${title}|${artist}`.toLowerCase();
        // Converter o índice de popularidade em uma estimativa formatada de plays
        // ajustada para o período selecionado
        result[trackKey] = popularityToPlays(trackInfo.popularity, startDate, endDate);
      }
    });
    
    // Aguardar todas as requisições do lote terminarem
    await Promise.all(promises);
  }
  
  return result;
}; 