import React, { useState, useEffect, Suspense, memo, useCallback, useMemo, lazy, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, AlertCircle, Lock, CheckCircle, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, PieLabelRenderProps } from 'recharts';
import { useNavigate, useLocation } from 'react-router-dom';
import { UpgradePrompt } from '../Common/UpgradePrompt';
import Loading from '../Common/Loading';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
// Remover import do DashboardFilters
// import DashboardFilters from './DashboardFilters';
import { toast } from 'sonner';

// Lazy loading para componentes pesados
const LazyBarChart = lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const LazyPieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));

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

// Mover a definição de colors para fora do componente
const colors = ['#1E3A8A', '#3B82F6', '#60A5FA', '#38BDF8', '#7DD3FC'];

const InfoTooltip = ({ text }: { text: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div
      className="relative cursor-help inline-block ml-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Info className="w-4 h-4 text-gray-400" />
      {showTooltip && (
        <div className="absolute z-10 px-3 py-2 text-sm text-white bg-gray-800 rounded shadow-lg -left-4 top-5 w-60 dark:bg-gray-700 whitespace-normal">
          {text}
        </div>
      )}
    </div>
  );
};

// Função auxiliar para calcular dias restantes
const calculateDaysRemaining = (endDate: string | null): number | null => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  // Ignorar horas/minutos/segundos para comparar apenas dias
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - now.getTime();
  if (diffTime < 0) return 0; // Se já passou, retornar 0
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Componente de Upsell específico para o Dashboard
const DashboardUpsellNotice: React.FC = () => (
  <div className="flex justify-center items-center h-[calc(100vh-200px)]">
    <Alert className="max-w-lg border-primary bg-primary/5">
      <Lock className="h-5 w-5 text-primary" />
      <AlertTitle className="font-bold text-lg text-primary">Funcionalidade Exclusiva para Assinantes</AlertTitle>
      <AlertDescription className="mt-2">
        Tenha acesso a gráficos detalhados, top artistas, gêneros e muito mais!
        <br />
        Faça upgrade para um plano pago e desbloqueie o Dashboard completo.
      </AlertDescription>
      <Button className="mt-4">
        <Link to="/plans">Ver Planos de Assinatura</Link>
      </Button>
    </Alert>
  </div>
);

