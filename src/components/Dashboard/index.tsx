import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { useFavoriteRadios } from '../../hooks/useFavoriteRadios';
import { Radio as RadioIcon, Music } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface TopSong {
  title: string;
  artist: string;
  plays: number;
}

interface RadioStation {
  name: string;
  isOnline: boolean;
}

interface ChartData {
  name: string;
  executions: number;
}

interface GenreData {
  name: string;
  value: number;
  color: string;
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { favoriteRadios, loading: loadingFavorites } = useFavoriteRadios();
  const [loading, setLoading] = useState(true);
  const [activeRadios, setActiveRadios] = useState<RadioStation[]>([]);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [artistChartData, setArtistChartData] = useState<ChartData[]>([]);
  const [genreData, setGenreData] = useState<GenreData[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Força re-seleção de rádios aleatórias a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Atualiza o dashboard quando as rádios favoritas mudarem
  useEffect(() => {
    setRefreshTrigger(prev => prev + 1);
  }, [favoriteRadios]);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;

      try {
        const clearDashboardData = () => {
          setActiveRadios([]);
          setTopSongs([]);
          setArtistChartData([]);
          setGenreData([]);
        };

        // Verifica se há rádios favoritas antes de fazer a requisição
        if (!favoriteRadios.length) {
          clearDashboardData();
          setLoading(false);
          return;
        }

        const headers = await getAuthHeaders();
        
        // Construir a URL com as rádios favoritas como parâmetros
        const params = new URLSearchParams();
        favoriteRadios.forEach(radio => params.append('radio', radio));
        const url = `/api/dashboard?${params.toString()}`;
        
        const response = await fetch(url, { headers });

        if (!response.ok) {
          if (response.status === 400) {
            console.log('Limpando dados do dashboard devido à atualização das rádios favoritas');
            clearDashboardData();
            setLoading(false);
            return;
          }
          throw new Error('Falha ao carregar dados do dashboard');
        }

        const data = await response.json();
        if (!data) {
          console.error('Dados do dashboard vazios');
          clearDashboardData();
          return;
        }
        
        setActiveRadios(data.activeRadios.map((radio: any) => ({
          name: radio.name,
          isOnline: radio.is_online
        })));

        setTopSongs(data.topSongs.map((song: any) => ({
          title: song.song_title,
          artist: song.artist,
          plays: song.executions
        })));

        setArtistChartData(data.artistData.map((artist: any) => ({
          name: artist.artist,
          executions: artist.executions
        })));

        setGenreData(data.genreData);

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser, getAuthHeaders, refreshTrigger, favoriteRadios]);

  if (loading || loadingFavorites) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Rádios Mais Ativas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RadioIcon className="w-5 h-5" />
              Rádios Mais Ativas
            </h2>
            <span className="text-yellow-500">⭐</span>
          </div>
          <div className="space-y-4">
            {activeRadios.map((radio, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{radio.name}</span>
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  Online
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Músicas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Music className="w-5 h-5" />
              Top Músicas
            </h2>
          </div>
          <div className="space-y-4">
            {topSongs.map((song, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{song.title}</p>
                  <p className="text-sm text-gray-500">{song.artist}</p>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {song.plays} plays
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Artistas Mais Tocados */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Artistas Mais Tocados</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={artistChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="executions" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Gênero */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Distribuição por Gênero</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genreData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {genreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
