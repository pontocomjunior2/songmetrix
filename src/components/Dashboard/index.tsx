import React, { useState, useEffect, Suspense, memo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface TopSong {
  song_title: string;
  artist: string;
  executions: number;
}

interface ActiveRadio {
  name: string;
  isOnline: boolean;
}

interface GenreDistribution {
  name: string;
  value: number;
  executions: number;
  color?: string;
}

interface ArtistData {
  artist: string;
  executions: number;
}

type DashboardTab = "favoritas" | "todas";

interface Radio {
  name: string;
  isOnline: boolean;
}

const TooltipHeader: React.FC<{ title: string }> = ({ title }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <span>{title}</span>
      <div
        className="cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="w-4 h-4 text-gray-400" />
        {showTooltip && (
          <div className="absolute z-10 px-3 py-2 text-sm text-white bg-gray-800 rounded shadow-lg -right-4 top-6 w-48">
            Baseado nas suas rádios favoritas
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  console.log('[Dashboard] Rendering...');
  const [activeTab, setActiveTab] = useState<DashboardTab>("favoritas");
  const [favoriteRadios, setFavoriteRadios] = useState<string[]>([]);
  const [activeRadios, setActiveRadios] = useState<Radio[]>([]);
  const [totalSongs, setTotalSongs] = useState<number>(0);
  const [songsPlayedToday, setSongsPlayedToday] = useState<number>(0);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [artistData, setArtistData] = useState<ArtistData[]>([]);
  const [genreDistribution, setGenreDistribution] = useState<GenreDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Cache TTL em milissegundos (2 minutos)
  const CACHE_TTL = 2 * 60 * 1000;
  
  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = import.meta.env.MODE === 'development';
  
  console.log('Ambiente:', import.meta.env.MODE);

  // Restaurar definição de colors
  const colors = ['#1E3A8A', '#3B82F6', '#60A5FA', '#38BDF8', '#7DD3FC']; 

  // Buscar rádios favoritas do usuário
  useEffect(() => {
    console.log('[Dashboard] useEffect [currentUser] running. currentUser:', currentUser);
    if (currentUser) {
      const userFavorites = currentUser.user_metadata?.favorite_radios || [];
      console.log('[Dashboard] Found favorite radios in metadata:', userFavorites);
      if (userFavorites.length === 0) {
        console.log('[Dashboard] No favorite radios found, navigating to /first-access');
        navigate('/first-access');
        return;
      }
      setFavoriteRadios(userFavorites);
    }
  }, [currentUser, navigate]);

  // Buscar dados do dashboard
  useEffect(() => {
    const fetchDashboardData = async (forceRefresh = false) => {
      console.log('[Dashboard] fetchDashboardData called...');
      if (!currentUser || favoriteRadios.length === 0) {
        console.log('[Dashboard] fetchDashboardData: Skipping fetch (no user or no favorites).');
        setLoading(false);
        return;
      }

      try {
        console.log('[Dashboard] Starting fetch...');
        setLoading(true);
        setError(null);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error('Sessão não encontrada ou inválida para buscar dados.');
        }
        const radioParams = favoriteRadios.map(radio => `radio=${encodeURIComponent(radio)}`).join('&');
        const limitParams = '&limit_songs=5&limit_artists=5&limit_genres=5';
        console.log(`[Dashboard] Fetching /api/dashboard?${radioParams}${limitParams}`);
        console.log(`[Dashboard] Fetching /api/radios/status`);
        
        // Remover fetchWithTimeout por enquanto para simplificar
        const [dashboardResponse, radiosStatusResponse] = await Promise.all([
          fetch(`/api/dashboard?${radioParams}${limitParams}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch('/api/radios/status', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          })
        ]);

        if (!dashboardResponse.ok) throw new Error(`Falha ao carregar dashboard: ${dashboardResponse.statusText}`);
        if (!radiosStatusResponse.ok) throw new Error(`Falha ao carregar status: ${radiosStatusResponse.statusText}`);

        const dashboardData = await dashboardResponse.json();
        const radiosStatus = await radiosStatusResponse.json();
        console.log('[Dashboard] API calls successful.');

        // Processar dados
        const favoriteRadiosSet = new Set(favoriteRadios);
        const filteredRadios = radiosStatus.filter((radio: { name: string }) => favoriteRadiosSet.has(radio.name));
        let radioStatusToShow = filteredRadios;
        if (filteredRadios.length > 5) { /* Rodízio */ }
        const radioStatusMapped = radioStatusToShow.map((radio: { name: string; status: string }) => ({
          name: radio.name,
          isOnline: radio.status === 'ONLINE'
        }));
        setActiveRadios(radioStatusMapped);
        setTopSongs(dashboardData.topSongs || []);
        setArtistData(dashboardData.artistData || []);
        
        // Processar Gêneros corretamente
        if (dashboardData.genreData?.length > 0) {
          const totalExecutions = dashboardData.genreData.reduce((total: number, item: { executions?: number | string | null }) => 
            total + Number(item.executions || 0), 0);
          
          const genreDataFormatted = dashboardData.genreData.map((item: any, index: number) => ({
            name: item.genre || 'Desconhecido',
            value: totalExecutions > 0 ? Math.round((Number(item.executions || 0) / totalExecutions) * 100) : 0,
            executions: Number(item.executions || 0),
            color: colors[index % colors.length]
          }));
          console.log('[Dashboard] Setting Genre Distribution:', genreDataFormatted);
          setGenreDistribution(genreDataFormatted);
        } else {
          console.log('[Dashboard] No Genre Data. Setting empty array.');
          setGenreDistribution([]);
        }

        setTotalSongs(dashboardData.totalSongs || 0);
        setSongsPlayedToday(dashboardData.songsPlayedToday || 0);
        setLastUpdated(new Date());
        
      } catch (error) {
        console.error('[Dashboard] fetchDashboardData: Error:', error);
        setError('Falha ao carregar dados do dashboard');
      } finally {
        console.log('[Dashboard] Fetch attempt finished. Setting loading false.');
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    if (favoriteRadios.length > 0) {
      console.log('[Dashboard] Calling fetchDashboardData...');
      fetchDashboardData();
    } else {
      console.log('[Dashboard] Skipping fetch (no favorites).');
    }

  }, [favoriteRadios, currentUser]);

  // Função para atualizar os dados manualmente
  const handleRefresh = () => {
    setIsRefreshing(true);
    (window as any).refreshDashboard?.();
  };

  if (favoriteRadios.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold mb-4">Sem rádios favoritas</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Para visualizar o dashboard, selecione suas rádios favoritas.
          </p>
          <button
            onClick={() => navigate('/first-access')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Selecionar Rádios Favoritas
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Customização do tooltip do gráfico de barras
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-2 border rounded shadow">
          <p className="font-medium text-gray-900 dark:text-white">{payload[0].payload.artist}</p>
          <p className="text-gray-700 dark:text-white">{payload[0].value} execuções</p>
        </div>
      );
    }
    return null;
  };

  // Componente de fallback para os gráficos durante o carregamento
  const ChartSkeleton = () => (
    <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
      <p className="text-gray-500 dark:text-gray-400">Carregando gráfico...</p>
    </div>
  );

  // Componentes otimizados com memo para evitar renderizações desnecessárias
  const RadiosList = memo(({ radios }: { radios: Radio[] }) => (
    <div className="space-y-4">
      {radios.length > 0 ? (
        radios.map((radio: Radio, index: number) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-gray-900 dark:text-white">{radio.name}</span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              radio.isOnline 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }`}>
              {radio.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        ))
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400">Nenhuma rádio encontrada</p>
        </div>
      )}
    </div>
  ));

  const TopSongsList = memo(({ songs }: { songs: TopSong[] }) => (
    <div className="space-y-4">
      {songs.length > 0 ? (
        songs.map((song: TopSong, index: number) => (
          <div key={index} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{song.song_title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{song.artist}</p>
            </div>
            <span className="text-gray-600 dark:text-gray-300">{song.executions}x</span>
          </div>
        ))
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400">Nenhuma música encontrada</p>
        </div>
      )}
    </div>
  ));

  const ArtistBarChart = memo(({ data }: { data: ArtistData[] }) => (
    <Suspense fallback={<ChartSkeleton />}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:stroke-gray-600" />
            <XAxis dataKey="artist" stroke="#374151" className="dark:stroke-gray-300" />
            <YAxis stroke="#374151" className="dark:stroke-gray-300" />
            <Tooltip 
              content={<CustomTooltip />} 
              wrapperStyle={{ 
                backgroundColor: 'var(--tooltip-bg, #fff)', 
                color: 'var(--tooltip-text, #000)', 
                borderColor: 'var(--tooltip-border, #ccc)' 
              }} 
            />
            <Bar 
              dataKey="executions" 
              fill="url(#barGradient)"
              className="dark:opacity-90" 
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">Sem dados disponíveis</p>
        </div>
      )}
    </Suspense>
  ));

  const GenrePieChart = memo(({ data, colors }: { data: GenreDistribution[], colors: string[] }) => (
    <Suspense fallback={<ChartSkeleton />}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, value, executions }) => `${name}: ${value}% `}
              className="text-gray-900 dark:text-white"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]}
                  className="dark:opacity-90"
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name, props) => [`${value}% (${props.payload.executions})`, name]}
              contentStyle={{ 
                backgroundColor: 'var(--tooltip-bg, #fff)', 
                color: 'var(--tooltip-text, #000)', 
                borderColor: 'var(--tooltip-border, #ccc)' 
              }} 
              wrapperStyle={{ color: 'currentColor' }} 
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">Sem dados disponíveis</p>
        </div>
      )}
    </Suspense>
  ));

  // Log antes do return
  console.log('[Dashboard] Final render state:', { loading, error, hasData: topSongs.length > 0 }); 

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div></div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Atualizado: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rádios */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RadioIcon className="w-5 h-5" />
              Rádios Favoritas
            </h2>
            <span className="text-yellow-500">⭐</span>
          </div>
          <RadiosList radios={activeRadios} />
          {activeRadios.length < favoriteRadios.length && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              *Mostrando 5 de {favoriteRadios.length} rádios favoritas. 
              A exibição será alternada diariamente.
            </div>
          )}
        </div>

        {/* Top Músicas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Music className="w-5 h-5" />
              Top Músicas
              <span className="inline-block group relative cursor-help">
                <Info className="w-4 h-4 text-gray-400" />
                <span className="invisible group-hover:visible absolute left-0 -bottom-1 transform translate-y-full w-60 px-2 py-1 bg-gray-700 text-white text-xs rounded-md z-10">
                  Informação baseada nas suas radios favoritas. Ultimos 30 dias.
                </span>
              </span>
            </h2>
          </div>
          <TopSongsList songs={topSongs} />
        </div>

        {/* Artistas Mais Tocados */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Artistas Mais Tocados
              <span className="inline-block group relative cursor-help">
                <Info className="w-4 h-4 text-gray-400" />
                <span className="invisible group-hover:visible absolute left-0 -bottom-1 transform translate-y-full w-60 px-2 py-1 bg-gray-700 text-white text-xs rounded-md z-10">
                  Informação baseada nas suas radios favoritas. Ultimos 30 dias.
                </span>
              </span>
            </h2>
          </div>
          <div className="h-80">
            <ArtistBarChart data={artistData} />
          </div>
        </div>

        {/* Distribuição por Gênero */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Distribuição por Gênero
              <span className="inline-block group relative cursor-help">
                <Info className="w-4 h-4 text-gray-400" />
                <span className="invisible group-hover:visible absolute left-0 -bottom-1 transform translate-y-full w-60 px-2 py-1 bg-gray-700 text-white text-xs rounded-md z-10">
                  Informação baseada nas suas radios favoritas. Ultimos 30 dias.
                </span>
              </span>
            </h2>
          </div>
          <div className="h-80">
            <GenrePieChart data={genreDistribution} colors={['#1E3A8A', '#3B82F6', '#60A5FA', '#38BDF8', '#7DD3FC']} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;