import { SpotifyTrack, SpotifyArtist, SpotifyPlaylist, SpotifyCategory, SpotifyFeaturedPlaylists } from '../types';

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

export const fetchSpotifyToken = async (): Promise<string | null> => {
  const tokenUrl = "https://accounts.spotify.com/api/token";

  try {
    await throttleRequest();
    
    console.log("Obtendo token do Spotify");
    
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

// Usando o endpoint Search para obter playlists - documentação: https://developer.spotify.com/documentation/web-api/reference/search
export const fetchFeaturedPlaylists = async (
  accessToken: string,
  country: string = 'BR',
  limit: number = 20
): Promise<SpotifyFeaturedPlaylists | null> => {
  try {
    await throttleRequest();
    
    // Buscando playlists populares
    console.log(`Buscando playlists populares para o país ${country} com limite ${limit}`);
    
    // Usando o endpoint de busca com termos populares
    const url = `https://api.spotify.com/v1/search?q=top&type=playlist&market=${encodeURIComponent(country)}&limit=${limit}`;
    console.log('URL da requisição:', url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar playlists populares: ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchFeaturedPlaylists(accessToken, country, limit);
      }
      
      return null;
    }

    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    if (!data.playlists || !data.playlists.items || !Array.isArray(data.playlists.items)) {
      console.error('Formato de resposta inesperado:', data);
      return null;
    }
    
    const playlists: SpotifyPlaylist[] = data.playlists.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      owner: item.owner?.display_name || 'Desconhecido',
      images: item.images?.map((img: any) => img.url) || [],
      tracks_total: item.tracks?.total || 0,
      external_url: item.external_urls?.spotify || ''
    }));

    return {
      message: 'Playlists populares',
      playlists
    };
  } catch (error) {
    console.error("Erro ao buscar playlists populares:", error);
    return null;
  }
};

// Documentação: https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks
export const fetchPlaylistTracks = async (
  accessToken: string,
  playlistId: string,
  limit: number = 50
): Promise<SpotifyTrack[] | null> => {
  try {
    await throttleRequest();
    
    console.log(`Buscando faixas da playlist ${playlistId} com limite ${limit}`);
    
    // Verificar se o ID da playlist é válido
    if (!playlistId || playlistId.trim() === '') {
      console.error('ID da playlist inválido');
      return null;
    }
    
    const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&market=BR`;
    console.log('URL da requisição:', url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar faixas da playlist: ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchPlaylistTracks(accessToken, playlistId, limit);
      }
      
      // Se a playlist não for encontrada (404), tentar buscar outra playlist via search
      if (response.status === 404) {
        console.log('Playlist não encontrada. Buscando outra playlist via search...');
        return searchAndFetchTracks(accessToken, limit);
      }
      
      return null;
    }

    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    if (!data.items || !Array.isArray(data.items)) {
      console.error('Formato de resposta inesperado:', data);
      return null;
    }
    
    const tracks: SpotifyTrack[] = data.items
      .filter((item: any) => item.track !== null)
      .map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists.map((artist: any) => artist.name).join(', '),
        album: item.track.album.name,
        albumCover: item.track.album.images[0]?.url || '',
        popularity: item.track.popularity || 0,
        duration_ms: item.track.duration_ms,
        explicit: item.track.explicit,
        preview_url: item.track.preview_url || '',
        external_url: item.track.external_urls?.spotify || ''
      }));

    return tracks;
  } catch (error) {
    console.error("Erro ao buscar faixas da playlist:", error);
    return null;
  }
};

// Função auxiliar para buscar uma playlist aleatória e suas faixas
const searchAndFetchTracks = async (
  accessToken: string,
  limit: number = 50
): Promise<SpotifyTrack[] | null> => {
  try {
    // Buscar alguma playlist popular
    const searchUrl = `https://api.spotify.com/v1/search?q=top%20hits&type=playlist&market=BR&limit=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (!searchResponse.ok) {
      console.error(`Erro ao buscar playlist alternativa: ${searchResponse.status}`);
      return null;
    }
    
    const searchData = await searchResponse.json();
    if (!searchData.playlists || !searchData.playlists.items || searchData.playlists.items.length === 0) {
      console.error('Nenhuma playlist encontrada');
      return null;
    }
    
    const playlist = searchData.playlists.items[0];
    console.log(`Encontrada playlist alternativa: ${playlist.name} (${playlist.id})`);
    
    // Buscar as faixas da playlist
    return fetchPlaylistTracks(accessToken, playlist.id, limit);
  } catch (error) {
    console.error('Erro ao buscar playlist alternativa:', error);
    return null;
  }
};

// Documentação: https://developer.spotify.com/documentation/web-api/reference/get-categories
export const fetchCategories = async (
  accessToken: string,
  country: string = 'BR',
  limit: number = 50
): Promise<SpotifyCategory[] | null> => {
  try {
    await throttleRequest();
    
    console.log(`Buscando categorias para o país ${country} com limite ${limit}`);
    
    const url = `https://api.spotify.com/v1/browse/categories?country=${encodeURIComponent(country)}&locale=pt_BR&limit=${limit}`;
    console.log('URL da requisição:', url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar categorias: ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchCategories(accessToken, country, limit);
      }
      
      return null;
    }

    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    if (!data.categories || !data.categories.items || !Array.isArray(data.categories.items)) {
      console.error('Formato de resposta inesperado:', data);
      return null;
    }
    
    const categories: SpotifyCategory[] = data.categories.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      icons: item.icons?.map((icon: any) => icon.url) || []
    }));

    return categories;
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    return null;
  }
};

