import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Loader2, ChevronDown, ChevronRight, Music2, History, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase-client';
import { RadioStatus } from '../types/components';
import './RealTime/styles/RealTime.css';
import Select from 'react-select';
import { SingleValue } from 'react-select';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

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

const UpsellNotice: React.FC = () => (
  <div className="flex justify-center items-center h-[calc(100vh-200px)]">
    <Alert variant="default" className="max-w-lg border-primary bg-primary/5">
      <Lock className="h-5 w-5 text-primary" />
      <AlertTitle className="font-bold text-lg text-primary">Funcionalidade Exclusiva para Assinantes</AlertTitle>
      <AlertDescription className="mt-2">
        Acompanhe as execuções em tempo real e tenha insights instantâneos sobre o que está tocando agora!
        <br />
        Faça upgrade para um plano pago e desbloqueie esta e outras funcionalidades poderosas.
      </AlertDescription>
      <Button asChild className="mt-4">
        <Link to="/plans">Ver Planos de Assinatura</Link>
      </Button>
    </Alert>
  </div>
);

export default function RealTime() {
  const { currentUser, planId, loading: authLoading, isInitialized } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const today = format(new Date(), 'yyyy-MM-dd');

  const [displayMode, setDisplayMode] = useState<'loading' | 'upsell' | 'content'>('loading');

  useEffect(() => {
    if (!isInitialized || authLoading) {
      setDisplayMode('loading');
    } else if (planId === 'FREE') {
      setDisplayMode('upsell');
    } else if (planId !== null && planId !== undefined) {
      setDisplayMode('content');
    } else {
      setDisplayMode('loading'); 
    }
  }, [planId, authLoading, isInitialized]);

  if (displayMode === 'loading') {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (displayMode === 'upsell') {
    return <UpsellNotice />;
  }

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
  const [loadingContent, setLoadingContent] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [radios, setRadios] = useState<RadioStatus[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedRadio, setExpandedRadio] = useState<number | null>(null);

  const radioOptions = useMemo(() => {
    const options: SelectOption[] = [{ value: '', label: 'Todas as Rádios' }];
    radios.forEach(radio => {
      options.push({ value: radio.name, label: radio.name });
    });
    return options;
  }, [radios]);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const fetchRadios = useCallback(async () => {
    const isDevelopment = import.meta.env.MODE === 'development';
    
    try {
      const cachedRadios = localStorage.getItem('realtime_radios_cache');
      const cacheTime = localStorage.getItem('realtime_radios_cache_time');
      
      if (cachedRadios && cacheTime) {
        const cacheDuration = Date.now() - parseInt(cacheTime);
        if (cacheDuration < 5 * 60 * 1000) {
          setRadios(JSON.parse(cachedRadios));
          fetchAndUpdateCache();
          return;
        }
      }
      
      await fetchAndUpdateCache();
    } catch (error) {
      provideFallbackData();
    }
  }, []);
  
  const fetchAndUpdateCache = useCallback(async () => {
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
        provideFallbackData();
        return;
      }
      
      setRadios(data);
      localStorage.setItem('realtime_radios_cache', JSON.stringify(data));
      localStorage.setItem('realtime_radios_cache_time', Date.now().toString());
    } catch (error) {
      throw error;
    }
  }, [getAuthHeaders]);
  
  const provideFallbackData = useCallback(() => {
    const isDevelopment = import.meta.env.MODE === 'development';
    
    const oldCache = localStorage.getItem('realtime_radios_cache');
    if (oldCache) {
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
  }, []);

  const fetchExecutions = useCallback(async (reset = false) => {
    if (loadingContent) return;
    setLoadingContent(true);
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
      setLoadingContent(false);
    }
  }, [getAuthHeaders, filters, page, executions]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setExecutions([]);
    setPage(0);
    setHasMore(true);
    fetchExecutions(true);
  }, [fetchExecutions]);

  const clearFilters = useCallback(() => {
    setFilters({
      radio: '',
      artist: '',
      song: '',
      startDate: today,
      endDate: today,
      startTime: '00:00',
      endTime: '23:59',
    });
  }, [today]);

  const validateDates = useCallback(() => {
    const start = new Date(`${filters.startDate} ${filters.startTime}`);
    const end = new Date(`${filters.endDate} ${filters.endTime}`);
    return start <= end;
  }, [filters]);

  const formatDisplayDate = useCallback((dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return dateStr;
    }
  }, []);

  const toggleRow = useCallback((id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  }, [expandedRow]);

  const toggleRadio = useCallback((id: number) => {
    setExpandedRadio(expandedRadio === id ? null : id);
  }, [expandedRadio]);

  useEffect(() => {
    if (displayMode === 'content' && currentUser) {
      fetchRadios();
      fetchExecutions(true);
    }
  }, [displayMode, currentUser, fetchRadios, fetchExecutions]);

  if (displayMode !== 'content') {
     return null;
  }

  return (
    <div className={`realtime-container ${isDarkMode ? 'dark' : ''}`}>
       <div className="realtime-header">
         <form onSubmit={handleSearch} className="realtime-filters-form">
              <Select<SelectOption, false, any>
                options={radioOptions}
                value={radioOptions.find(option => option.value === filters.radio)}
                onChange={(option: SingleValue<SelectOption>) => setFilters({ ...filters, radio: option?.value || '' })}
                placeholder="Todas as Rádios"
                classNamePrefix="react-select"
                styles={{ /* Estilos customizados se necessário */ }}
              />
           <div className="realtime-filter-row">
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
            <button type="submit" disabled={loadingContent || !validateDates()} className="realtime-search-button">
               {loadingContent ? <Loader2 className="animate-spin" /> : <Search />}
               Pesquisar
            </button>
            <button type="button" onClick={clearFilters} className="realtime-clear-button">
              Limpar Filtros
            </button>
         </form>
       </div>

       <div className="realtime-table-container">
          {loadingContent && executions.length === 0 && <p>Carregando...</p>} 
          {!loadingContent && executions.length === 0 && <p>Nenhuma execução encontrada.</p>}
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
          {hasMore && !loadingContent && (
             <button onClick={() => fetchExecutions()} className="realtime-load-more-button">
               Carregar Mais
             </button>
          )}
       </div>
    </div>
  );
}
