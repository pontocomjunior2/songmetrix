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

// Documentação: https://developer.spotify.com/documentation/web-api/reference/get-an-access-token
export const fetchSpotifyToken = async () => {
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

// Função para limpar caracteres especiais e preparar o nome do artista para busca
// Documentação: https://developer.spotify.com/documentation/web-api/reference/search
const cleanArtistName = (artistName: string): string => {
  let cleanedName = artistName.replace(/&/g, "and").replace(/\se\s/g, " ");
  cleanedName = cleanedName.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return encodeURIComponent(cleanedName.trim());
};

// Busca imagem do artista no Spotify
export const fetchArtistImageFromSpotify = async (artistName: string, accessToken: string): Promise<string | null> => {
  if (!accessToken) {
    console.error("Token Spotify inválido ou não disponível.");
    return null;
  }

  try {
    await throttleRequest();
    
    const cleanedArtistName = cleanArtistName(artistName);
    const searchUrl = `https://api.spotify.com/v1/search?q=${cleanedArtistName}&type=artist&market=BR&limit=1`;
    
    console.log(`Buscando imagem para o artista: ${artistName}`);
    console.log('URL da requisição:', searchUrl);

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Erro ao buscar imagem para ${artistName}: ${response.status} - ${JSON.stringify(errorData)}`);
      
      // Se tivermos um erro de rate limit, vamos esperar um pouco mais
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limit excedido. Aguardando ${waitTime}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return fetchArtistImageFromSpotify(artistName, accessToken);
      }
      
      return null;
    }

    const data = await response.json();
    if (data.artists && data.artists.items && data.artists.items.length > 0) {
      const artist = data.artists.items[0];
      const imageUrl = artist.images && artist.images.length > 0 ? artist.images[0].url : null;
      console.log(`Imagem encontrada para ${artistName}: ${imageUrl ? 'Sim' : 'Não'}`);
      return imageUrl;
    }
    
    console.log(`Nenhum artista encontrado para: ${artistName}`);
    return null;
  } catch (error) {
    console.error(`Erro ao buscar imagem para o artista ${artistName}:`, error);
    return null;
  }
};
