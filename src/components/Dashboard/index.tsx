import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Radio as RadioIcon, Music, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFavoriteRadios } from '../../hooks/useFavoriteRadios';

interface ApiRadioStation {
  name: string;
  is_online: boolean;
  status?: string;
}

interface ApiTopSong {
  song_title: string;
  artist: string;
  executions: number;
}

interface ApiArtistData {
  artist: string;
  executions: number;
}

interface RadioStation {
  name: string;
  isOnline: boolean;
}

interface TopSong {
  title: string;
  artist: string;
  plays: number;
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

interface DashboardData {
  activeRadios: ApiRadioStation[];
  topSongs: ApiTopSong[];
  artistData: ApiArtistData[];
  genreData: GenreData[];
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const { favoriteRadios, loading: loadingFavorites } = useFavoriteRadios();
  const [activeRadios, setActiveRadios] = useState<RadioStation[]>([]);
  const [radioStatuses, setRadioStatuses] = useState<Record<string, boolean>>({});
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

  const getAuthHeaders = useCallback(async () => {
    const token = await currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [currentUser]);

  // Função para selecionar 5 rádios aleatórias
  const getRandomFavoriteRadios = (radios: string[], count: number = 5) => {
    if (radios.length <= count) return radios;
    
    const shuffled = [...radios].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Seleciona 5 rádios favoritas aleatórias a cada refresh ou login
  const selectedFavoriteRadios = useMemo(() => {
    if (!favoriteRadios || favoriteRadios.length === 0) return [];
    
    // Se tiver menos ou igual a 5 rádios, retorna todas
    if (favoriteRadios.length <= 5) return favoriteRadios;
    
    // Se tiver mais de 5, seleciona 5 aleatoriamente
    return getRandomFavoriteRadios(favoriteRadios, 5);
  }, [favoriteRadios, currentUser, refreshTrigger]); // Atualiza a cada login ou a cada 5 minutos

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser || !selectedFavoriteRadios.length) return;
      
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        
        // Buscar status das rádios
        const statusResponse = await fetch('/api/radios/status', {
          headers,
        });

        if (!statusResponse.ok) throw new Error('Failed to fetch radio statuses');
        
        const statusData = await statusResponse.json();
        const radioStatusMap: Record<string, boolean> = {};
        
        // Criar mapa de status das rádios
        statusData.forEach((radio: { name: string; status: string }) => {
          radioStatusMap[radio.name] = radio.status === 'ONLINE';
        });

        // Atualizar status das rádios selecionadas
        const favoriteRadioStatuses = selectedFavoriteRadios.map(radioName => ({
          name: radioName,
          isOnline: radioStatusMap[radioName] ?? false
        }));
        setActiveRadios(favoriteRadioStatuses);

        // Buscar dados do dashboard apenas para as rádios selecionadas
        const params = new URLSearchParams();
        selectedFavoriteRadios.forEach(radio => params.append('radio', radio));
        
        const dashboardResponse = await fetch(`/api/dashboard?${params.toString()}`, { 
          headers 
        });
        
        if (!dashboardResponse.ok) throw new Error('Failed to fetch dashboard data');
        
        const dashboardData = await dashboardResponse.json();
        
        // Usar os dados de top músicas do dashboard
        setTopSongs(
          (dashboardData.topSongs || []).map((song: ApiTopSong) => ({
            title: song.song_title,
            artist: song.artist,
            plays: song.executions
          }))
        );

        // Atualizar dados de gêneros
        setGenreData(dashboardData.genreData || []);

        // Atualizar dados de artistas
        setArtistChartData(
          dashboardData.artistData?.map((artist: ApiArtistData) => ({
            name: artist.artist,
            executions: artist.executions
          })) || []
        );

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser, selectedFavoriteRadios, getAuthHeaders]);

  if (loading || loadingFavorites) {
    return <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Rádios Favoritas e Top Músicas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Rádios Favoritas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RadioIcon className="w-5 h-5" />
              Rádios Favoritas
            </h2>
          </div>
          <div className="space-y-4">
            {activeRadios.length > 0 ? (
              activeRadios.map((radio) => (
                <div key={radio.name} className="flex items-center justify-between">
                  <span>{radio.name}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    radio.isOnline 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {radio.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Nenhuma rádio favorita selecionada
              </div>
            )}
          </div>
        </div>

        {/* Top Músicas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Music className="w-5 h-5" />
              Top Músicas (7 dias)
            </h2>
          </div>
          <div className="space-y-4">
            {topSongs.length > 0 ? (
              topSongs.map((song, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{song.title}</p>
                    <p className="text-sm text-gray-500">{song.artist}</p>
                  </div>
                  <span className="text-sm">{song.plays} plays</span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Nenhuma música encontrada
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        {/* Artistas Mais Tocados */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Artistas Mais Tocados (7 dias)</h2>
          <div className="h-80">
            {artistChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={artistChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="executions" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                Nenhum dado de artista encontrado
              </div>
            )}
          </div>
        </div>

        {/* Distribuição por Gênero */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Distribuição por Gênero (7 dias)</h2>
          <div className="h-80">
            {genreData.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                Nenhum dado de gênero encontrado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
