import React, { useState, useEffect, Suspense, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { apiServices } from '../../services/api';
import { dashboardFallbackData, radioStatusFallbackData } from '../../utils/fallbackData';

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

// Configurar timeout para as requisições fetch
const fetchWithTimeout = (url: string, options: RequestInit, timeout = 10000): Promise<Response> => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout ao buscar ${url}`)), timeout)
    )
  ]) as Promise<Response>;
};

// Função para fazer retry em requisições em caso de erro 503
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3, delay = 1000): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Tentativa ${attempt + 1}/${maxRetries} para ${url}`);
      const response = await fetchWithTimeout(url, options);
      
      // Se a resposta for 503, tenta novamente
      if (response.status === 503) {
        console.warn(`Erro 503 na tentativa ${attempt + 1}. Tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1))); // Backoff exponencial
        continue;
      }
      
      return response;
    } catch (error: any) {
      console.error(`Erro na tentativa ${attempt + 1}/${maxRetries}:`, error);
      lastError = error;
      
      // Esperar antes de tentar novamente
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1))); // Backoff exponencial
      }
    }
  }
  
  throw lastError || new Error(`Falha após ${maxRetries} tentativas para ${url}`);
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
  const [usingFallbackData, setUsingFallbackData] = useState<boolean>(false);
  const { currentUser, userStatus, trialDaysRemaining } = useAuth();
  const navigate = useNavigate();
  
  // Cache TTL em milissegundos (2 minutos)
  const CACHE_TTL = 2 * 60 * 1000;
  
  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = import.meta.env.MODE === 'development';
  const isProd = import.meta.env.MODE === 'production';
  
  console.log('Ambiente:', import.meta.env.MODE);

  // Buscar rádios favoritas do usuário
  useEffect(() => {
    if (currentUser) {
      const userFavorites = currentUser.user_metadata?.favorite_radios || [];
      
      // Se não houver rádios favoritas, redirecionar para página de seleção
      if (userFavorites.length === 0) {
        navigate('/first-access');
        return;
      }
      
      setFavoriteRadios(userFavorites);
    }
  }, [currentUser, navigate]);

  // Buscar dados do dashboard
  useEffect(() => {
    const fetchDashboardData = async (forceRefresh = false) => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (favoriteRadios.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);
        setUsingFallbackData(false);
        
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          setError('Sessão expirada');
          setLoading(false);
          return;
        }
        
        // Preparar os parâmetros para a chamada da API com rádios favoritas
        const radioParams = favoriteRadios.map(radio => `radio=${encodeURIComponent(radio)}`).join('&');
        const limitParams = '&limit_songs=5&limit_artists=5&limit_genres=5';
        
        let dashboardData: any, radiosStatus: any;
        let usedFallback = false;
        
        try {
          // Buscar dados do dashboard - usando Promise.all para paralelizar
          const [dashboardResponse, radiosResponse] = await Promise.all([
            // 1. Buscar dados do dashboard com retry
            fetchWithRetry(`/api/dashboard?${radioParams}${limitParams}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }, 3, 1000)
            .then((response: Response) => {
              if (!response.ok) {
                throw new Error(`Falha ao carregar dados do dashboard: ${response.status}`);
              }
              return response.json();
            })
            .catch((error: Error) => {
              console.error('Erro ao carregar dashboard:', error);
              usedFallback = true;
              // Usar dados de fallback em caso de erro
              return dashboardFallbackData;
            }),
            
            // 2. Buscar status atual das rádios favoritas com retry
            fetchWithRetry(`/api/radios/status`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }, 3, 1000)
            .then((response: Response) => {
              if (!response.ok) {
                throw new Error(`Falha ao carregar status das rádios: ${response.status}`);
              }
              return response.json();
            })
            .catch((error: Error) => {
              console.error('Erro ao carregar status das rádios:', error);
              usedFallback = true;
              // Usar dados de fallback para as rádios em caso de erro
              return radioStatusFallbackData;
            })
          ]);
          
          dashboardData = dashboardResponse;
          radiosStatus = radiosResponse;
          
          if (usedFallback) {
            console.log('Usando dados de fallback para o dashboard');
            setUsingFallbackData(true);
          }
          
        } catch (fetchError) {
          console.error('Erro geral ao carregar dados:', fetchError);
          // Usar dados de fallback como último recurso
          dashboardData = dashboardFallbackData;
          radiosStatus = radioStatusFallbackData;
          usedFallback = true;
          setUsingFallbackData(true);
        }
        
        // 3. Filtrar para mostrar apenas rádios favoritas
        const favoriteRadiosSet = new Set(favoriteRadios);
        const filteredRadios = radiosStatus.filter((radio: { name: string }) => 
          favoriteRadiosSet.has(radio.name)
        );
        
        // Implementar rodízio para mostrar apenas 5 rádios se houver mais
        let radioStatusToShow = filteredRadios;
        if (filteredRadios.length > 5) {
          // Usar last_updated como timestamp para criar um rodízio baseado no dia atual
          const dayOfYear = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
          const startIndex = dayOfYear % filteredRadios.length;
          
          // Criar um array circular de 5 elementos
          radioStatusToShow = [];
          for (let i = 0; i < 5; i++) {
            const index = (startIndex + i) % filteredRadios.length;
            radioStatusToShow.push(filteredRadios[index]);
          }
        }
        
        const radioStatusMapped = radioStatusToShow.map((radio: { name: string; status: string }) => ({
          name: radio.name,
          isOnline: radio.status === 'ONLINE'
        }));
        
        // 4. Atualizar os estados com os dados obtidos
        setActiveRadios(radioStatusMapped);
        setTopSongs(dashboardData.topSongs || []);
        setArtistData(dashboardData.artistData || []);
        
        // Apenas usar dados reais de gênero
        if (dashboardData.genreData && dashboardData.genreData.length > 0) {
          // Log para depuração
          console.log('Dados de gênero recebidos:', dashboardData.genreData);
          
          // Calcular o total de execuções para conversão em percentual
          const totalExecutions = dashboardData.genreData.reduce((acc: number, item: any) => 
            acc + (Number(item.executions) || 0), 0);
          
          // Formatar os dados para o formato esperado pelo gráfico
          const genreDataFormatted = dashboardData.genreData.map((item: any, index: number) => {
            const executions = Number(item.executions) || 0;
            // Converter para percentual para exibição no gráfico
            const percentage = totalExecutions > 0 
              ? Math.round((executions / totalExecutions) * 100) 
              : 0;
            
            return {
              name: item.genre || 'Desconhecido',
              value: percentage, // Usar percentual como valor para o gráfico
              executions: executions, // Manter o número original de execuções
              color: colors[index % colors.length]
            };
          });
          
          setGenreDistribution(genreDataFormatted);
        } else if (usedFallback) {
          // Usar dados de gênero de fallback
          const genreDataWithExecutions = dashboardFallbackData.genreData.map(genre => ({
            ...genre,
            executions: genre.value // Garantir que o campo executions está presente
          }));
          setGenreDistribution(genreDataWithExecutions);
        }
        
        // Atualizar timestamp da última atualização
        setLastUpdated(new Date());
        
        // Se tivemos que usar dados de fallback, mostrar mensagem
        if (usedFallback) {
          console.warn('Usando dados de fallback devido a erros de API');
          setError('Servidor temporariamente indisponível. Exibindo dados offline.');
        } else {
          setError(null);
        }
      } catch (error: any) {
        console.error('Erro ao buscar dados do dashboard:', error);
        setError('Ocorreu um erro ao carregar os dados. Tente novamente mais tarde.');
        
        // Usar dados de fallback em caso de qualquer erro
        // Mapeando para garantir compatibilidade com os tipos definidos
        setActiveRadios(dashboardFallbackData.activeRadios.map(radio => ({
          name: radio.name,
          isOnline: radio.status === 'ONLINE'
        })));
        
        // Converter os dados de topSongs para o formato correto
        setTopSongs(dashboardFallbackData.topSongs.map(song => ({
          song_title: song.title,
          artist: song.artist,
          executions: song.plays
        })));
        
        // Converter os dados de artistData para o formato correto
        setArtistData(dashboardFallbackData.artistData.map(item => ({
          artist: item.name,
          executions: item.executions
        })));
        
        // Converter os dados de genreData para o formato correto
        setGenreDistribution(dashboardFallbackData.genreData.map(genre => ({
          name: genre.name,
          value: genre.value,
          executions: genre.value, // Usar value como executions se não estiver disponível
          color: genre.color
        })));
        
        setUsingFallbackData(true);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    if (favoriteRadios.length > 0) {
      fetchDashboardData();
    }
    
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh} 
            disabled={loading || isRefreshing}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm">Atualizar</span>
          </button>
          {lastUpdated && (
            <div className="text-xs text-gray-500 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Atualizado: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
      
      {/* Alerta quando estiver usando dados de fallback */}
      {usingFallbackData && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                O servidor está temporariamente indisponível. Exibindo dados offline.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Abas para alternar entre rádios favoritas e todas */}
      <div className="flex border-b border-gray-200 mb-4">
        {/* ... resto do código não modificado */}
      </div>

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
              <GenrePieChart data={genreDistribution} colors={colors} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;