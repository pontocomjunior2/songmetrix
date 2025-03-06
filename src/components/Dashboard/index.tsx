import React, { useState, useEffect, Suspense, memo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';

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

// Adicionar uma interface para a resposta da API do dashboard
interface DashboardApiResponse {
  topSongs?: TopSong[];
  artistData?: ArtistData[];
  genreData?: GenreDistribution[];
  totalSongs?: number;
  songsPlayedToday?: number;
  [key: string]: any; // Para outras propriedades que possam existir
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
  const isFetching = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const dataFetchedRef = useRef<boolean>(false);
  const requestAttempts = useRef<number>(0); // Contador de tentativas de requisição
  const MAX_ATTEMPTS = 3; // Máximo de tentativas antes de desistir

  // Buscar rádios favoritas do usuário
  useEffect(() => {
    if (currentUser) {
      const userFavorites = currentUser.user_metadata?.favorite_radios || [];
      setFavoriteRadios(userFavorites);
    }
  }, [currentUser]);

  // Buscar dados do dashboard
  useEffect(() => {
    // Limpar estado ao desmontar
    return () => {
      dataFetchedRef.current = false;
      requestAttempts.current = 0;
    };
  }, []);

  // Efeito separado para buscar dados quando as rádios favoritas mudam
  useEffect(() => {
    // Só executar se tiver rádios favoritas e não tiver buscado dados ainda
    if (favoriteRadios.length > 0 && !dataFetchedRef.current) {
      fetchDashboardData();
    }
  }, [favoriteRadios]);

  const fetchDashboardData = async (forceRefresh = false) => {
    // Evitar múltiplas requisições simultâneas
    if (isFetching.current && !forceRefresh) return;
    
    // Verificar se passou tempo suficiente desde o último refresh
    const currentTimeMs = Date.now();
    if (!forceRefresh && currentTimeMs - lastRefreshTime.current < 5000) return;
    
    // Verificar se já tentou muitas vezes
    if (requestAttempts.current >= MAX_ATTEMPTS && !forceRefresh) {
      console.warn('Número máximo de tentativas atingido. Parando as requisições automáticas.');
      return;
    }
    
    isFetching.current = true;
    lastRefreshTime.current = currentTimeMs;
    requestAttempts.current += 1;

    if (!currentUser || !favoriteRadios.length) {
      setLoading(false);
      isFetching.current = false;
      return;
    }

    try {
      console.log('Buscando dados do dashboard para rádios:', favoriteRadios);
      
      // Verificar cache antes de fazer requisição
      const cacheKey = `dashboard_data_${currentUser.id}_${favoriteRadios.join('_')}`;
      const cachedData = localStorage.getItem(cacheKey);
      const currentDate = new Date();
      
      if (!forceRefresh && cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          const cacheAge = currentDate.getTime() - new Date(timestamp).getTime();
          
          // Se o cache ainda for válido, use-o
          if (cacheAge < CACHE_TTL) {
            setActiveRadios(data.activeRadios || []);
            setTopSongs(data.topSongs || []);
            setArtistData(data.artistData || []);
            setGenreDistribution(data.genreDistribution || []);
            setTotalSongs(data.totalSongs || 0);
            setSongsPlayedToday(data.songsPlayedToday || 0);
            setLastUpdated(new Date(timestamp));
            setLoading(false);
            isFetching.current = false;
            dataFetchedRef.current = true; // Marcar que os dados foram obtidos
            return;
          }
        } catch (error) {
          console.warn('Erro ao processar dados em cache:', error);
          // Continua para buscar novos dados
        }
      }
      
      // Fazer as chamadas de API com tratamento de erros robusto
      try {
        setError(null); // Limpar erros anteriores
        
        // 1. Buscar dados do dashboard
        const apiResponse = await apiClient.getDashboardData(
          favoriteRadios,
          { songs: 5, artists: 5, genres: 5 },
          forceRefresh
        );
        
        // Se a chamada retornou null (throttling ou erro), exibir um erro amigável
        if (apiResponse === null) {
          setError('Não foi possível obter dados do dashboard neste momento. Tente novamente mais tarde.');
          isFetching.current = false;
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
        
        // Converter para o tipo definido para facilitar o acesso
        const dashboardData = apiResponse as DashboardApiResponse;
        
        // 2. Buscar status atual das rádios favoritas
        const radiosStatus = await apiClient.getRadiosStatus(forceRefresh);
        
        // Se a chamada retornou null (throttling), exibir um erro amigável
        if (radiosStatus === null) {
          setError('Não foi possível obter o status das rádios neste momento. Tente novamente mais tarde.');
          isFetching.current = false;
          setLoading(false);
          setIsRefreshing(false);
          return;
        }

        // 3. Filtrar apenas as rádios favoritas e mapear para o formato esperado
        const favoriteRadiosStatus = Array.isArray(radiosStatus)
          ? radiosStatus
              .filter((radio: { name: string }) => favoriteRadios.includes(radio.name))
              .map((radio: { name: string, status: string }) => ({
                name: radio.name,
                isOnline: radio.status === 'ONLINE'
              }))
          : [];
        
        // 4. Atualizar os estados com os dados obtidos
        setActiveRadios(favoriteRadiosStatus);
        
        // Verifica se temos dados de músicas e artistas antes de atualizar o estado
        if (dashboardData && dashboardData.topSongs && Array.isArray(dashboardData.topSongs)) {
          setTopSongs(dashboardData.topSongs);
        }
        
        if (dashboardData && dashboardData.artistData && Array.isArray(dashboardData.artistData)) {
          setArtistData(dashboardData.artistData);
        }
        
        // Verificar se temos dados de gênero, caso contrário usar os valores padrão
        let genreData;
        if (dashboardData && dashboardData.genreData && Array.isArray(dashboardData.genreData) && dashboardData.genreData.length > 0) {
          genreData = dashboardData.genreData.map((genre: any, index: number) => ({
            ...genre,
            color: colors[index % colors.length]
          }));
          setGenreDistribution(genreData);
        } else {
          // Usar valores padrão
          genreData = [
            { name: 'Pop', value: 49, color: colors[0] },
            { name: 'Rock', value: 22, color: colors[1] },
            { name: 'Alternative', value: 13, color: colors[2] },
            { name: 'R&B/Soul', value: 10, color: colors[3] },
            { name: 'Brazilian', value: 7, color: colors[4] }
          ];
          setGenreDistribution(genreData);
        }
        
        const totalSongsValue = dashboardData && dashboardData.totalSongs ? dashboardData.totalSongs : 0;
        const songsPlayedTodayValue = dashboardData && dashboardData.songsPlayedToday ? dashboardData.songsPlayedToday : 0;
        
        setTotalSongs(totalSongsValue);
        setSongsPlayedToday(songsPlayedTodayValue);
        setLastUpdated(currentDate);
        dataFetchedRef.current = true; // Marcar que os dados foram obtidos com sucesso
        
        // Reset contador de tentativas já que obtivemos os dados com sucesso
        requestAttempts.current = 0;
        
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
          timestamp: currentDate.toISOString()
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
      } catch (apiError) {
        console.error('Erro nas chamadas de API:', apiError);
        setError('Falha na comunicação com o servidor. Por favor, tente novamente mais tarde.');
        throw apiError;
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      // Não sobrescrever o erro se já estiver definido
      if (!error) {
        setError('Falha ao carregar dados do dashboard. Por favor, tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      // Permitir novas requisições após delay
      setTimeout(() => {
        isFetching.current = false;
      }, 5000);
    }
  };
    
  // Função para atualizar os dados manualmente
  const handleRefresh = () => {
    if (isFetching.current) return;
    setIsRefreshing(true);
    
    // Resetar contadores de tentativas
    requestAttempts.current = 0;
    fetchDashboardData(true);
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