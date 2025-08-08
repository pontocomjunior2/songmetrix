import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { ResponsiveDataTable, type ResponsiveColumn } from '@/components/ui/responsive-data-table';
import { LoadingOverlay } from './ui/loading-overlay';

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
  const today = format(new Date(), 'yyyy-MM-dd');
  const isDarkMode = theme === 'dark';

  const [displayMode, setDisplayMode] = useState<'loading' | 'upsell' | 'content'>('loading');
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
  const [loadingRadios, setLoadingRadios] = useState(true);

  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

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

  const fetchAndUpdateCache = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("[RealTime fetchAndUpdateCache] Request timed out after 15s, aborting.");
      controller.abort();
    }, 15000);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/status', { headers, signal: controller.signal });
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
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Error in fetchAndUpdateCache:', error);
      }
      provideFallbackData();
    } finally {
      clearTimeout(timeoutId);
    }
  }, [getAuthHeaders, provideFallbackData]);

  const fetchRadios = useCallback(async () => {
    try {
      const cachedRadios = localStorage.getItem('realtime_radios_cache');
      const cacheTime = localStorage.getItem('realtime_radios_cache_time');
      if (cachedRadios && cacheTime) {
        const cacheDuration = Date.now() - parseInt(cacheTime);
        if (cacheDuration < 5 * 60 * 1000) {
          setRadios(JSON.parse(cachedRadios));
          fetchAndUpdateCache().catch(err => console.error("Background fetch failed:", err));
          return;
        }
      }
      await fetchAndUpdateCache();
    } catch (error) {
      console.error('Error in fetchRadios (already handled by fetchAndUpdateCache):', error);
    } finally {
      setLoadingRadios(false);
    }
  }, [fetchAndUpdateCache]);

  const fetchExecutions = useCallback(async (targetPage: number, isReset: boolean): Promise<boolean> => {
    setLoadingContent(true);
    const currentFilters = filtersRef.current;
    console.log(`[RealTime fetchExecutions] Attempting to fetch page: ${targetPage} (Reset: ${isReset}) with filters:`, currentFilters);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filters: {
            ...currentFilters,
            radio: currentFilters.radio === 'Todas as Rádios' ? '' : currentFilters.radio
          },
          page: targetPage,
        }),
      });
      if (!response.ok) {
         const errorText = await response.text();
         console.error(`Failed to fetch executions (${response.status}): ${errorText}`);
         throw new Error(`Failed to fetch executions (${response.status})`);
       }
      const data = await response.json();
      if (Array.isArray(data)) {
        setExecutions(currentExecutions => {
          const existingIds = new Set(currentExecutions.map(exec => exec.id));
          const newData = isReset ? data : data.filter(exec => !existingIds.has(exec.id));
           if (!isReset) {
            console.log(`[RealTime fetchExecutions] Received ${data.length} items for page ${targetPage}. Added ${newData.length} new unique items.`);
           } else {
             console.log(`[RealTime fetchExecutions] Received ${data.length} items for new search (page ${targetPage}).`);
           }
          return isReset ? newData : [...currentExecutions, ...newData];
        });
        setHasMore(data.length === 100);
        if (isReset) setPage(1);
        else setPage(targetPage + 1);
        return true;
      } else {
        console.warn("Received non-array data from /api/executions:", data);
        setHasMore(false);
        if (isReset) setExecutions([]);
        return false;
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
      setHasMore(false);
      if (isReset) setExecutions([]);
      return false;
    } finally {
      setLoadingContent(false);
    }
  }, [getAuthHeaders]);

  const radioOptions = useMemo(() => {
    const options: SelectOption[] = [{ value: '', label: 'Todas as Rádios' }];
    radios.forEach(radio => {
      options.push({ value: radio.name, label: radio.name });
    });
    return options;
  }, [radios]);

  const validateDates = useCallback(() => {
    const start = new Date(`${filters.startDate} ${filters.startTime}`);
    const end = new Date(`${filters.endDate} ${filters.endTime}`);
    return start <= end;
  }, [filters]);

  const handleSearch = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("[RealTime handleSearch] Search button clicked or triggered.");

    if (filters.radio === '' && filters.artist === '' && filters.song === '') {
      console.warn("[RealTime handleSearch] Busca abortada: Pelo menos um filtro (Rádio, Artista ou Música) deve ser preenchido para pesquisar.");
      return;
    }

    if (!validateDates()) {
      console.warn("[RealTime handleSearch] Search aborted due to invalid date range.");
      return;
    }

    fetchExecutions(0, true);
  }, [fetchExecutions, validateDates, filters.radio, filters.artist, filters.song]);

  const clearFilters = useCallback(() => {
    console.log("[RealTime clearFilters] Clearing filters.");
    setFilters({
      radio: '',
      artist: '',
      song: '',
      startDate: today,
      endDate: today,
      startTime: '00:00',
      endTime: '23:59',
    });
    setExecutions([]);
    setHasMore(false);
    setPage(0);
  }, [today]);

  const formatDisplayDate = useCallback((dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (!isNaN(date.getTime())) {
         return format(date, 'dd/MM/yyyy');
      }
      const [year, month, day] = dateStr.split('-').map(Number);
      if (year && month && day) {
          const simpleDate = new Date(year, month - 1, day);
          if (!isNaN(simpleDate.getTime())) {
            return format(simpleDate, 'dd/MM/yyyy');
          }
      }
      return dateStr;
    } catch (error) {
      console.warn("Error parsing date for display:", dateStr, error);
      return dateStr;
    }
  }, []);

  const toggleRow = useCallback((id: number) => {
    setExpandedRow(current => current === id ? null : id);
  }, []);

  const toggleRadio = useCallback((id: number) => {
    setExpandedRadio(current => current === id ? null : id);
  }, []);

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

  useEffect(() => {
    const fetchInitialData = async () => {
      console.log("[RealTime useEffect] Fetching initial radios AND executions.");
      await fetchRadios();
      await fetchExecutions(0, true);
    };

    if (displayMode === 'content' && currentUser) {
      fetchInitialData();
    }
  }, [displayMode, currentUser, fetchRadios, fetchExecutions]);

  const loadMore = useCallback(() => {
    if (!loadingContent && hasMore) {
      console.log(`[RealTime loadMore] Loading more, current page: ${page}`);
      fetchExecutions(page, false);
    }
  }, [loadingContent, hasMore, page, fetchExecutions]);

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

  return (
    <div className={`realtime-container ${isDarkMode ? 'dark' : ''} p-4 md:p-6`}>
       <div className="relative realtime-header p-4 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm mb-6">
         <LoadingOverlay isOpen={loadingRadios} label="Carregando lista de rádios..." />
         <form onSubmit={handleSearch} className="realtime-filters-form space-y-4">
              
            {/* Linha 1: Rádio, Artista e Música (Combinados) */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Coluna 1: Rádio */}
              <div className="realtime-filter-group">
                <label htmlFor="radio-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rádio</label>
                <Select<SelectOption, false, any>
                  inputId="radio-select"
                  options={radioOptions}
                  value={radioOptions.find(option => option.value === filters.radio) || null}
                  onChange={(option: SingleValue<SelectOption>) => setFilters(f => ({ ...f, radio: option?.value || '' }))}
                  placeholder={loadingRadios ? "Carregando rádios..." : "Selecione ou Todas"}
                  classNamePrefix="react-select"
                  className="realtime-select dark:realtime-select-dark"
                  isLoading={loadingRadios}
                  isDisabled={loadingRadios}
                />
              </div>
              {/* Coluna 2: Artista */}
              <div className="realtime-filter-group">
                <label htmlFor="artist-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Artista</label>
                <input
                  id="artist-filter"
                  type="text"
                  className="realtime-filter-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  value={filters.artist}
                  onChange={(e) => setFilters(f => ({ ...f, artist: e.target.value }))}
                  placeholder="Nome do artista"
                />
              </div>
              {/* Coluna 3: Música */}
              <div className="realtime-filter-group">
                <label htmlFor="song-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Música</label>
                <input
                  id="song-filter"
                  type="text"
                  className="realtime-filter-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  value={filters.song}
                  onChange={(e) => setFilters(f => ({ ...f, song: e.target.value }))}
                  placeholder="Nome da música"
                />
              </div>
            </div>

          {/* Linha 2: Data e Hora (Lado a lado, 4 colunas) */}
          <div className="realtime-filter-row grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="realtime-filter-group">
              <label htmlFor="start-date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inicial</label>
              <input
                id="start-date-filter"
                type="date"
                className="realtime-filter-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                value={filters.startDate}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="end-date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Final</label>
              <input
                id="end-date-filter"
                type="date"
                className="realtime-filter-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                value={filters.endDate}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="start-time-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora Inicial</label>
              <input
                id="start-time-filter"
                type="time"
                className="realtime-filter-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                value={filters.startTime}
                onChange={(e) => setFilters(f => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="realtime-filter-group">
              <label htmlFor="end-time-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora Final</label>
              <input
                id="end-time-filter"
                type="time"
                className="realtime-filter-input block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                value={filters.endTime}
                onChange={(e) => setFilters(f => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>

            {/* Linha 3: Ações (Botões alinhados à direita) e Erro */}
            <div className="realtime-filter-actions flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2">
               {!validateDates() && (
                  <p className="text-red-500 text-xs w-full sm:w-auto sm:order-1">A data/hora inicial não pode ser posterior à data/hora final.</p>
               )}
               <div className="flex items-center space-x-2 order-last">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  aria-label="Limpar todos os filtros de pesquisa"
                  className="realtime-clear-button"
                >
                  Limpar Filtros
                </Button>
                <Button
                  type="submit"
                  disabled={loadingContent || !validateDates()}
                  aria-label="Pesquisar execuções com os filtros aplicados"
                  className="realtime-search-button"
                >
                  {loadingContent ? <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" /> : <Search className="-ml-1 mr-2 h-5 w-5"/>}
                  Pesquisar
                </Button>
             </div>
            </div>
         </form>
       </div>

       {/* Container da Tabela ou Loader Principal */}
       <div className="mt-6"> {/* Espaçamento após os filtros */}
         {/* Loader Principal (Estilo Ranking) */}
         {(loadingContent && executions.length === 0) ? (
           <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500 dark:text-gray-400">
             <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
             <p className="text-lg">Carregando...</p>
           </div>
         ) : (
           <>
             {/* Mobile: Cards responsivos */}
             <div className="sm:hidden">
               <ResponsiveDataTable<Execution>
                 data={executions}
                 getRowKey={(row) => row.id}
                 emptyState={
                   <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                     Preencha os filtros e clique em "Pesquisar" para ver as execuções.
                   </div>
                 }
                 columns={([
                   {
                     id: 'main',
                     header: 'Execução',
                     isPrimaryMobileField: true,
                     render: (row) => (
                       <div className="flex flex-col gap-0.5">
                         <span className="text-sm font-medium">{row.artist} — {row.song_title}</span>
                         <span className="text-[11px] text-muted-foreground">{formatDisplayDate(row.date)} • {row.time}</span>
                         <span className="text-[11px] text-muted-foreground">{row.radio_name}</span>
                       </div>
                     ),
                   },
                   { id: 'radio', header: 'Rádio', accessorKey: 'radio_name' },
                   { id: 'date', header: 'Data', render: (r) => formatDisplayDate(r.date) },
                   { id: 'time', header: 'Hora', accessorKey: 'time' },
                   { id: 'city', header: 'Cidade', accessorKey: 'city' },
                   { id: 'state', header: 'Estado', accessorKey: 'state' },
                   { id: 'isrc', header: 'ISRC', accessorKey: 'isrc' },
                 ] as ResponsiveColumn<Execution>[])}
               />
               {hasMore && (
                 <div className="flex justify-center py-6">
                   <Button
                     variant="secondary"
                     onClick={loadMore}
                     disabled={loadingContent}
                     aria-label="Carregar mais execuções"
                   >
                     {loadingContent ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <History className="mr-2 h-5 w-5"/>}
                     Carregar Mais
                   </Button>
                 </div>
               )}
             </div>

             {/* Desktop/Tablet: Tabela original com expansão */}
             <div className="realtime-table-container overflow-x-auto border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm hidden sm:block">
               <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                 <thead className="bg-gray-50 dark:bg-gray-800/50"><tr>
                   <th scope="col" className="w-12 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"></th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rádio</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Artista</th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Música</th>
                 </tr></thead>
                 <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                   {!loadingContent && executions.length === 0 && (
                     <tr>
                       <td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                         Preencha os filtros e clique em "Pesquisar" para ver as execuções.
                       </td>
                     </tr>
                   )}
                   {executions.map((exec) => (
                     <React.Fragment key={exec.id}>
                       <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                         <td className="px-4 py-3">
                           <button
                              onClick={() => toggleRow(exec.id)}
                              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
                              aria-expanded={expandedRow === exec.id}
                              aria-controls={`details-${exec.id}`}
                              aria-label={expandedRow === exec.id ? "Esconder detalhes" : "Mostrar detalhes"}
                            >
                             {expandedRow === exec.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                           </button>
                         </td>
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{formatDisplayDate(exec.date)}</td>
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{exec.time}</td>
                         <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{exec.radio_name}</td>
                         <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{exec.artist}</td>
                         <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{exec.song_title}</td>
                       </tr>
                       {expandedRow === exec.id && (
                         <tr id={`details-${exec.id}`} className="bg-gray-100 dark:bg-gray-800 border-l-4 border-primary">
                           <td colSpan={6} className="p-4 text-sm text-gray-700 dark:text-gray-300">
                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                               <div><strong>Cidade:</strong> {exec.city || 'N/A'}</div>
                               <div><strong>Estado:</strong> {exec.state || 'N/A'}</div>
                               <div><strong>Região:</strong> {exec.region || 'N/A'}</div>
                               <div><strong>Gênero:</strong> {exec.genre || 'N/A'}</div>
                               <div><strong>Segmento:</strong> {exec.segment || 'N/A'}</div>
                               <div><strong>Gravadora:</strong> {exec.label || 'N/A'}</div>
                               <div className="col-span-2"><strong>ISRC:</strong> {exec.isrc || 'N/A'}</div>
                             </div>
                           </td>
                         </tr>
                       )}
                     </React.Fragment>
                   ))}
                 </tbody>
               </table>
               {hasMore && (
                 <div className="flex justify-center py-6 border-t border-gray-200 dark:border-gray-700"> 
                   <Button
                     variant="secondary"
                     onClick={loadMore}
                     disabled={loadingContent}
                     aria-label="Carregar mais execuções"
                   >
                     {loadingContent ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <History className="mr-2 h-5 w-5"/>}
                     Carregar Mais
                   </Button>
                 </div>
               )}
             </div>
           </>
         )}
       </div>
    </div>
  );
}
