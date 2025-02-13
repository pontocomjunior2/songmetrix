import React, { useState, useEffect } from 'react';
import { format, startOfToday, parseISO } from 'date-fns';
import { Search, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  const [radios, setRadios] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
      fetchExecutions();
    }
  }, [currentUser]);

  const getAuthHeaders = async () => {
    const token = await currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchRadios = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios', { headers });
      if (!response.ok) throw new Error('Failed to fetch radios');
      const data = await response.json();
      setRadios(data);
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Rádio
              </label>
              <select
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.radio}
                onChange={(e) => setFilters({ ...filters, radio: e.target.value })}
              >
                <option value="">Todas as Rádios</option>
                {radios.map((radio) => (
                  <option key={radio} value={radio}>
                    {radio}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Artista
              </label>
              <input
                type="text"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.artist}
                onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Música
              </label>
              <input
                type="text"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.song}
                onChange={(e) => setFilters({ ...filters, song: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Data Início
              </label>
              <input
                type="date"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Hora Início
              </label>
              <input
                type="time"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.startTime}
                onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Hora Fim
              </label>
              <input
                type="time"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                value={filters.endTime}
                onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!validateDates() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Pesquisar
            </button>
          </div>
        </form>
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Data</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Hora</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Rádio</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Artista</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Música</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">ISRC</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Cidade</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Estado</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Região</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Segmento</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Gênero</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Gravadora</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution) => (
              <tr
                key={execution.id}
                className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{formatDisplayDate(execution.date)}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.time}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.radio_name}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.artist}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.song_title}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.isrc}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.city}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.state}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.region}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.segment}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.genre}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{execution.label}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {executions.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum registro encontrado
          </div>
        )}

        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={() => fetchExecutions()}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando...
                </span>
              ) : (
                'Carregar Mais'
              )}
            </button>
          </div>
        )}

        {!hasMore && executions.length > 0 && (
          <div className="mt-4 text-center text-gray-500 dark:text-gray-400">
            Todos os dados foram carregados
          </div>
        )}
      </div>
    </div>
  );
}