// Documentação: https://developer.spotify.com/documentation/web-api/reference/get-a-categories-playlists
export const fetchCategoryPlaylists = async (
  accessToken: string,
  categoryId: string,
  country: string = 'BR',
  limit: number = 20
): Promise<SpotifyPlaylist[] | null> => {
  try {
    await throttleRequest();
    
    console.log(`Buscando playlists da categoria ${categoryId} para o país ${country} com limite ${limit}`);
    
    // Verificar se o ID da categoria é válido
    if (!categoryId || categoryId.trim() === '') {
      console.error('ID da categoria inválido');
      return null;
    }
    
    const url = `https://api.spotify.com/v1/browse/categories/${encodeURIComponent(categoryId)}/playlists?country=${encodeURIComponent(country)}&limit=${limit}`;
    console.log('URL da requisição:', url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar playlists da categoria: ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchCategoryPlaylists(accessToken, categoryId, country, limit);
      }
      
      // Se não conseguir encontrar playlists para a categoria, buscar por termos relacionados
      if (response.status === 404) {
        console.log('Categoria não encontrada ou sem playlists. Buscando playlists por termos relacionados...');
        return searchPlaylists(accessToken, categoryId, country, limit);
      }
      
      return null;
    }

    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    if (!data.playlists || !data.playlists.items || !Array.isArray(data.playlists.items)) {
      console.error('Formato de resposta inesperado:', data);
      return searchPlaylists(accessToken, categoryId, country, limit);
    }
    
    const playlists: SpotifyPlaylist[] = data.playlists.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      owner: item.owner?.display_name || 'Desconhecido',
      images: item.images?.map((img: any) => img.url) || [],
      tracks_total: item.tracks?.total || 0,
      external_url: item.external_urls?.spotify || ''
    }));

    return playlists;
  } catch (error) {
    console.error("Erro ao buscar playlists da categoria:", error);
    return null;
  }
};

// Função para buscar playlists usando o endpoint de search
const searchPlaylists = async (
  accessToken: string,
  searchTerm: string,
  country: string = 'BR',
  limit: number = 20
): Promise<SpotifyPlaylist[] | null> => {
  try {
    await throttleRequest();
    
    console.log(`Buscando playlists com o termo "${searchTerm}" para o país ${country} com limite ${limit}`);
    
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchTerm)}&type=playlist&market=${encodeURIComponent(country)}&limit=${limit}`;
    console.log('URL da requisição:', url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar playlists por termo: ${response.status} - ${JSON.stringify(errorData)}`);
      return null;
    }

    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    if (!data.playlists || !data.playlists.items || !Array.isArray(data.playlists.items)) {
      console.error('Formato de resposta inesperado:', data);
      return null;
    }
    
    const playlists: SpotifyPlaylist[] = data.playlists.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      owner: item.owner?.display_name || 'Desconhecido',
      images: item.images?.map((img: any) => img.url) || [],
      tracks_total: item.tracks?.total || 0,
      external_url: item.external_urls?.spotify || ''
    }));

    return playlists;
  } catch (error) {
    console.error(`Erro ao buscar playlists com o termo "${searchTerm}":`, error);
    return null;
  }
};

// Documentação: https://developer.spotify.com/documentation/web-api/reference/get-new-releases
export const fetchNewReleases = async (
  accessToken: string,
  country: string = 'BR',
  limit: number = 20
): Promise<SpotifyPlaylist[] | null> => {
  try {
    await throttleRequest();
    
    console.log(`Buscando novos lançamentos para o país ${country} com limite ${limit}`);
    
    const url = `https://api.spotify.com/v1/browse/new-releases?country=${encodeURIComponent(country)}&limit=${limit}`;
    console.log('URL da requisição:', url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar novos lançamentos: ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchNewReleases(accessToken, country, limit);
      }
      
      return null;
    }

    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    if (!data.albums || !data.albums.items || !Array.isArray(data.albums.items)) {
      console.error('Formato de resposta inesperado:', data);
      return null;
    }
    
    const albums: SpotifyPlaylist[] = data.albums.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.artists ? `Álbum de ${item.artists.map((artist: any) => artist.name).join(', ')}` : '',
      owner: item.artists && item.artists[0] ? item.artists[0].name : 'Desconhecido',
      images: item.images?.map((img: any) => img.url) || [],
      tracks_total: item.total_tracks || 0,
      external_url: item.external_urls?.spotify || ''
    }));

    return albums;
  } catch (error) {
    console.error("Erro ao buscar novos lançamentos:", error);
    return null;
  }
};

export const getCountries = (): { code: string; name: string }[] => {
  return [
    { code: 'BR', name: 'Brasil' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'GB', name: 'Reino Unido' },
    { code: 'ES', name: 'Espanha' },
    { code: 'FR', name: 'França' },
    { code: 'IT', name: 'Itália' },
    { code: 'DE', name: 'Alemanha' },
    { code: 'JP', name: 'Japão' },
    { code: 'AU', name: 'Austrália' },
    { code: 'CA', name: 'Canadá' },
    { code: 'MX', name: 'México' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colômbia' },
    { code: 'PT', name: 'Portugal' }
  ];
}; 