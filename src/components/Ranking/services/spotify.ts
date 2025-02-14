const SPOTIFY_CLIENT_ID = "6454790e98c04c22b3fecc25dcd9e75c";
const SPOTIFY_CLIENT_SECRET = "b9d28568c7e04ad79735bf8fddb750ed";

export const fetchSpotifyToken = async () => {
  const tokenUrl = "https://accounts.spotify.com/api/token";

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET),
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      console.error(`Erro ao buscar token do Spotify: ${response.status} - ${errorDetails.error.message}`);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Erro ao buscar o token do Spotify:", error);
    return null;
  }
};

const cleanArtistName = (artistName: string): string => {
  let cleanedName = artistName.replace(/&/g, "and").replace(/\se\s/g, " ");
  cleanedName = cleanedName.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return encodeURIComponent(cleanedName.trim());
};

export const fetchArtistImageFromSpotify = async (artistName: string, accessToken: string): Promise<string | null> => {
  if (!accessToken) {
    console.error("Token Spotify inválido ou não disponível.");
    return null;
  }

  const cleanedArtistName = cleanArtistName(artistName);
  const searchUrl = `https://api.spotify.com/v1/search?q=${cleanedArtistName}&type=artist&limit=1`;

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      console.error(`Erro ao buscar imagem para ${artistName}: ${response.status} - ${errorDetails.error.message}`);
      return null;
    }

    const data = await response.json();
    if (data.artists && data.artists.items.length > 0) {
      const artist = data.artists.items[0];
      return artist.images.length > 0 ? artist.images[0].url : null;
    }
  } catch (error) {
    console.error(`Erro ao buscar imagem para o artista ${artistName}:`, error);
  }

  return null;
};
