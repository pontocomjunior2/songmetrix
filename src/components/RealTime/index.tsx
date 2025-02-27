import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase-client';
import FavoriteRadios from '../FavoriteRadios';
import { RadioStatus } from '../../types/components';
import './styles/RealTime.css';

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
  const [showFavoriteRadios, setShowFavoriteRadios] = useState(false);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const { data: executionsData, error } = await supabase
        .from('executions')
        .select('*')
        .order('date', { ascending: false })
        .limit(50)
        .range(page * 50, (page + 1) * 50 - 1);

      if (error) throw error;
      
      if (executionsData) {
        setExecutions(prev => [...prev, ...executionsData]);
        setHasMore(executionsData.length === 50);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRadios = async () => {
    try {
      const { data: radiosData, error } = await supabase
        .from('radios')
        .select('*')
        .order('name');
      
      if (error) throw error;
      if (radiosData) setRadios(radiosData);
    } catch (error) {
      console.error('Error fetching radios:', error);
    }
  };

  const handleSaveFavorites = (favorites: string[]) => {
    // Implementação do salvamento dos favoritos
    console.log('Saving favorites:', favorites);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDates()) return;

    try {
      setLoading(true);
      setPage(0);
      setExecutions([]);

      let query = supabase
        .from('executions')
        .select('*')
        .gte('date', filters.startDate)
        .lte('date', filters.endDate)
        .order('date', { ascending: false });

      if (filters.radio) {
        query = query.eq('radio_name', filters.radio);
      }
      if (filters.artist) {
        query = query.ilike('artist', `%${filters.artist}%`);
      }
      if (filters.song) {
        query = query.ilike('song_title', `%${filters.song}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      if (data) {
        setExecutions(data);
        setHasMore(data.length === 50);
      }
    } catch (error) {
      console.error('Error searching executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateDates = () => {
    const start = new Date(`${filters.startDate} ${filters.startTime}`);
    const end = new Date(`${filters.endDate} ${filters.endTime}`);
    return start <= end;
  };

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
      fetchExecutions();
    }
  }, [currentUser]);

  // ... (keep all the existing functions)

  return (
    <div className={`realtime-container ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
      <div className={`flex-none sticky top-0 z-10 p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg`}>
        {showFavoriteRadios && (
          <div className="mb-6">
            <FavoriteRadios onSave={handleSaveFavorites} />
          </div>
        )}
        
        <form onSubmit={handleSearch} className="realtime-filters">
          <div className="realtime-filter-row">
            <div className="realtime-filter-group">
              <label>Ranking:</label>
              <select
                className="realtime-filter-input"
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

            <div className="realtime-filter-row-datetime">
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
          </div>

          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={!validateDates()}
              className="realtime-btn-primary"
            >
              <Search className="w-4 h-4" />
              Pesquisar
            </button>
          </div>
        </form>
      </div>

      {/* Keep the existing table section */}
      <div className={`flex-1 overflow-auto rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
        {/* ... (keep all the existing table code) ... */}
      </div>
    </div>
  );
}
