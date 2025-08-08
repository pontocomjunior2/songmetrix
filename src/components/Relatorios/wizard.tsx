// Importar o componente PopularityIndicator e o serviço de popularidade
import PopularityIndicator from './components/PopularityIndicator';
import { fetchAllPopularityData, PopularityData } from './services/popularity';

// Atualizar a interface de dados do relatório para incluir os dados de popularidade
interface ReportData {
  // ... existing fields ...
  spotify?: {
    popularity: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  youtube?: {
    popularity: number;
    trend: 'up' | 'down' | 'stable'; 
    trendPercentage: number;
  };
}

// Função para buscar dados do Spotify
const fetchSpotifyData = async (songs: Song[], startDate: string, endDate: string): Promise<{ [key: string]: any }> => {
  if (!includeSpotifyData) return {};
  
  console.log(`Buscando dados do Spotify para o período: ${startDate} a ${endDate}`);
  
  // Converter lista de músicas para o formato esperado
  const tracks = songs.map(song => ({
    title: song.title,
    artist: song.artist
  }));
  
  try {
    // Buscar dados de popularidade
    const popularityData = await fetchAllPopularityData(tracks, startDate, endDate);
    
    // Mapear os dados para o formato esperado
    const result: { [key: string]: any } = {};
    
    songs.forEach(song => {
      const trackKey = `${song.title}|${song.artist}`.toLowerCase();
      const spotifyPopularity = popularityData.spotify[trackKey];
      const youtubePopularity = popularityData.youtube[trackKey];
      
      // Criar um objeto com as chaves que combinam title_artist (sem espaços)
      const songKey = `${song.title}_${song.artist}`.replace(/\s+/g, '').toLowerCase();
      
      if (spotifyPopularity) {
        result[songKey] = {
          spotify: {
            popularity: spotifyPopularity.score,
            trend: spotifyPopularity.trend,
            trendPercentage: spotifyPopularity.trendPercentage
          },
          youtube: youtubePopularity ? {
            popularity: youtubePopularity.score,
            trend: youtubePopularity.trend,
            trendPercentage: youtubePopularity.trendPercentage
          } : undefined
        };
      }
    });
    
    console.log('Dados do Spotify e YouTube obtidos com sucesso:', result);
    return result;
  } catch (error) {
    console.error('Erro ao buscar dados do Spotify:', error);
    return {};
  }
};

// Na função que gera o relatório, atualizar para incluir os novos dados
const generateReport = async () => {
  // ... existing code ...
  
  // Buscar dados do Spotify
  const spotifyData = await fetchSpotifyData(songs, formattedStartDate, formattedEndDate);
  
  // ... existing code ...
  
  // Atualizar a função para mapear os dados com a popularidade
  const reportData: ReportData[] = songs.map(song => {
    const songKey = `${song.title}_${song.artist}`.replace(/\s+/g, '').toLowerCase();
    const onlineData = spotifyData[songKey] || {};
    
    return {
      // ... existing fields ...
      spotify: onlineData.spotify,
      youtube: onlineData.youtube
    };
  });
  
  // ... existing code ...
};

// No componente que renderiza a tabela do relatório, atualizar para mostrar o PopularityIndicator
// Exemplo de como seria na coluna do Spotify:
{includeSpotifyData && (
  <td className="px-4 py-2 whitespace-nowrap">
    {row.spotify ? (
      <PopularityIndicator 
        type="spotify"
        popularity={row.spotify.popularity}
        trend={row.spotify.trend}
        trendPercentage={row.spotify.trendPercentage}
        showSparkline={false}
      />
    ) : (
      <span className="text-gray-400 dark:text-gray-500">-</span>
    )}
  </td>
)}

// Exemplo de como seria na coluna do YouTube:
{includeSpotifyData && (
  <td className="px-4 py-2 whitespace-nowrap">
    {row.youtube ? (
      <PopularityIndicator 
        type="youtube"
        popularity={row.youtube.popularity}
        trend={row.youtube.trend}
        trendPercentage={row.youtube.trendPercentage}
        showSparkline={false}
      />
    ) : (
      <span className="text-gray-400 dark:text-gray-500">-</span>
    )}
  </td>
)}

// ... existing code ... 