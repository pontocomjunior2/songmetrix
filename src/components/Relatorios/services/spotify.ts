// Importar tipos necessários e bibliotecas
import { SpotifyTrack } from '../../Spotify/types';
import moment from 'moment';

// Importar o sistema de cache
import { apiCache } from './cache';

// Usar as credenciais do arquivo .env
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "6454790e98c04c22b3fecc25dcd9e75c";
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || "b9d28568c7e04ad79735bf8fddb750ed";

// Implementar um mecanismo de throttling mais inteligente
const THROTTLE_DELAY = 1000; // 1 segundo entre requisições, mas pode ser ajustado dinamicamente
let lastRequestTime = 0;
let consecutiveRequests = 0;
let dynamicThrottleDelay = THROTTLE_DELAY;

// Flag para saber se estamos em um processo de carregamento em massa
let isBatchLoading = false;

/**
 * Implementa throttling adaptativo que aumenta o tempo de espera se muitas
 * solicitações forem feitas em sequência, e diminui após períodos de inatividade
 */
const throttleRequest = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // Verificar se estamos em período de inatividade e reduzir o throttle
  if (timeSinceLastRequest > 5000 && dynamicThrottleDelay > THROTTLE_DELAY) {
    dynamicThrottleDelay = Math.max(THROTTLE_DELAY, dynamicThrottleDelay * 0.8);
    consecutiveRequests = 0;
  }
  
  // Se estivermos processando muitas solicitações em lote, aumentar o throttle para evitar bloqueios
  if (consecutiveRequests > 10 && dynamicThrottleDelay < 2000) {
    dynamicThrottleDelay *= 1.2;
  }
  
  if (timeSinceLastRequest < dynamicThrottleDelay) {
    const waitTime = dynamicThrottleDelay - timeSinceLastRequest;
    if (!isBatchLoading || waitTime > 100) {
      console.log(`Aguardando ${waitTime}ms antes da próxima requisição...`);
    }
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  consecutiveRequests++;
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
  // Verificar se temos um token em cache que ainda é válido
  const cachedToken = apiCache.get<string>('spotify_token');
  if (cachedToken) {
    console.log("Usando token do Spotify em cache");
    return cachedToken;
  }
  
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
    
    // Armazenar o token em cache por 50 minutos (um pouco menos que a validade de 1 hora)
    apiCache.set('spotify_token', data.access_token, 50 * 60 * 1000);
    
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
 * Verifica se a música está na lista de músicas populares fixas (mock data)
 * para casos onde a API não retorna resultados ou está indisponível
 */
const checkInStaticPopularTracks = (title: string, artist: string): SpotifyTrack | null => {
  // Lista de músicas populares pré-definidas (mock para fallback)
  const popularTracks: {[key: string]: SpotifyTrack} = {
    // Alguns exemplos - ampliar conforme necessário
    "marisa monte": {
      id: "static-1",
      name: "Ainda Bem",
      artist: "Marisa Monte",
      album: "Memórias, Crônicas e Declarações de Amor",
      albumCover: "https://i.scdn.co/image/ab67616d0000b273f8f4e0a2a1ddc1fa586bd1b1",
      popularity: 75,
      duration_ms: 0,
      explicit: false,
      preview_url: "",
      external_url: ""
    },
    "jorge e mateus": {
      id: "static-2",
      name: "Propaganda",
      artist: "Jorge & Mateus",
      album: "Os Anjos Cantam",
      albumCover: "https://i.scdn.co/image/ab67616d0000b2730c9d60c2cdbd2e6e676365b0",
      popularity: 82,
      duration_ms: 0,
      explicit: false,
      preview_url: "",
      external_url: ""
    }
  };
  
  // Verificar por correspondências aproximadas
  const searchKey = `${title} ${artist}`.toLowerCase();
  
  for (const key in popularTracks) {
    if (searchKey.includes(key)) {
      return popularTracks[key];
    }
  }
  
  return null;
};

/**
 * Busca informações de uma música no Spotify otimizada para desempenho
 * Documentação: https://developer.spotify.com/documentation/web-api/reference/search
 */
export const searchTrackOnSpotify = async (
  title: string,
  artist: string,
  accessToken: string
): Promise<SpotifyTrack | null> => {
  try {
    // Verificar cache
    const cacheKey = `spotify_track_${title.toLowerCase()}_${artist.toLowerCase()}`;
    const cachedTrack = apiCache.get<SpotifyTrack>(cacheKey);
    
    if (cachedTrack) {
      console.log(`Usando dados em cache para música: ${title} - ${artist}`);
      return cachedTrack;
    }
    
    await throttleRequest();
    
    const searchTerm = cleanSearchTerms(title, artist);
    const searchUrl = `https://api.spotify.com/v1/search?q=${searchTerm}&type=track&market=BR&limit=1`;
    
    // Apenas logar se não estivermos em um carregamento em lote
    if (!isBatchLoading) {
      console.log(`Buscando música no Spotify: ${title} - ${artist}`);
    }
    
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        
        // Aumentar o throttle para futuras requisições
        dynamicThrottleDelay = Math.max(dynamicThrottleDelay, waitTime);
        consecutiveRequests = 20; // Forçar um atraso maior nas próximas requisições
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return searchTrackOnSpotify(title, artist, accessToken);
      }
      
      // Para outros erros, verificar se temos dados estáticos de fallback
      const staticTrack = checkInStaticPopularTracks(title, artist);
      if (staticTrack) {
        console.log(`Usando dados estáticos de fallback para: ${title} - ${artist}`);
        apiCache.set(cacheKey, staticTrack, 24 * 60 * 60 * 1000); // Cache por 1 dia
        return staticTrack;
      }
      
      const errorData = await response.json();
      console.error(`Erro ao buscar música "${title} - ${artist}": ${response.status} - ${JSON.stringify(errorData)}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
      console.log(`Nenhuma música encontrada para: ${title} - ${artist}`);
      
      // Verificar dados estáticos de fallback
      const staticTrack = checkInStaticPopularTracks(title, artist);
      if (staticTrack) {
        console.log(`Usando dados estáticos de fallback para: ${title} - ${artist}`);
        apiCache.set(cacheKey, staticTrack, 24 * 60 * 60 * 1000); // Cache por 1 dia
        return staticTrack;
      }
      
      return null;
    }
    
    const track = data.tracks.items[0];
    const trackData = {
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
    
    // Armazenar em cache por 7 dias
    apiCache.set(cacheKey, trackData, 7 * 24 * 60 * 60 * 1000);
    
    return trackData;
  } catch (error) {
    console.error(`Erro ao buscar música "${title} - ${artist}":`, error);
    
    // Em caso de erro, verificar dados estáticos de fallback
    const staticTrack = checkInStaticPopularTracks(title, artist);
    if (staticTrack) {
      console.log(`Usando dados estáticos de fallback após erro para: ${title} - ${artist}`);
      const cacheKey = `spotify_track_${title.toLowerCase()}_${artist.toLowerCase()}`;
      apiCache.set(cacheKey, staticTrack, 24 * 60 * 60 * 1000); // Cache por 1 dia
      return staticTrack;
    }
    
    return null;
  }
};

/**
 * Pré-carrega dados de várias músicas em segundo plano para melhorar a experiência futura
 */
export const preloadTracksData = async (
  tracks: Array<{ title: string; artist: string }>,
  accessToken: string
): Promise<void> => {
  // Processo não bloqueante que roda em segundo plano
  setTimeout(async () => {
    console.log(`Iniciando pré-carregamento de ${tracks.length} músicas em segundo plano...`);
    
    for (const { title, artist } of tracks) {
      const cacheKey = `spotify_track_${title.toLowerCase()}_${artist.toLowerCase()}`;
      
      // Só pré-carregar se não estiver em cache
      if (!apiCache.get(cacheKey)) {
        apiCache.addToPrefetch(cacheKey);
        
        // Pausa longa entre requisições de pré-carregamento para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));
        await searchTrackOnSpotify(title, artist, accessToken);
      }
    }
    
    console.log('Pré-carregamento concluído');
  }, 100);
};

/**
 * Busca o número de plays de várias músicas no Spotify para o período selecionado
 * com otimizações de desempenho
 * Retorna um objeto com o ID da música como chave e o número formatado de plays como valor
 */
export const fetchTracksPopularity = async (
  tracks: Array<{ title: string; artist: string }>,
  startDate: string,
  endDate: string
): Promise<{ [key: string]: string }> => {
  // Verificar cache
  const tracksKey = tracks.map(t => `${t.title}|${t.artist}`).join('~');
  const cacheKey = `spotify_plays_${tracksKey}_${startDate}_${endDate}`;
  
  const cachedResults = apiCache.get<{ [key: string]: string }>(cacheKey);
  if (cachedResults) {
    console.log('Usando dados de popularidade em cache do Spotify');
    
    // Pré-carregar os dados em segundo plano para a próxima vez
    fetchSpotifyToken().then(token => {
      if (token) preloadTracksData(tracks, token);
    });
    
    return cachedResults;
  }
  
  console.log(`Buscando dados de popularidade para ${tracks.length} músicas...`);
  
  const accessToken = await fetchSpotifyToken();
  if (!accessToken) {
    console.error("Não foi possível obter token do Spotify");
    return {};
  }
  
  const result: { [key: string]: string } = {};
  
  try {
    isBatchLoading = true;
    
    // Verificar se algumas músicas já estão em cache individual
    const uncachedTracks = [];
    
    for (const track of tracks) {
      const trackKey = `${track.title}|${track.artist}`.toLowerCase();
      const trackCacheKey = `spotify_track_${track.title.toLowerCase()}_${track.artist.toLowerCase()}`;
      
      const cachedTrack = apiCache.get<SpotifyTrack>(trackCacheKey);
      if (cachedTrack) {
        result[trackKey] = popularityToPlays(cachedTrack.popularity, startDate, endDate);
      } else {
        uncachedTracks.push(track);
      }
    }
    
    console.log(`${tracks.length - uncachedTracks.length} músicas encontradas em cache, buscando ${uncachedTracks.length} restantes...`);
    
    // Processar as músicas não cacheadas em lotes menores
    const batchSize = 5;
    
    // Exibir indicador de progresso
    let progress = 0;
    const totalTracks = uncachedTracks.length;
    
    for (let i = 0; i < uncachedTracks.length; i += batchSize) {
      const batch = uncachedTracks.slice(i, i + batchSize);
      
      // Atualizar e exibir o progresso
      progress = Math.floor((i / totalTracks) * 100);
      if (progress > 0 && progress % 10 === 0) {
        console.log(`Progresso: ${progress}% (${i} de ${totalTracks})`);
      }
      
      // Processar cada música do lote em paralelo para maior velocidade
      await Promise.all(batch.map(async ({ title, artist }) => {
        const trackInfo = await searchTrackOnSpotify(title, artist, accessToken);
        
        if (trackInfo) {
          const trackKey = `${title}|${artist}`.toLowerCase();
          result[trackKey] = popularityToPlays(trackInfo.popularity, startDate, endDate);
        }
      }));
    }
    
    console.log(`Busca de popularidade concluída para ${tracks.length} músicas`);
  } finally {
    isBatchLoading = false;
  }
  
  // Armazenar resultado em cache por 1 dia
  apiCache.set(cacheKey, result, 24 * 60 * 60 * 1000);
  
  return result;
}; 