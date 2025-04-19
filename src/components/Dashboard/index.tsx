import React, { useState, useEffect, Suspense, memo, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { UpgradePrompt } from '../Common/UpgradePrompt';
import Loading from '../Common/Loading';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

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

const Dashboard = () => {
  console.log('[Dashboard] Rendering...');
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [artistData, setArtistData] = useState<ArtistData[]>([]);
  const [genreDistribution, setGenreDistribution] = useState<GenreDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const { currentUser, planId, trialEndsAt, userHasPreferences } = useAuth();
  const navigate = useNavigate();
  
  const [preferencesChecked, setPreferencesChecked] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);
  
  const CACHE_TTL = 2 * 60 * 1000;
  const isDevelopment = import.meta.env.MODE === 'development';
  console.log('Ambiente:', import.meta.env.MODE);

  // Adicionar estados para as métricas
  const [totalExecutions, setTotalExecutions] = useState<number>(0);
  const [uniqueArtists, setUniqueArtists] = useState<number>(0);
  const [uniqueSongs, setUniqueSongs] = useState<number>(0);
  const [activeRadios, setActiveRadios] = useState<ActiveRadio[]>([]);

  // <<< MOVER useMemo para o topo, junto com outros hooks >>>
  const daysRemaining = useMemo(() => calculateDaysRemaining(trialEndsAt), [trialEndsAt]);

  // fetchDashboardData useCallback - agora colors é estável
  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    console.log('[Dashboard] fetchDashboardData called...');
    if (!currentUser || !hasPreferences) {
      console.log('[Dashboard] fetchDashboardData: Skipping fetch (no user or no preferences).');
      // Não seta loading false aqui ainda, espera a checagem de pref.
      return;
    }

    let isMounted = true; // Usado internamente para cleanup simulado, já que não podemos pegar do useEffect

    try {
      console.log('[Dashboard] Starting fetch...');
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão não encontrada ou inválida para buscar dados.');
      }

      const limitParams = 'limit_songs=5&limit_artists=5&limit_genres=5';
      console.log(`[Dashboard] Fetching /api/dashboard?${limitParams}`);

      const dashboardResponse = await fetch(`/api/dashboard?${limitParams}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      // Como não estamos mais no useEffect, a verificação de isMounted não é mais necessária aqui
      // if (!isMounted) return;

      if (!dashboardResponse.ok) throw new Error(`Falha ao carregar dashboard: ${dashboardResponse.statusText}`);

      const dashboardData = await dashboardResponse.json();
      console.log('[Dashboard] API call successful. Data:', dashboardData);

      // Processar dados recebidos
      setTopSongs(dashboardData.topSongs || []);
      setArtistData(dashboardData.artistData || []);
      setActiveRadios(dashboardData.activeRadios || []);

      // Calcular e processar dados de gênero
      const genreSourceData = dashboardData.genreData || [];
      const totalExecutionsMetric = dashboardData.totalExecutions || 0;
      const uniqueArtistsMetric = dashboardData.uniqueArtists || 0;
      const uniqueSongsMetric = dashboardData.uniqueSongs || 0;

      if (genreSourceData.length > 0) {
        const totalGenreExecutions = genreSourceData.reduce((sum: number, item: any) => sum + (parseInt(item.count) || 0), 0);
        const genreDataFormatted = genreSourceData.map((item: any, index: number) => {
          const count = parseInt(item.count) || 0;
          const name = item.genre || 'Desconhecido';
          const value = totalGenreExecutions > 0 ? Math.round((count / totalGenreExecutions) * 100) : 0;
          return {
            name: name,
            value: value,
            executions: count,
            color: colors[index % colors.length]
          };
        });
        setGenreDistribution(genreDataFormatted);
      } else {
        setGenreDistribution([]);
      }

      // Definir estado das métricas
      setTotalExecutions(totalExecutionsMetric);
      setUniqueArtists(uniqueArtistsMetric);
      setUniqueSongs(uniqueSongsMetric);

      setLastUpdated(new Date());

    } catch (error: any) {
      console.error('[Dashboard] fetchDashboardData: Error:', error);
      setError('Falha ao carregar dados do dashboard');
    } finally {
      console.log('[Dashboard] Fetch attempt finished.');
      // Usar isMounted aqui é complexo fora do useEffect, então simplesmente setamos os estados
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    currentUser, hasPreferences, // colors não é mais necessário como dependência aqui
    setLoading, setError, setTopSongs, setArtistData, setActiveRadios, 
    setGenreDistribution, setTotalExecutions, setUniqueArtists, setUniqueSongs, 
    setLastUpdated, setIsRefreshing
  ]);

  useEffect(() => {
    let isMounted = true;
    const checkPrefs = async () => {
        if (currentUser) {
            const userPrefs = await userHasPreferences();
            if (!isMounted) return;
            setHasPreferences(userPrefs);
            if (!userPrefs) {
                 navigate('/first-access');
            }
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
  }, [currentUser, userHasPreferences, navigate]);

  // useEffect para chamar fetchDashboardData na montagem/mudança de dependências
  useEffect(() => {
    if (preferencesChecked && hasPreferences) {
      console.log('[Dashboard] Preferences checked and present, calling initial fetchDashboardData...');
      fetchDashboardData();
    } else {
       console.log('[Dashboard] Skipping initial fetch (preferences not checked or not set).');
       if (preferencesChecked && !hasPreferences) {
         setLoading(false); // Garante que para se não tem prefs
       }
    }
    // A dependência agora é a própria função memoizada
  }, [preferencesChecked, hasPreferences, fetchDashboardData]);

  // handleRefresh agora pode chamar fetchDashboardData diretamente
  const handleRefresh = useCallback(() => {
    if (!currentUser || !hasPreferences) {
      console.log("[Dashboard] Refresh skipped: No user or preferences.");
      return;
    }
    console.log("[Dashboard] Refresh triggered - Calling fetchDashboardData...");
    setIsRefreshing(true);
    fetchDashboardData(true);
  }, [currentUser, hasPreferences, fetchDashboardData]); // Adiciona fetchDashboardData como dependência

  if (!preferencesChecked) {
      console.log("[Dashboard] Waiting for preferences check...")
      return <div className="flex items-center justify-center h-64"><Loading /></div>;
  }

  if (loading) {
    console.log("[Dashboard] Loading dashboard data...")
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
    <Suspense fallback={<Loading />}>
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
    <Suspense fallback={<Loading />}>
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
              labelLine={false}
              label={false}
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
              formatter={(value, name, props) => [`${value}% (${props.payload.executions} exec.)`, name]}
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg, #fff)',
                color: 'var(--tooltip-text, #000)',
                borderColor: 'var(--tooltip-border, #ccc)'
              }}
              wrapperStyle={{ color: 'currentColor' }}
            />
            <Legend 
              layout="horizontal" 
              verticalAlign="bottom" 
              align="center" 
              wrapperStyle={{ paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">Sem dados de gênero</p>
        </div>
      )}
    </Suspense>
  ));

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

  console.log('[Dashboard] Rendering final UI. Data counts:', { songs: topSongs.length, artists: artistData.length, genres: genreDistribution.length, activeRadios: activeRadios.length });
  console.log('[Dashboard] Current planId:', planId, 'Trial ends at:', trialEndsAt, 'Days remaining:', daysRemaining);

  return (
    <div className="dashboard-container p-4 md:p-6 space-y-6">
       {/* Alerta para Trial Ativo - Corrigir case */}
       {planId === 'trial' && daysRemaining !== null && daysRemaining > 0 && (
         <Alert variant="default" className="border-blue-500 bg-blue-50 dark:bg-blue-900/30">
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
           variant="warning"
         />
       )}

       {/* Header com botão de refresh */}
       <div className="flex justify-end items-center mb-4">
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

      {/* Linha 1: Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Rádios Ativas (Seu Formato)" value={activeRadios.length} icon={RadioIcon} />
        <MetricCard title="Execuções (Top 5 Artistas)" value={totalExecutions} icon={Music} />
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
          <TopSongsList songs={topSongs} />
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
            <ArtistBarChart data={artistData} />
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
            <GenrePieChart data={genreDistribution} colors={colors} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;