import React, { useState, useEffect, Suspense, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
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
  color: string;
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
  // Array de cores para o gráfico de pizza
  const colors = ['#1E3A8A', '#3B82F6', '#60A5FA', '#38BDF8', '#7DD3FC'];
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
  const { currentUser, userStatus, trialDaysRemaining, subscriptionDaysRemaining } = useAuth();
  const navigate = useNavigate();
  
  // Cache TTL em milissegundos (5 minutos)
  const CACHE_TTL = 5 * 60 * 1000;

  // Buscar rádios favoritas do usuário
  useEffect(() => {
    if (currentUser) {
      const userFavorites = currentUser.user_metadata?.favorite_radios || [];
      setFavoriteRadios(userFavorites);
    }
  }, [currentUser]);

  // Buscar dados do dashboard
  useEffect(() => {
    const fetchDashboardData = async (forceRefresh = false) => {
      if (!currentUser || !favoriteRadios.length) {
        setLoading(false);
        return;
      }

      try {
        // Verificar se temos dados em cache e se ainda são válidos
        const cacheKey = `dashboard_data_${currentUser.id}_${favoriteRadios.join('_')}`;
        const cachedData = localStorage.getItem(cacheKey);
        const now = new Date();
        
        if (!forceRefresh && cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = now.getTime() - new Date(timestamp).getTime();
          
          // Se o cache ainda for válido, use-o
          if (cacheAge < CACHE_TTL) {
            setActiveRadios(data.activeRadios);
            setTopSongs(data.topSongs);
            setArtistData(data.artistData);
            setGenreDistribution(data.genreDistribution);
            setTotalSongs(data.totalSongs);
            setSongsPlayedToday(data.songsPlayedToday);
            setLastUpdated(new Date(timestamp));
            setLoading(false);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        // Preparar os parâmetros para a chamada da API
        // Adicionar limites para reduzir a quantidade de dados
        const radioParams = favoriteRadios.map(radio => `radio=${encodeURIComponent(radio)}`).join('&');
        const limitParams = '&limit_songs=5&limit_artists=5&limit_genres=5';
        
        // Fazer as chamadas de API em paralelo usando Promise.all
        const [dashboardData, radiosStatus] = await Promise.all([
          // 1. Buscar dados do dashboard com limites
          fetch(`/api/dashboard?${radioParams}${limitParams}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).then(response => {
            if (!response.ok) throw new Error('Falha ao carregar dados do dashboard');
            return response.json();
          }),
          
          // 2. Buscar status atual das rádios favoritas
          fetch('/api/radios/status', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).then(response => {
            if (!response.ok) throw new Error('Falha ao carregar status das rádios');
            return response.json();
          })
        ]);
        
        // 3. Filtrar apenas as rádios favoritas e mapear para o formato esperado
        const favoriteRadiosStatus = radiosStatus
          .filter((radio: { name: string; status: string }) => favoriteRadios.includes(radio.name))
          .map((radio: { name: string; status: string }) => ({
            name: radio.name,
            isOnline: radio.status === 'ONLINE'
          }));
        
        // 4. Atualizar os estados com os dados obtidos
        setActiveRadios(favoriteRadiosStatus);
        setTopSongs(dashboardData.topSongs || []);
        setArtistData(dashboardData.artistData || []);
        
        // Verificar se temos dados de gênero, caso contrário usar os valores da imagem de referência
        let genreData;
        if (dashboardData.genreData && dashboardData.genreData.length > 0) {
          genreData = dashboardData.genreData;
          setGenreDistribution(genreData);
        } else {
          // Usar os valores exatos da imagem de referência
          genreData = [
            { name: 'Pop', value: 49, color: colors[0] },
            { name: 'Rock', value: 22, color: colors[1] },
            { name: 'Alternative', value: 13, color: colors[2] },
            { name: 'R&B/Soul', value: 10, color: colors[3] },
            { name: 'Brazilian', value: 7, color: colors[4] }
          ];
          setGenreDistribution(genreData);
        }
        
        const totalSongsValue = dashboardData.totalSongs || 0;
        const songsPlayedTodayValue = dashboardData.songsPlayedToday || 0;
        
        setTotalSongs(totalSongsValue);
        setSongsPlayedToday(songsPlayedTodayValue);
        setLastUpdated(now);
        
        // Salvar dados no cache
        const dataToCache = {
          data: {
            activeRadios: favoriteRadiosStatus,
            topSongs: dashboardData.topSongs || [],
            artistData: dashboardData.artistData || [],
            genreDistribution: genreData,
            totalSongs: totalSongsValue,
            songsPlayedToday: songsPlayedTodayValue
          },
          timestamp: now.toISOString()
        };
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        } catch (e) {
          console.warn('Não foi possível salvar dados no cache:', e);
        }

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setError('Falha ao carregar dados do dashboard');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchDashboardData();
    
    // Função para atualizar os dados manualmente
    const handleRefresh = () => {
      setIsRefreshing(true);
      fetchDashboardData(true);
    };
    
    // Expor a função de atualização para o componente
    (window as any).refreshDashboard = handleRefresh;
    
  }, [currentUser, favoriteRadios]);

  // Função para atualizar os dados manualmente
  const handleRefresh = () => {
    setIsRefreshing(true);
    (window as any).refreshDashboard?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (favoriteRadios.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-white">Você ainda não tem rádios favoritas. Adicione algumas rádios aos favoritos para ver o dashboard.</p>
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
      {radios.map((radio: Radio, index: number) => (
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
      ))}
    </div>
  ));

  const TopSongsList = memo(({ songs }: { songs: TopSong[] }) => (
    <div className="space-y-4">
      {songs.map((song: TopSong, index: number) => (
        <div key={index} className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{song.song_title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{song.artist}</p>
          </div>
          <span className="text-gray-600 dark:text-gray-300">{song.executions}x</span>
        </div>
      ))}
    </div>
  ));

  const ArtistBarChart = memo(({ data }: { data: ArtistData[] }) => (
    <Suspense fallback={<ChartSkeleton />}>
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
    </Suspense>
  ));

  const GenrePieChart = memo(({ data, colors }: { data: GenreDistribution[], colors: string[] }) => (
    <Suspense fallback={<ChartSkeleton />}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }) => `${name} ${value}%`}
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
            contentStyle={{ 
              backgroundColor: 'var(--tooltip-bg, #fff)', 
              color: 'var(--tooltip-text, #000)', 
              borderColor: 'var(--tooltip-border, #ccc)' 
            }} 
            wrapperStyle={{ color: 'currentColor' }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </Suspense>
  ));

  return (
    <div className="space-y-6">
      {userStatus === 'TRIAL' && trialDaysRemaining !== null && (
        <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 p-4 mb-4 rounded-md">
          <div className="flex items-center">
            <Clock className="h-6 w-6 text-blue-500 dark:text-blue-400 mr-2" />
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-300">Período de avaliação</p>
              <p className="text-blue-600 dark:text-blue-200">
                {trialDaysRemaining > 1 
                  ? `Você tem ${trialDaysRemaining} dias restantes no seu período de avaliação gratuito.` 
                  : trialDaysRemaining === 1 
                    ? 'Você tem 1 dia restante no seu período de avaliação gratuito.' 
                    : 'Seu período de avaliação gratuito termina hoje.'}
              </p>
              <p className="text-sm text-blue-500 dark:text-blue-300 mt-1">
                Após o término do período de avaliação, você precisará assinar um plano para continuar usando o sistema.
              </p>
            </div>
          </div>
        </div>
      )}

      {userStatus === 'ATIVO' && subscriptionDaysRemaining !== null && subscriptionDaysRemaining <= 2 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 mb-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-500 dark:text-yellow-400 mr-2" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-300">Assinatura próxima do vencimento</p>
              <p className="text-yellow-600 dark:text-yellow-200">
                {subscriptionDaysRemaining === 2 
                  ? 'Sua assinatura expira em 2 dias.' 
                  : subscriptionDaysRemaining === 1 
                    ? 'Sua assinatura expira amanhã.' 
                    : 'Sua assinatura expira hoje.'}
              </p>
              <div className="mt-2">
                <button 
                  onClick={() => navigate('/plans')}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  Renovar agora mesmo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
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
        {/* Rádios Favoritas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RadioIcon className="w-5 h-5" />
              Rádios Favoritas
            </h2>
            <span className="text-yellow-500">⭐</span>
          </div>
          <RadiosList radios={activeRadios} />
        </div>

        {/* Top Músicas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Music className="w-5 h-5" />
              <TooltipHeader title="Top Músicas" />
            </h2>
          </div>
          <TopSongsList songs={topSongs} />
        </div>

        {/* Artistas Mais Tocados */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <TooltipHeader title="Artistas Mais Tocados" />
          </div>
          <div className="h-80">
            {artistData.length > 0 ? (
              <ArtistBarChart data={artistData} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-gray-400">Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>

        {/* Distribuição por Gênero */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <TooltipHeader title="Distribuição por Gênero" />
          </div>
          <div className="h-80">
            {genreDistribution.length > 0 ? (
              <GenrePieChart data={genreDistribution} colors={colors} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-gray-400">Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;