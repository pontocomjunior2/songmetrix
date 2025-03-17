import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase-client';
import { RadioStatus } from '../types/components';
import './RealTime/styles/RealTime.css';

interface Filters {
  radio: string;
  artist: string;
  song: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

interface Execution {
  id: number;
  date: string;
  time: string;
  radio_name: string;
  artist: string;
  song_title: string;
  isrc: string;
  city: string;
  state: string;
  genre: string;
  region: string;
  segment: string;
  label: string;
}

export default function RealTime() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const today = format(new Date(), 'yyyy-MM-dd');
  const [filters, setFilters] = useState<Filters>({
    radio: '',
    artist: '',
    song: '',
    startDate: today,
    endDate: today,
    startTime: '00:00',
    endTime: '23:59',
  });
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [radios, setRadios] = useState<RadioStatus[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedRadio, setExpandedRadio] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
      fetchExecutions();
    }
  }, [currentUser]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchRadios = async () => {
    const isDevelopment = import.meta.env.MODE === 'development';
    console.log('Ambiente em RealTime:', import.meta.env.MODE);
    
    try {
      // Tentar obter do cache primeiro
      const cachedRadios = localStorage.getItem('realtime_radios_cache');
      const cacheTime = localStorage.getItem('realtime_radios_cache_time');
      
      // Se temos cache válido (menos de 5 minutos)
      if (cachedRadios && cacheTime) {
        const cacheDuration = Date.now() - parseInt(cacheTime);
        if (cacheDuration < 5 * 60 * 1000) { // 5 minutos
          console.log('Usando cache para rádios');
          setRadios(JSON.parse(cachedRadios));
          // Fetch em segundo plano para atualizar cache
          fetchAndUpdateCache();
          return;
        }
      }
      
      // Se não há cache ou está expirado, fazer a requisição normalmente
      await fetchAndUpdateCache();
    } catch (error) {
      console.error('Error fetching radios:', error);
      
      // Usar dados de fallback
      provideFallbackData();
    }
  };
  
  // Função para buscar dados e atualizar o cache
  const fetchAndUpdateCache = async () => {
    try {
      const headers = await getAuthHeaders();
      
      // Adicionar timeout para a requisição
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout
      
      const response = await fetch('/api/radios/status', { 
        headers, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('Failed to fetch radios');
      
      const data: RadioStatus[] = await response.json();
      
      // Se a resposta estiver vazia, usar fallback
      if (!data || data.length === 0) {
        console.warn('API retornou array vazio para rádios');
        provideFallbackData();
        return;
      }
      
      // Atualizar estado e cache
      setRadios(data);
      localStorage.setItem('realtime_radios_cache', JSON.stringify(data));
      localStorage.setItem('realtime_radios_cache_time', Date.now().toString());
    } catch (error) {
      console.error('Error in fetchAndUpdateCache:', error);
      throw error; // Propagar o erro para ser tratado na função principal
    }
  };
  
  // Função para fornecer dados de fallback
  const provideFallbackData = () => {
    const isDevelopment = import.meta.env.MODE === 'development';
    console.log('Fornecendo dados de fallback para rádios');
    
    // Usar cache antigo se disponível
    const oldCache = localStorage.getItem('realtime_radios_cache');
    if (oldCache) {
      console.log('Usando cache antigo para rádios');
      setRadios(JSON.parse(oldCache));
      return;
    }
    
    // Se não há cache, criar dados fictícios
    const mockRadios: RadioStatus[] = [
      { name: 'Rádio 1', status: 'ONLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 2', status: 'OFFLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 3', status: 'ONLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 4', status: 'ONLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 5', status: 'OFFLINE', isFavorite: false, lastUpdate: new Date().toISOString() }
    ];
    
    // Em desenvolvimento, adicionar mais dados
    if (isDevelopment) {
      mockRadios.push(
        { name: 'Rádio Dev 1', status: 'ONLINE', isFavorite: true, lastUpdate: new Date().toISOString() },
        { name: 'Rádio Dev 2', status: 'ONLINE', isFavorite: true, lastUpdate: new Date().toISOString() }
      );
    }
    
    setRadios(mockRadios);
  };

  const fetchExecutions = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    const currentPage = reset ? 0 : page;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filters: {
            ...filters,
            radio: filters.radio === 'Todas as Rádios' ? '' : filters.radio
          },
          page: currentPage,
        }),
      });
      if (!response.ok) throw new Error('Failed to fetch executions');
      const data = await response.json();
      if (Array.isArray(data)) {
        setExecutions(reset ? data : [...executions, ...data]);
        setHasMore(data.length === 100);
        if (!reset) setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setExecutions([]);
    setPage(0);
    setHasMore(true);
    fetchExecutions(true);
  };

  const clearFilters = () => {
    setFilters({
      radio: '',
      artist: '',
      song: '',
      startDate: today,
      endDate: today,
      startTime: '00:00',
      endTime: '23:59',
    });
  };

  const validateDates = () => {
    const start = new Date(`${filters.startDate} ${filters.startTime}`);
    const end = new Date(`${filters.endDate} ${filters.endTime}`);
    return start <= end;
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateStr;
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const toggleRadio = (id: number) => {
    setExpandedRadio(expandedRadio === id ? null : id);
  };

  return (
    <div className="realtime-container">
      <div className="realtime-filters">
        <form onSubmit={handleSearch}>
          <div className="realtime-filter-row">
            <div className="realtime-filter-group">
              <label htmlFor="radio-select">Rádio</label>
              <select
                id="radio-select"
                value={filters.radio}
                onChange={(e) => setFilters({ ...filters, radio: e.target.value })}
              >
                <option value="">Todas as Rádios</option>
                {radios.map((radio) => (
                  <option key={radio.name} value={radio.name}>
                    {radio.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="artist-input">Artista</label>
              <input
                id="artist-input"
                type="text"
                value={filters.artist}
                onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
                placeholder="Nome do artista"
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="song-input">Música</label>
              <input
                id="song-input"
                type="text"
                value={filters.song}
                onChange={(e) => setFilters({ ...filters, song: e.target.value })}
                placeholder="Nome da música"
              />
            </div>
          </div>
          <div className="realtime-filter-row-datetime">
            <div className="realtime-filter-group">
              <label htmlFor="start-date">Data Inicial</label>
              <input
                id="start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="end-date">Data Final</label>
              <input
                id="end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="start-time">Hora Inicial</label>
              <input
                id="start-time"
                type="time"
                value={filters.startTime}
                onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="end-time">Hora Final</label>
              <input
                id="end-time"
                type="time"
                value={filters.endTime}
                onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="realtime-filter-buttons">
            <button
              type="submit"
              disabled={!validateDates()}
              className="realtime-btn-primary"
            >
              Pesquisar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="realtime-btn-secondary"
            >
              Limpar Filtros
            </button>
          </div>
        </form>
      </div>
      <div className="realtime-table-container">
        <table className="realtime-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Rádio</th>
              <th>Artista</th>
              <th>Música</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution) => (
              <React.Fragment key={execution.id}>
                <tr>
                  <td>{formatDisplayDate(execution.date)} {execution.time}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRadio(execution.id)}
                        className="flex-none text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {expandedRadio === execution.id ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <span>{execution.radio_name}</span>
                    </div>
                    {expandedRadio === execution.id && (
                      <div className="mt-2 pl-7 text-sm text-gray-600 dark:text-gray-400">
                        <div>Cidade: {execution.city}</div>
                        <div>Estado: {execution.state}</div>
                        <div>Região: {execution.region}</div>
                      </div>
                    )}
                  </td>
                  <td>{execution.artist}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRow(execution.id)}
                        className="flex-none text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {expandedRow === execution.id ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <span>{execution.song_title}</span>
                    </div>
                    {expandedRow === execution.id && (
                      <div className="mt-2 pl-7 text-sm text-gray-600 dark:text-gray-400">
                        <div>ISRC: {execution.isrc}</div>
                        <div>Gravadora: {execution.label}</div>
                        <div>Gênero: {execution.genre}</div>
                      </div>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {loading && executions.length === 0 ? (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : hasMore ? (
          <div className="flex justify-center p-4">
            <button
              onClick={() => fetchExecutions()}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Carregar mais
            </button>
          </div>
        ) : executions.length > 0 ? (
          <div className="text-center p-4 text-gray-500 dark:text-gray-400">
            Fim dos resultados
          </div>
        ) : (
          <div className="text-center p-4 text-gray-500 dark:text-gray-400">
            Nenhum resultado encontrado
          </div>
        )}
      </div>
    </div>
  );
}
