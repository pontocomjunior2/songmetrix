import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase-client';
import FavoriteRadios from './FavoriteRadios';
import { RadioStatus } from '../types/components';

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
  const [showFavoriteRadios, setShowFavoriteRadios] = useState(false);

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
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/status', { headers });
      if (!response.ok) throw new Error('Failed to fetch radios');
      const data: RadioStatus[] = await response.json();
      setRadios(data);

      const hasFavorites = data.some(radio => radio.isFavorite);
      setShowFavoriteRadios(!hasFavorites);
    } catch (error) {
      console.error('Error fetching radios:', error);
    }
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

  const handleSaveFavorites = async (selectedRadios: string[]) => {
    try {
      const headers = await getAuthHeaders();
      const promises = selectedRadios.map(radio => 
        fetch('/api/radios/favorite', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            radioName: radio,
            favorite: true
          })
        })
      );

      await Promise.all(promises);
      setShowFavoriteRadios(false);
      fetchRadios();
      fetchExecutions(true);
    } catch (error) {
      console.error('Failed to save favorite radios:', error);
    }
  };

  return (
<div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
        {showFavoriteRadios && (
          <div className="mb-6">
            <FavoriteRadios onSave={handleSaveFavorites} />
          </div>
        )}
        
        <form onSubmit={handleSearch} className="mb-6 space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rádio
              </label>
              <select
                value={filters.radio}
                onChange={(e) => setFilters({ ...filters, radio: e.target.value })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Todas as Rádios</option>
                {radios.map((radio) => (
                  <option key={radio.name} value={radio.name}>
                    {radio.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Artista
              </label>
              <input
                type="text"
                value={filters.artist}
                onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Nome do artista"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Música
              </label>
              <input
                type="text"
                value={filters.song}
                onChange={(e) => setFilters({ ...filters, song: e.target.value })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Nome da música"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora Inicial
                </label>
                <input
                  type="time"
                  value={filters.startTime}
                  onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora Final
                </label>
                <input
                  type="time"
                  value={filters.endTime}
                  onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!validateDates()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm h-full">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[15%]">
                      Data/Hora
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[20%]">
                      Rádio
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap w-[32%]">
                      Artista
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[33%]">
                      Música
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {executions.map((execution) => (
                    <React.Fragment key={execution.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[200px]">
                          {formatDisplayDate(execution.date)} {execution.time}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-[200px]">
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
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          <span>{execution.artist}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-[200px]">
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
            </div>
          </div>

          {loading ? (
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
    </div>
  );
}
