import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Loader2, ChevronDown, ChevronRight, Music2, History, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase-client';
import { RadioStatus } from '../types/components';
import './RealTime/styles/RealTime.css';
import Select from 'react-select';
import { SingleValue } from 'react-select';

interface SelectOption {
  value: string;
  label: string;
}

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

  const radioOptions = useMemo(() => {
    const options: SelectOption[] = [{ value: '', label: 'Todas as Rádios' }];
    radios.forEach(radio => {
      options.push({ value: radio.name, label: radio.name });
    });
    return options;
  }, [radios]);

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
      const cachedRadios = localStorage.getItem('realtime_radios_cache');
      const cacheTime = localStorage.getItem('realtime_radios_cache_time');
      
      if (cachedRadios && cacheTime) {
        const cacheDuration = Date.now() - parseInt(cacheTime);
        if (cacheDuration < 5 * 60 * 1000) {
          console.log('Usando cache para rádios');
          setRadios(JSON.parse(cachedRadios));
          fetchAndUpdateCache();
          return;
        }
      }
      
      await fetchAndUpdateCache();
    } catch (error) {
      console.error('Error fetching radios:', error);
      
      provideFallbackData();
    }
  };
  
  const fetchAndUpdateCache = async () => {
    try {
      const headers = await getAuthHeaders();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch('/api/radios/status', { 
        headers, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error('Failed to fetch radios');
      
      const data: RadioStatus[] = await response.json();
      
      if (!data || data.length === 0) {
        console.warn('API retornou array vazio para rádios');
        provideFallbackData();
        return;
      }
      
      setRadios(data);
      localStorage.setItem('realtime_radios_cache', JSON.stringify(data));
      localStorage.setItem('realtime_radios_cache_time', Date.now().toString());
    } catch (error) {
      console.error('Error in fetchAndUpdateCache:', error);
      throw error;
    }
  };
  
  const provideFallbackData = () => {
    const isDevelopment = import.meta.env.MODE === 'development';
    console.log('Fornecendo dados de fallback para rádios');
    
    const oldCache = localStorage.getItem('realtime_radios_cache');
    if (oldCache) {
      console.log('Usando cache antigo para rádios');
      setRadios(JSON.parse(oldCache));
      return;
    }
    
    const mockRadios: RadioStatus[] = [
      { name: 'Rádio 1', status: 'ONLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 2', status: 'OFFLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 3', status: 'ONLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 4', status: 'ONLINE', isFavorite: false, lastUpdate: new Date().toISOString() },
      { name: 'Rádio 5', status: 'OFFLINE', isFavorite: false, lastUpdate: new Date().toISOString() }
    ];
    
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
    <div className={`realtime-container ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
      <div className={`flex-none p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg mb-4`}>
        <form onSubmit={handleSearch} className="realtime-filters">
          <div className="realtime-filter-row">
            <div className="realtime-filter-group">
              <label>Rádio:</label>
              <Select<SelectOption>
                className="react-select-container"
                classNamePrefix="react-select"
                value={radioOptions.find(option => option.value === filters.radio)}
                onChange={(option: SingleValue<SelectOption>) => {
                  setFilters({ ...filters, radio: option?.value ?? '' });
                }}
                options={radioOptions}
                placeholder="Selecione ou digite para buscar..."
                isSearchable={true}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    backgroundColor: isDarkMode ? '#374151' : base.backgroundColor,
                    borderColor: state.isFocused ? '#2563eb' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                    borderRadius: '0.375rem',
                    boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : base.boxShadow,
                    minHeight: '38px',
                    height: '38px',
                    boxSizing: 'border-box',
                    transition: base.transition,
                    '&:hover': {
                       borderColor: state.isFocused ? '#2563eb' : (isDarkMode ? '#6B7280' : '#9CA3AF'),
                    }
                  }),
                  valueContainer: (base) => ({
                      ...base,
                      padding: '2px 0.6rem', 
                  }),
                  input: (base) => ({
                    ...base,
                    color: isDarkMode ? '#D1D5DB' : base.color,
                    margin: '0px',
                    paddingTop: '0px', 
                    paddingBottom: '0px',
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: isDarkMode ? '#6B7280' : '#9CA3AF',
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: isDarkMode ? '#D1D5DB' : base.color,
                    position: 'relative',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: isDarkMode ? '#374151' : base.backgroundColor,
                    zIndex: 9999,
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? (isDarkMode ? '#2563eb' : '#2563eb') : state.isFocused ? (isDarkMode ? '#4B5563' : '#E5E7EB') : (isDarkMode ? '#374151' : base.backgroundColor),
                    color: state.isSelected ? '#FFFFFF' : (isDarkMode ? '#D1D5DB' : base.color),
                    ':active': {
                      ...base[':active'],
                      backgroundColor: !state.isDisabled ? (state.isSelected ? base.backgroundColor : (isDarkMode ? '#5A6679' : base[':active']?.backgroundColor)) : undefined,
                    },
                  }),
                }}
              />
            </div>
            <div className="realtime-filter-group">
              <label>Artista</label>
              <input
                type="text"
                className="realtime-filter-input"
                value={filters.artist}
                onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
                placeholder="Nome do artista"
              />
            </div>
            <div className="realtime-filter-group">
              <label>Música</label>
              <input
                type="text"
                className="realtime-filter-input"
                value={filters.song}
                onChange={(e) => setFilters({ ...filters, song: e.target.value })}
                placeholder="Nome da música"
              />
            </div>
          </div>
          <div className="realtime-filter-row">
            <div className="realtime-filter-group">
              <label>Data Inicial</label>
              <input
                type="date"
                className="realtime-filter-input"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="realtime-filter-group">
              <label>Data Final</label>
              <input
                type="date"
                className="realtime-filter-input"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="realtime-filter-group">
              <label>Hora Inicial</label>
              <input
                type="time"
                className="realtime-filter-input"
                value={filters.startTime}
                onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
              />
            </div>
            <div className="realtime-filter-group">
              <label>Hora Final</label>
              <input
                type="time"
                className="realtime-filter-input"
                value={filters.endTime}
                onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button 
              type="button" 
              onClick={clearFilters} 
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800 mr-4 transition-colors duration-150 ease-in-out"
            >
              Limpar Filtros
            </button>
            <button 
              type="submit" 
              className="inline-flex items-center justify-center gap-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
              disabled={loading}
            >
              {loading ? 
                <Loader2 className="w-4 h-4 animate-spin" /> : 
                <Search className="w-4 h-4" />
              } 
              Buscar
            </button>
          </div>
        </form>
      </div>
      <div className={`overflow-auto rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rádio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Artista</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Música</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading && executions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10">
                  <div className="flex justify-center items-center">
                    <Loader2 className="w-6 h-6 animate-spin text-navy-600" />
                    <span className="ml-2 text-gray-500 dark:text-gray-400">Carregando execuções...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && executions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                  Nenhuma execução encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
            {executions.map((exec) => (
              <React.Fragment key={exec.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => toggleRow(exec.id)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                      {expandedRow === exec.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDisplayDate(exec.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{exec.time}</td>
                  <td className="px-4 py-3 text-sm font-medium">{exec.radio_name}</td>
                  <td className="px-4 py-3 text-sm">{exec.artist}</td>
                  <td className="px-4 py-3 text-sm">{exec.song_title}</td>
                </tr>
                {expandedRow === exec.id && (
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <td colSpan={6} className="p-4 text-sm">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><strong>Cidade:</strong> {exec.city || 'N/A'}</div>
                        <div><strong>Estado:</strong> {exec.state || 'N/A'}</div>
                        <div><strong>Região:</strong> {exec.region || 'N/A'}</div>
                        <div><strong>Gênero:</strong> {exec.genre || 'N/A'}</div>
                        <div><strong>Segmento:</strong> {exec.segment || 'N/A'}</div>
                        <div><strong>Gravadora:</strong> {exec.label || 'N/A'}</div>
                        <div><strong>ISRC:</strong> {exec.isrc || 'N/A'}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {loading && executions.length > 0 && (
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 animate-spin inline-block text-navy-600" />
          </div>
        )}
        {!loading && hasMore && (
           <div className="text-center py-4">
             <button onClick={() => fetchExecutions()} className="realtime-btn-secondary">
               Carregar Mais
             </button>
           </div>
         )}
      </div>
    </div>
  );
}
