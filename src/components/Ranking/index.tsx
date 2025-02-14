import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSpotifyToken, fetchArtistImageFromSpotify } from './services/spotify';
import './styles/Ranking.css';

interface RankingApiItem {
  id: number;
  rank: number;
  artist: string;
  song_title: string;
  genre: string;
  executions: number;
}

interface RankingItem {
  id: number;
  rank: number;
  artist: string;
  artistImage: string;
  song: string;
  genre: string;
  executions: number;
}

interface RadioOption {
  value: string;
  label: string;
}

export default function Ranking() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [radios, setRadios] = useState<RadioOption[]>([]);

  // Estados dos filtros
  const [selectedRanking, setSelectedRanking] = useState('10');
  const [selectedRadio, setSelectedRadio] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 10), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [timeRange, setTimeRange] = useState({
    startTime: '',
    endTime: ''
  });

  const getAuthHeaders = async () => {
    const token = await currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  // Carregar dados das rádios
  useEffect(() => {
    const fetchRadios = async () => {
      if (!currentUser) return;
      
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/radios', { headers });
        if (!response.ok) throw new Error('Falha ao carregar rádios');
        
        const data = await response.json();
        setRadios(data.map((radio: string) => ({
          value: radio,
          label: radio
        })));
      } catch (error) {
        console.error('Erro ao carregar rádios:', error);
        setError('Não foi possível carregar a lista de rádios.');
      }
    };

    fetchRadios();
  }, [currentUser]);

  // Carregar dados do ranking
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [artistImages, setArtistImages] = useState<{ [key: string]: string }>({});

  // Buscar token do Spotify
  useEffect(() => {
    const getSpotifyToken = async () => {
      const token = await fetchSpotifyToken();
      setSpotifyToken(token);
    };
    getSpotifyToken();
  }, []);

  const fetchArtistImages = async () => {
    if (!spotifyToken || !rankingData.length) return;

    const newImages: { [key: string]: string } = {};
    const artistsToFetch = rankingData.filter(item => !artistImages[item.artist]);

    // Buscar imagens em lotes de 5 para evitar muitas requisições simultâneas
    for (let i = 0; i < artistsToFetch.length; i += 5) {
      const batch = artistsToFetch.slice(i, i + 5);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const imageUrl = await fetchArtistImageFromSpotify(item.artist, spotifyToken);
            if (imageUrl) {
              newImages[item.artist] = imageUrl;
            }
          } catch (error) {
            console.error(`Erro ao buscar imagem para ${item.artist}:`, error);
          }
        })
      );

      if (Object.keys(newImages).length > 0) {
        setArtistImages(prev => ({ ...prev, ...newImages }));
      }
    }

    // Atualizar o ranking com todas as novas imagens
    if (Object.keys(newImages).length > 0) {
      setRankingData(current => 
        current.map(item => ({
          ...item,
          artistImage: newImages[item.artist] || artistImages[item.artist] || 'https://via.placeholder.com/80'
        }))
      );
    }
  };

  // Buscar imagens dos artistas quando o ranking mudar
  useEffect(() => {
    if (spotifyToken && rankingData.length > 0) {
      const newArtists = rankingData.filter(item => !artistImages[item.artist]);
      if (newArtists.length > 0) {
        const timer = setTimeout(() => {
          fetchArtistImages();
        }, 500); // Pequeno delay para evitar múltiplas requisições
        return () => clearTimeout(timer);
      }
    }
  }, [rankingData, spotifyToken, artistImages]);

  const fetchRankingData = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        rankingSize: selectedRanking,
        radio: selectedRadio,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime
      });

      const response = await fetch(`/api/ranking?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Falha ao carregar ranking');

      const data = await response.json() as RankingApiItem[];
      const rankingWithImages = data.map(item => ({
        id: item.id,
        rank: item.rank,
        artist: item.artist,
        song: item.song_title,
        genre: item.genre,
        executions: item.executions,
        artistImage: artistImages[item.artist] || 'https://via.placeholder.com/80'
      }));
      setRankingData(rankingWithImages);
      // Trigger image fetch for new artists
      if (spotifyToken) {
        const newArtists = rankingWithImages.filter(item => !artistImages[item.artist]);
        if (newArtists.length > 0) {
          fetchArtistImages();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
      setError('Não foi possível carregar o ranking. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRankingData();
  };

  const handleClearFilters = () => {
    setSelectedRanking('10');
    setSelectedRadio('');
    setDateRange({
      startDate: format(subDays(new Date(), 10), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });
    setTimeRange({
      startTime: '',
      endTime: ''
    });
  };

  return (
    <div className="ranking-container">
      {/* Filtros */}
      <div className="ranking-filters">
        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="ranking-size">Ranking:</label>
            <select
              id="ranking-size"
              value={selectedRanking}
              onChange={(e) => setSelectedRanking(e.target.value)}
            >
              <option value="10">TOP 10</option>
              <option value="20">TOP 20</option>
              <option value="40">TOP 40</option>
              <option value="100">TOP 100</option>
              <option value="200">TOP 200</option>
            </select>
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="radio">Rádios:</label>
            <select
              id="radio"
              value={selectedRadio}
              onChange={(e) => setSelectedRadio(e.target.value)}
            >
              <option value="">Todas as Rádios</option>
              {radios.map((radio) => (
                <option key={radio.value} value={radio.value}>
                  {radio.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="start-date">Data Início:</label>
            <input
              type="date"
              id="start-date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="end-date">Data Fim:</label>
            <input
              type="date"
              id="end-date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="start-time">Hora Início:</label>
            <input
              type="time"
              id="start-time"
              value={timeRange.startTime}
              onChange={(e) => setTimeRange({ ...timeRange, startTime: e.target.value })}
            />
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="end-time">Hora Fim:</label>
            <input
              type="time"
              id="end-time"
              value={timeRange.endTime}
              onChange={(e) => setTimeRange({ ...timeRange, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="ranking-filter-buttons">
          <button 
            className="ranking-btn-primary"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Pesquisar'}
          </button>
          <button 
            className="ranking-btn-secondary"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading ? (
        <div className="loading-indicator">
          <div className="spinner" />
          <p className="mt-2">Carregando...</p>
        </div>
      ) : (
        /* Tabela de resultados */
        <div className="ranking-table-container">
          <table className="ranking-table">
            <thead>
              <tr>
                <th className="rank-column">Rank</th>
                <th className="image-column"></th>
                <th className="artist-column">Artista</th>
                <th className="title-column">Música</th>
                <th className="genre-column">Gênero</th>
                <th className="executions-column">Execuções</th>
              </tr>
            </thead>
            <tbody>
              {rankingData.map((item) => (
                <tr key={item.id}>
                  <td className="rank-column">{item.rank}</td>
                  <td className="w-28 p-3">
                    <div className="relative w-20 h-20 overflow-hidden group">
                      <div 
                        className={`absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse transition-opacity duration-500 ${
                          artistImages[item.artist] ? 'opacity-0' : 'opacity-100'
                        }`}
                      >
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      </div>
                      <img
                        src={item.artistImage}
                        alt={item.artist}
                        className={`absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg transition-all duration-500 transform hover:scale-105 ${
                          artistImages[item.artist] ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                    </div>
                  </td>
                  <td className="artist-column px-6">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">
                        {item.artist}
                      </span>
                    </div>
                  </td>
                  <td className="title-column px-6">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white">{item.song_title}</span>
                    </div>
                  </td>
                  <td className="genre-column px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                      {item.genre}
                    </span>
                  </td>
                  <td className="executions-column px-4 text-right font-medium">
                    {item.executions.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
