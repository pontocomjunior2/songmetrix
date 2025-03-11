import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Select from 'react-select';
import moment from 'moment';
import { supabase } from '../../lib/supabase-client';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './styles/Ranking.css';
import { fetchSpotifyToken, fetchArtistImageFromSpotify } from './services/spotify';
import { RankingItem, SpotifyTokenData, ArtistImages, RankingFilters, RadioStatus } from './types';
import { MultiValue } from 'react-select';
import { Loader2 } from 'lucide-react';

export default function Ranking() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [selectedRadios, setSelectedRadios] = useState<Array<{ value: string; label: string }>>([]);
  const [radiosOptions, setRadiosOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [filters, setFilters] = useState<RankingFilters>({
    rankingSize: '10',
    startDate: moment().subtract(10, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
    hourStart: '',
    hourEnd: '',
    selectedRadios: []
  });
  const [artistImages, setArtistImages] = useState<ArtistImages>(() => {
    const cached = localStorage.getItem('artistImages');
    return cached ? JSON.parse(cached) : {};
  });
  const [spotifyTokenData, setSpotifyTokenData] = useState<SpotifyTokenData | null>(() => {
    const storedToken = localStorage.getItem('spotifyToken');
    const storedExpiration = localStorage.getItem('spotifyTokenExpiration');
    if (storedToken && storedExpiration && Date.now() < parseInt(storedExpiration)) {
      return { token: storedToken, expiresAt: parseInt(storedExpiration) };
    }
    return null;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSpotifyToken = useCallback(async () => {
    if (spotifyTokenData && spotifyTokenData.expiresAt > Date.now()) {
      return spotifyTokenData.token;
    }

    console.log("Obtendo novo token do Spotify...");
    const newToken = await fetchSpotifyToken();
    if (newToken) {
      const expiresAt = Date.now() + 3600000; // Token expira em 1 hora
      setSpotifyTokenData({ token: newToken, expiresAt });
      localStorage.setItem('spotifyToken', newToken);
      localStorage.setItem('spotifyTokenExpiration', expiresAt.toString());
      return newToken;
    }
    return null;
  }, [spotifyTokenData]);

  const loadArtistImages = useCallback(async (data: RankingItem[]) => {
    const token = await loadSpotifyToken();
    if (!token) {
      console.error("Token Spotify não disponível. Imagens não podem ser carregadas.");
      return;
    }

    const newImages: ArtistImages = {};
    for (const item of data) {
      if (!artistImages[item.artist]) {
        try {
          const spotifyImageUrl = await fetchArtistImageFromSpotify(item.artist, token);
          if (spotifyImageUrl) {
            newImages[item.artist] = spotifyImageUrl;
          }
        } catch (error) {
          console.error(`Erro ao carregar a imagem para ${item.artist}:`, error);
        }
      }
    }

    const updatedImages = { ...artistImages, ...newImages };
    setArtistImages(updatedImages);
    localStorage.setItem('artistImages', JSON.stringify(updatedImages));
  }, [artistImages, loadSpotifyToken]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchRadios = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/status', { headers });
      if (!response.ok) throw new Error('Failed to fetch radios');
      const data: RadioStatus[] = await response.json();
      const options = data.map(radio => ({ 
        value: radio.name, 
        label: radio.name
      }));
      setRadiosOptions(options);
    } catch (error) {
      console.error('Error fetching radios:', error);
      setErrorMessage('Erro ao carregar as rádios. Por favor, tente novamente.');
    }
  };

  const fetchRanking = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      
      console.log('Rádios selecionadas:', selectedRadios);
      console.log('Parâmetro radio:', selectedRadios.length > 0 ? selectedRadios.map(r => r.value).join('||') : 'nenhuma');
      
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        rankingSize: filters.rankingSize,
        startTime: filters.hourStart,
        endTime: filters.hourEnd,
        ...(selectedRadios.length > 0 && { 
          radio: selectedRadios.map(r => r.value).join('||') 
        })
      });

      const response = await fetch(`/api/ranking?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch ranking');
      const data = await response.json();
      console.log('Dados recebidos do servidor:', data);
      
      // Verificar se os dados têm a estrutura esperada
      if (Array.isArray(data) && data.length > 0) {
        console.log('Exemplo do primeiro item:', data[0]);
        console.log('song_title está presente?', data[0].hasOwnProperty('song_title'));
        
        // Garantir que todos os campos necessários estejam presentes
        const processedData = data.map(item => ({
          ...item,
          song_title: item.song_title || item.song || 'Título não disponível'
        }));
        
        setRankingData(processedData);
      } else {
        setRankingData([]);
      }
      await loadArtistImages(data);
    } catch (error) {
      console.error('Error fetching ranking:', error);
      setErrorMessage('Erro ao carregar o ranking. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
      fetchRanking();
    }
  }, [currentUser]);

  const handleSearch = () => {
    fetchRanking();
  };

  const clearFilters = () => {
    setFilters({
      rankingSize: '10',
      startDate: moment().subtract(10, 'days').format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      hourStart: '',
      hourEnd: '',
      selectedRadios: []
    });
    setSelectedRadios([]);
  };

  return (
    <div className="ranking-container">
      <div className="ranking-filters">
        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="ranking-size">Ranking:</label>
            <select
              id="ranking-size"
              value={filters.rankingSize}
              onChange={(e) => setFilters({ ...filters, rankingSize: e.target.value })}
            >
              <option value="10">TOP 10</option>
              <option value="20">TOP 20</option>
              <option value="40">TOP 40</option>
              <option value="100">TOP 100</option>
              <option value="200">TOP 200</option>
            </select>
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="radio-select">Rádios:</label>
            <Select
              id="radio-select"
              options={radiosOptions}
              isMulti
              value={selectedRadios}
              onChange={(newValue: MultiValue<{ value: string; label: string }>) => {
                const selectedValues = newValue as { value: string; label: string }[];
                setSelectedRadios(selectedValues);
                setFilters({
                  ...filters,
                  selectedRadios: selectedValues.map(item => item.value)
                });
              }}
              placeholder="Selecione as rádios"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        </div>

        <div className="ranking-filter-row-datetime">
          <div className="ranking-filter-group">
            <label htmlFor="date-start">Data Início:</label>
            <input
              type="date"
              id="date-start"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="date-end">Data Fim:</label>
            <input
              type="date"
              id="date-end"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="hour-start">Hora Início:</label>
            <input
              type="time"
              id="hour-start"
              value={filters.hourStart}
              onChange={(e) => setFilters({ ...filters, hourStart: e.target.value })}
            />
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="hour-end">Hora Fim:</label>
            <input
              type="time"
              id="hour-end"
              value={filters.hourEnd}
              onChange={(e) => setFilters({ ...filters, hourEnd: e.target.value })}
            />
          </div>
        </div>

        <div className="ranking-filter-buttons">
          <button className="ranking-btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? "Carregando..." : "Pesquisar"}
          </button>
          <button className="ranking-btn-secondary" onClick={clearFilters}>
            Limpar Filtros
          </button>
        </div>
      </div>

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <div className="ranking-table-container">
        {loading ? (
          <div className="loading-indicator">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p>Carregando...</p>
          </div>
        ) : (
          <table className="ranking-table">
            <thead>
              <tr>
                <th className="rank-column">Rank</th>
                <th className="image-column"></th>
                <th className="artist-column">Artista</th>
                <th className="title-column">Título</th>
                <th className="genre-column">Gênero</th>
                <th className="executions-column">Execuções</th>
              </tr>
            </thead>
            <tbody>
              {rankingData.map((item, index) => (
                <tr key={item.id}>
                  <td className="rank-column">{index + 1}º</td>
                  <td className="image-column">
                    {artistImages[item.artist] ? (
                      <LazyLoadImage
                        src={artistImages[item.artist]}
                        alt={item.artist}
                        effect="blur"
                        width={50}
                        height={50}
                        style={{ borderRadius: "50%" }}
                      />
                    ) : (
                      <div style={{ width: "50px", height: "50px", backgroundColor: "#ddd", borderRadius: "50%" }}></div>
                    )}
                  </td>
                  <td className="artist-column">{item.artist}</td>
                  <td className="title-column">{item.song_title}</td>
                  <td className="genre-column">{item.genre}</td>
                  <td className="executions-column">{item.executions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && rankingData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum registro encontrado
          </div>
        )}
      </div>
    </div>
  );
}