// --- Adicionar comentário sobre a necessidade de fbq ---
// Certifique-se de que a função fbq do Meta Pixel está disponível
// Exemplo: import { fbq } from '@/lib/meta-pixel'; ou window.fbq
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const Dashboard = () => {
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [artistData, setArtistData] = useState<ArtistData[]>([]);
  const [genreDistribution, setGenreDistribution] = useState<GenreDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [secondaryLoading, setSecondaryLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { currentUser, planId, trialEndsAt, userHasPreferences } = useAuth();
  const navigate = useNavigate();
  // Usar useLocation para acessar search params
  const location = useLocation();
  
  const [preferencesChecked, setPreferencesChecked] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);
  


  // Adicionar estados para as métricas
  const [totalExecutions, setTotalExecutions] = useState<number>(0);
  const [uniqueArtists, setUniqueArtists] = useState<number>(0);
  const [uniqueSongs, setUniqueSongs] = useState<number>(0);
  const [activeRadios, setActiveRadios] = useState<ActiveRadio[]>([]);
  // Replace legacy filters shape with normalized FilterState used by DashboardFilters
  // const [filters, setFilters] = useState({
  //   genres: [] as string[],
  //   regions: [] as string[],
  //   radioStations: [] as string[],
  //   dateRange: '7d' as string,
  // });
  // const filtersRef = useRef(filters);
  // useEffect(() => {
  //   filtersRef.current = filters;
  // }, [filters]);

  const isFetchingEssentialRef = useRef(false);
  const isFetchingSecondaryRef = useRef(false);
  // Novo estado: execuções somadas do Top 5 Artistas
  const [top5ArtistExecutions, setTop5ArtistExecutions] = useState<number>(0);

  // Removido: getDateRangeParams não é mais utilizado
  const getDateRangeParams = useCallback((dateRange: string) => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '1d':
        start.setDate(end.getDate() - 1);
        break;
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      default:
        start.setDate(end.getDate() - 7);
    }
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start_date: fmt(start), end_date: fmt(end) };
  }, []);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);

  const daysRemaining = useMemo(() => calculateDaysRemaining(trialEndsAt), [trialEndsAt]);

  // Carregar dados essenciais primeiro (métricas básicas)
  const fetchEssentialData = useCallback(async () => {
    if (!currentUser || !hasPreferences) {
      return;
    }

    if (isFetchingEssentialRef.current) return;
    isFetchingEssentialRef.current = true;

    try {
      // setLoading(true); // removed to avoid full-page flicker on background refreshes
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão não encontrada ou inválida para buscar dados.');
      }

      // Endpoint essencial não usa filtros do cliente — depende das preferências do usuário
      const url = `/api/dashboard/essential`;

      const dashboardResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!dashboardResponse.ok) throw new Error(`Falha ao carregar dados essenciais: ${dashboardResponse.statusText}`);

      const dashboardData = await dashboardResponse.json();

      setActiveRadios(dashboardData.activeRadios || []);
      setTotalExecutions(dashboardData.totalExecutions || 0);
      setUniqueArtists(dashboardData.uniqueArtists || 0);
      setUniqueSongs(dashboardData.uniqueSongs || 0);
      setLastUpdated(new Date());

    } catch (error: any) {
      console.error('[Dashboard] fetchEssentialData: Error:', error);
      setError(error.message || 'Erro ao carregar dados essenciais');
      toast.error('Erro ao sincronizar dados essenciais', {
        description: error.message || 'Verifique sua conexão e tente novamente'
      });
    } finally {
      isFetchingEssentialRef.current = false;
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [currentUser, hasPreferences]);

  // Carregar dados secundários (gráficos e listas)
  const fetchSecondaryData = useCallback(async () => {
    if (!currentUser || !hasPreferences) {
      return;
    }

    if (isFetchingSecondaryRef.current) return;
    isFetchingSecondaryRef.current = true;

    try {
      setSecondaryLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão não encontrada ou inválida para buscar dados.');
      }

      // Apenas limites; backend usa preferências do usuário
      const params = new URLSearchParams({ limit_songs: '5', limit_artists: '5' });
      const dashboardResponse = await fetch(`/api/dashboard/secondary?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!dashboardResponse.ok) throw new Error(`Falha ao carregar dados secundários: ${dashboardResponse.statusText}`);

      const dashboardData = await dashboardResponse.json();

      setTopSongs(dashboardData.topSongs || []);
      setArtistData(dashboardData.artistData || []);

      // Corrigir métrica: somar execuções dos top 5 artistas
      const sumTop5 = (dashboardData.artistData || [])
        .slice(0, 5)
        .reduce((sum: number, item: any) => sum + (parseInt(item.executions) || 0), 0);
      setTop5ArtistExecutions(sumTop5);

    } catch (error: any) {
      console.error('[Dashboard] fetchSecondaryData: Error:', error);
      toast.error('Erro ao sincronizar dados secundários', {
        description: 'Alguns gráficos podem estar desatualizados'
      });
    } finally {
      isFetchingSecondaryRef.current = false;
      setSecondaryLoading(false);
      setLastUpdate(new Date());
    }
  }, [currentUser, hasPreferences]);

  // NOVO: Carregar dados opcionais (distribuição por gênero)
  const fetchOptionalData = useCallback(async () => {
    if (!currentUser || !hasPreferences) {
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão não encontrada ou inválida para buscar dados opcionais.');
      }
      const response = await fetch('/api/dashboard/optional?limit_genres=5', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Falha ao carregar dados de gêneros: ${response.statusText}`);
      }
      const json = await response.json();
      const raw = Array.isArray(json?.genreData) ? json.genreData : (Array.isArray(json?.data) ? json.data : []);
      if (!Array.isArray(raw)) {
        setGenreDistribution([]);
        return;
      }
      // Ordena por contagem desc e calcula percentuais
      const sorted = [...raw].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
      const total = sorted.reduce((acc, it) => acc + (Number(it.count) || 0), 0);
      if (total <= 0) {
        setGenreDistribution([]);
        return;
      }
      const dist: GenreDistribution[] = sorted.map((it, idx) => ({
        name: (it.genre || it.name || 'Outros') as string,
        executions: Number(it.count) || 0,
        value: Math.round(((Number(it.count) || 0) / total) * 100),
        color: colors[idx % colors.length]
      }));
      setGenreDistribution(dist);
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('[Dashboard] fetchOptionalData: Error:', error);
      toast.error('Erro ao sincronizar dados opcionais (gêneros)', {
        description: error.message || 'Tente novamente mais tarde'
      });
    }
  }, [currentUser, hasPreferences]);

  useEffect(() => {
    let isMounted = true;
    const checkPrefs = async () => {
        if (currentUser) {
            const userPrefs = await userHasPreferences();
            if (!isMounted) return;
            setHasPreferences(userPrefs);
        } else {
             if (!isMounted) return;
             setHasPreferences(false);
        }
        if (isMounted) {
          setPreferencesChecked(true);
        }
    };
    checkPrefs();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Buscar dados quando estiver pronto (preferências verificadas)
  useEffect(() => {
    if (!preferencesChecked || !hasPreferences || !currentUser) return;
    fetchEssentialData();
    fetchSecondaryData();
    fetchOptionalData();
  }, [preferencesChecked, hasPreferences, currentUser, fetchEssentialData, fetchSecondaryData, fetchOptionalData]);

  // Auto-refresh em intervalos
  useEffect(() => {
    if (!preferencesChecked || !hasPreferences || !currentUser || !isAutoRefreshing) return;

    const essentialRefreshInterval = setInterval(() => {
      console.log('[Dashboard] Auto-refresh: dados essenciais');
      fetchEssentialData();
    }, 2 * 60 * 1000);

    const secondaryRefreshInterval = setInterval(() => {
      console.log('[Dashboard] Auto-refresh: dados secundários');
      fetchSecondaryData();
    }, 5 * 60 * 1000);

    const optionalRefreshInterval = setInterval(() => {
      console.log('[Dashboard] Auto-refresh: dados opcionais (gêneros)');
      fetchOptionalData();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(essentialRefreshInterval);
      clearInterval(secondaryRefreshInterval);
      clearInterval(optionalRefreshInterval);
    };
  }, [preferencesChecked, hasPreferences, currentUser, isAutoRefreshing, fetchEssentialData, fetchSecondaryData, fetchOptionalData]);

  // Atualizar ao voltar o foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && preferencesChecked && hasPreferences && currentUser) {
        console.log('[Dashboard] Aba voltou ao foco - atualizando dados');
        fetchEssentialData();
        setTimeout(() => fetchSecondaryData(), 1000);
        setTimeout(() => fetchOptionalData(), 1500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [preferencesChecked, hasPreferences, currentUser, fetchEssentialData, fetchSecondaryData, fetchOptionalData]);

  // Removido: efeito duplicado de checagem de preferências
  useEffect(() => {
    let isMounted = true;
    const checkPrefs = async () => {
        if (currentUser) {
            const userPrefs = await userHasPreferences();
            if (!isMounted) return;
            setHasPreferences(userPrefs);
        } else {
             if (!isMounted) return;
             setHasPreferences(false);
        }
        if (isMounted) {
          setPreferencesChecked(true);
        }
    };
    checkPrefs();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Função para alternar auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setIsAutoRefreshing(prev => {
      const newState = !prev;
      toast.success(
        newState ? 'Sincronização automática ativada' : 'Sincronização automática pausada',
        {
          description: newState 
            ? 'Os dados serão atualizados automaticamente a cada 2-5 minutos'
            : 'Use o botão "Atualizar agora" para sincronizar manualmente'
        }
      );
      return newState;
    });
  }, []);

  // Função para refresh manual
  const handleManualRefresh = useCallback(async () => {
    console.log('[Dashboard] Refresh manual solicitado');
    toast.info('Atualizando dados...', {
      icon: <RefreshCw className="w-4 h-4 animate-spin" />
    });
    
    try {
      await Promise.all([
        fetchEssentialData(),
        fetchSecondaryData(),
        fetchOptionalData()
      ]);
      
      toast.success('Dados atualizados com sucesso!', {
        icon: <CheckCircle className="w-4 h-4" />
      });
    } catch (error) {
      // Erros já são tratados nas funções individuais
      console.error('[Dashboard] Erro no refresh manual:', error);
    }
  }, [fetchEssentialData, fetchSecondaryData, fetchOptionalData]);




  // ---> ADICIONAR useEffect PARA META PIXEL <---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pagamentoSucesso = params.get('pagamento');

    if (pagamentoSucesso === 'sucesso') {
      // -- SUBSTITUIR VALOR E MOEDA PELOS DADOS REAIS DA TRANSAÇÃO --
      const purchaseValue = 1299.00; // Placeholder - obter valor real!
      const currency = 'BRL';

      if (typeof window.fbq === 'function') {
        try {
          window.fbq('track', 'Purchase', { value: purchaseValue, currency: currency });
        } catch (pixelError) {
            console.error('Erro ao disparar Meta Pixel:', pixelError);
        }
      }

      // Remover o parâmetro da URL para não disparar novamente
      // Usando replace: true para não adicionar ao histórico do navegador
      navigate(location.pathname, { replace: true });
    }
  // Executar este efeito sempre que a query string (location.search) mudar
  }, [location.search, navigate]);

  if (!preferencesChecked) {
      return <div className="flex items-center justify-center h-64"><Loading /></div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <Loading />
      </div>
    );
  }

  
  if (error) {
      return <div className="text-center text-red-500 p-10">{error}</div>;
  }

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

  const TopSongsList = memo(({ songs }: { songs: TopSong[] }) => {
    if (!songs || songs.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Music className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma música encontrada no período</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {songs.map((song, index) => (
          <div key={`${song.song_title}-${song.artist}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">#{index + 1}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {song.song_title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {song.artist}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                {song.executions} execuções
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  });

  const ArtistBarChart = memo(({ data }: { data: ArtistData[] }) => {
    // Detect dark mode with useMemo for performance
    const isDarkMode = useMemo(() => document.documentElement.classList.contains('dark'), []);
    
    // Memoize chart configuration
    const chartConfig = useMemo(() => ({
      margin: { top: 5, right: 0, left: -20, bottom: 5 },
      gridStroke: isDarkMode ? "#374151" : "#e0e0e0",
      axisStroke: isDarkMode ? "#9ca3af" : "#6b7280",
      tickFill: isDarkMode ? "#e5e7eb" : "#374151"
    }), [isDarkMode]);
    
    return (
      <Suspense fallback={<Loading />}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={chartConfig.margin}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1E3A8A" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartConfig.gridStroke} />
              <XAxis 
                dataKey="artist" 
                stroke={chartConfig.axisStroke} 
                fontSize={12}
                tick={{ fill: chartConfig.tickFill }}
              />
              <YAxis 
                stroke={chartConfig.axisStroke} 
                fontSize={12}
                tick={{ fill: chartConfig.tickFill }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-gray-700 p-2 border rounded shadow-lg text-sm">
                        <p className="font-medium text-gray-900 dark:text-white">{`${payload[0].payload.artist}`}</p>
                        <p className="text-gray-600 dark:text-gray-300">{`Execuções: ${payload[0].value}`}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="executions"
                fill="url(#barGradient)"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">Sem dados disponíveis</p>
          </div>
        )}
      </Suspense>
    );
  });

  const GenrePieChart = memo(({ data, colors }: { data: GenreDistribution[], colors: string[] }) => {
    // Custom label renderer with memoized dark mode detection
    const RADIAN = Math.PI / 180;
    const isDarkMode = useMemo(() => document.documentElement.classList.contains('dark'), []);
    
    // Memoize label renderer
    const renderCustomizedLabel = useCallback((props: PieLabelRenderProps) => {
      // Destructure with default values or checks if needed, accessing props directly
      const cx = Number(props.cx) || 0;
      const cy = Number(props.cy) || 0;
      const midAngle = Number(props.midAngle) || 0;
      const innerRadius = Number(props.innerRadius) || 0;
      const outerRadius = Number(props.outerRadius) || 0;
      const name = props.name || '';
      const value = props.value || 0;

      // Check if required props are valid numbers before calculation
      if (isNaN(cx) || isNaN(cy) || isNaN(midAngle) || isNaN(innerRadius) || isNaN(outerRadius)) {
        return null; // Or some default rendering
      }

      const radius = innerRadius + (outerRadius - innerRadius) * 1.1; // Position label outside
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const textAnchor = x > cx ? 'start' : 'end';

      return (
        <text 
          x={x} 
          y={y} 
          textAnchor={textAnchor} 
          dominantBaseline="central"
          fontSize={12} // Label font size
          fill={isDarkMode ? '#e5e7eb' : '#374151'} // text-gray-300 dark:text-gray-700
        >
          {`${name}: ${value}%`} 
        </text>
      );
    }, [isDarkMode]);

    return (
      <Suspense fallback={<Loading />}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={40}
                labelLine={false}
                label={renderCustomizedLabel} // Use custom label function
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => [`${value}%`, name]}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const isDarkMode = document.documentElement.classList.contains('dark');
                    return (
                      <div 
                        className="p-2 border rounded shadow-lg text-sm"
                        style={{
                          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                          color: isDarkMode ? '#e5e7eb' : '#374151',
                          borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
                        }}
                      >
                        <p className="font-medium">{payload[0].name}</p>
                        <p>{`${payload[0].value}%`}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">Sem dados de gênero</p>
          </div>
        )}
      </Suspense>
    );
  });

  // Componente para Card de Métrica
  const MetricCard = memo(({ title, value, icon: Icon }: { title: string, value: number | string, icon: React.ElementType }) => (
    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex items-center space-x-4">
      <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  ));

  // Componente para listar Rádios Monitoradas - com limite
  const MonitoredRadiosList = memo(({ radios }: { radios: ActiveRadio[] }) => (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
      {radios.length > 0 ? (
        radios.slice(0, 10).map((radio: ActiveRadio) => ( // Limita a 10 itens
          <div key={radio.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300 truncate" title={radio.name}>{radio.name}</span>
          </div>
        ))
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma rádio ativa encontrada para seus segmentos.</p>
      )}
      {radios.length > 10 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">+ {radios.length - 10} outras...</p>
      )}
    </div>
  ));

  return (
    <div className="dashboard-container p-4 md:p-6 space-y-6">
       {/* Alerta para Trial Ativo - Corrigir case */}
       {planId === 'TRIAL' && daysRemaining !== null && daysRemaining > 0 && (
         <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/30">
           <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
           <AlertTitle className="text-blue-800 dark:text-blue-300">Período de Teste Ativo</AlertTitle>
           <AlertDescription className="text-blue-700 dark:text-blue-400">
             Você tem mais {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} para explorar todos os recursos do Songmetrix.
             Aproveite ao máximo!
           </AlertDescription>
         </Alert>
       )}

       {/* Prompt para Trial Expirado (Conta Free) */}
       {planId === 'expired_trial' && (
         <UpgradePrompt
           title="Você está usando a Conta Free"
           message="Seu período de teste terminou. Seu acesso ao Songmetrix agora é limitado. Assine um plano Premium para continuar com acesso completo."
         />
       )}

       {/* Status de Sincronização */}
       <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
         <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-2">
             <div className={`w-2 h-2 rounded-full ${
               isAutoRefreshing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
             }`} />
             <span className="text-sm text-gray-600 dark:text-gray-300">
               {isAutoRefreshing ? 'Sincronização ativa' : 'Sincronização pausada'}
             </span>
           </div>
           {lastUpdate && (
             <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
               <Clock className="w-3 h-3" />
               <span>Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
             </div>
           )}
         </div>
         <div className="flex items-center space-x-2">
           <Button
             variant="outline"
             size="sm"
             onClick={handleManualRefresh}
             disabled={loading || secondaryLoading}
             className="text-xs"
           >
             {loading || secondaryLoading ? 'Atualizando...' : 'Atualizar agora'}
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={toggleAutoRefresh}
             className="text-xs"
           >
             {isAutoRefreshing ? 'Pausar' : 'Ativar'} auto-refresh
           </Button>
         </div>
       </div>


      {/* Linha 1: Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Rádios Ativas (Seu Formato)" value={activeRadios.length} icon={RadioIcon} />
        <MetricCard title="Execuções (Top 5 Artistas)" value={top5ArtistExecutions} icon={Music} />
        <MetricCard title="Gênero Principal" value={genreDistribution[0]?.name || '-'} icon={Music} />
      </div>

      {/* Linha 2: Músicas e Rádios - Mudar breakpoint para md */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Top Músicas com Tooltip */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold flex items-center mb-4">
            <Music className="w-5 h-5 mr-2" /> Músicas em Destaque
            <InfoTooltip text="Top 5 músicas mais tocadas nos últimos 7 dias, baseado no(s) formato(s) de rádio selecionados por você." />
          </h2>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }>
            {secondaryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <TopSongsList songs={topSongs} />
            )}
          </Suspense>
        </div>

        {/* Card Rádios no seu segmento (já com tooltip) */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold flex items-center mb-4">
             Rádios no seu segmento
             <InfoTooltip text="Dados baseados no(s) formato(s) de rádio selecionados por você." />
          </h2>
          <MonitoredRadiosList radios={activeRadios} />
        </div>
      </div>

      {/* Linha 3: Gráficos com Tooltips - Usar Flexbox - Mudar breakpoint para md */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Card Top Artistas com Tooltip */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1 md:w-1/2">
          <h2 className="text-lg font-semibold flex items-center mb-4">
            Artistas Mais Tocados
            <InfoTooltip text="Top 5 artistas com mais execuções nos últimos 7 dias, baseado no(s) formato(s) de rádio selecionados por você." />
          </h2>
          {/* Aumentar altura fixa para mobile */}
          <div className="h-96 md:flex-grow md:min-h-[280px]">
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              {secondaryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <ArtistBarChart data={artistData} />
              )}
            </Suspense>
          </div>
        </div>

        {/* Card Distribuição por Gênero com Tooltip */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1 md:w-1/2">
          <h2 className="text-lg font-semibold flex items-center mb-4">
             Distribuição por Gênero
             <InfoTooltip text="Distribuição percentual das execuções por gênero (Top 5) nos últimos 7 dias, baseado no(s) formato(s) de rádio selecionados por você." />
          </h2>
          {/* Aumentar altura fixa para mobile */}
          <div className="h-96 md:flex-grow md:min-h-[320px]">
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              {secondaryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <GenrePieChart data={genreDistribution} colors={colors} />
              )}
            </Suspense>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
