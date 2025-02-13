import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import './styles/Ranking.css';

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

      const data = await response.json();
      
      // Simular dados para demonstração
      const mockData: RankingItem[] = [
        {
          id: 1,
          rank: 1,
          artist: "Israel & Rodolfo",
          artistImage: "https://example.com/artist1.jpg",
          song: "Arruma Um Bão",
          genre: "Sertanejo",
          executions: 311
        },
        {
          id: 2,
          rank: 2,
          artist: "Maiara & Maraisa",
          artistImage: "https://example.com/artist2.jpg",
          song: "Vai Lá (Ao Vivo em Goiânia)",
          genre: "Sertanejo",
          executions: 301
        },
        {
          id: 3,
          rank: 3,
          artist: "Gusttavo Lima",
          artistImage: "https://example.com/artist3.jpg",
          song: "A Noite (La Notte) [Ao Vivo]",
          genre: "Sertanejo",
          executions: 300
        }
      ];

      setRankingData(mockData);
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
                  <td className="image-column">
                    <img
                      src={item.artistImage}
                      alt={item.artist}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40';
                      }}
                    />
                  </td>
                  <td className="artist-column">{item.artist}</td>
                  <td className="title-column">{item.song}</td>
                  <td className="genre-column">{item.genre}</td>
                  <td className="executions-column">{item.executions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
