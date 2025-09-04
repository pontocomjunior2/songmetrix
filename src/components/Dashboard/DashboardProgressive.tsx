import React, { useState, useEffect, Suspense, memo, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProgressiveLoading } from '../../hooks/useProgressiveLoading';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, RefreshCw, AlertCircle, Lock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, PieLabelRenderProps } from 'recharts';
import { useNavigate, useLocation } from 'react-router-dom';
import { UpgradePrompt } from '../Common/UpgradePrompt';
import Loading from '../Common/Loading';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';
import { LoadingSection } from '../../types/progressive-loading';
import { 
  DashboardSkeleton, 
  EssentialDataSkeleton, 
  MetricsRowSkeleton,
  TopSongsSkeleton,
  RadioListSkeleton,
  ArtistChartSkeleton,
  GenreChartSkeleton
} from './DashboardSkeletons';

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

interface DashboardData {
  topSongs: TopSong[];
  artistData: ArtistData[];
  genreDistribution: GenreDistribution[];
  totalExecutions: number;
  uniqueArtists: number;
  uniqueSongs: number;
  activeRadios: ActiveRadio[];
}

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

const calculateDaysRemaining = (endDate: string | null): number | null => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - now.getTime();
  if (diffTime < 0) return 0;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const DashboardUpsellNotice: React.FC = () => (
  <div className="flex justify-center items-center h-[calc(100vh-200px)]">
    <Alert variant="default" className="max-w-lg border-primary bg-primary/5">
      <Lock className="h-5 w-5 text-primary" />
      <AlertTitle className="font-bold text-lg text-primary">Funcionalidade Exclusiva para Assinantes</AlertTitle>
      <AlertDescription className="mt-2">
        Tenha acesso a gráficos detalhados, top artistas, gêneros e muito mais!
        <br />
        Faça upgrade para um plano pago e desbloqueie o Dashboard completo.
      </AlertDescription>
      <Button asChild className="mt-4">
        <Link to="/plans">Ver Planos de Assinatura</Link>
      </Button>
    </Alert>
  </div>
);

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const DashboardProgressive = () => {
  const { currentUser, planId, trialEndsAt, userHasPreferences } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [preferencesChecked, setPreferencesChecked] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardData, setDashboardData] = useState<Partial<DashboardData>>({});

  const daysRemaining = useMemo(() => calculateDaysRemaining(trialEndsAt), [trialEndsAt]);

  // API fetch functions for different priorities
  const fetchEssentialData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Sessão não encontrada ou inválida para buscar dados.');
    }

    const response = await fetch('/api/dashboard/essential', {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Falha ao carregar dados essenciais: ${response.statusText}`);
    
    const data = await response.json();
    return {
      totalExecutions: data.totalExecutions || 0,
      uniqueArtists: data.uniqueArtists || 0,
      uniqueSongs: data.uniqueSongs || 0,
      activeRadios: data.activeRadios || []
    };
  }, []);

  const fetchSecondaryData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Sessão não encontrada ou inválida para buscar dados.');
    }

    const response = await fetch('/api/dashboard/secondary?limit_songs=5&limit_artists=5', {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Falha ao carregar dados secundários: ${response.statusText}`);
    
    const data = await response.json();
    return {
      topSongs: data.topSongs || [],
      artistData: data.artistData || []
    };
  }, []);

  const fetchOptionalData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Sessão não encontrada ou inválida para buscar dados.');
    }

    const response = await fetch('/api/dashboard/optional?limit_genres=5', {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Falha ao carregar dados opcionais: ${response.statusText}`);
    
    const data = await response.json();
    
    // Process genre data
    const genreSourceData = data.genreData || [];
    let genreDistribution: GenreDistribution[] = [];
    
    if (genreSourceData.length > 0) {
      const totalGenreExecutions = genreSourceData.reduce((sum: number, item: any) => sum + (parseInt(item.count) || 0), 0);
      genreDistribution = genreSourceData.map((item: any, index: number) => {
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
    }
    
    return { genreDistribution };
  }, []);

  // Progressive loading configuration
  const progressiveConfig = useMemo(() => {
    const sections: LoadingSection[] = [
      {
        id: 'essential',
        priority: 'essential',
        name: 'Dados Essenciais',
        fetchFn: fetchEssentialData
      },
      {
        id: 'secondary',
        priority: 'secondary',
        name: 'Dados Secundários',
        fetchFn: fetchSecondaryData,
        dependencies: ['essential']
      },
      {
        id: 'optional',
        priority: 'optional',
        name: 'Dados Opcionais',
        fetchFn: fetchOptionalData,
        dependencies: ['essential', 'secondary']
      }
    ];

    return {
      sections,
      onSectionComplete: (sectionId: string, data: any) => {
        setDashboardData(prev => ({ ...prev, ...data }));
        setLastUpdated(new Date());
      },
      onSectionError: (sectionId: string, error: Error) => {
        console.error(`Error loading section ${sectionId}:`, error);
      },
      onAllComplete: () => {
        console.log('All dashboard sections loaded');
      }
    };
  }, [fetchEssentialData, fetchSecondaryData, fetchOptionalData]);

  const { loadingState, startLoading, retrySection, isComplete, hasErrors, progress } = useProgressiveLoading(progressiveConfig);

  // Check user preferences
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
  }, [currentUser, userHasPreferences]);

  // Start progressive loading when preferences are ready
  useEffect(() => {
    if (preferencesChecked && hasPreferences && currentUser) {
      startLoading();
    }
  }, [preferencesChecked, hasPreferences, currentUser, startLoading]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (!currentUser || !hasPreferences) return;
    setDashboardData({});
    startLoading();
  }, [currentUser, hasPreferences, startLoading]);

  // Meta Pixel tracking
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pagamentoSucesso = params.get('pagamento');

    if (pagamentoSucesso === 'sucesso') {
      console.log('Pagamento sucesso detectado via URL, disparando Meta Pixel Purchase...');
      
      const purchaseValue = 1299.00;
      const currency = 'BRL';

      if (typeof window.fbq === 'function') {
        try {
          window.fbq('track', 'Purchase', { value: purchaseValue, currency: currency });
          console.log('Meta Pixel Purchase event fired.');
        } catch (pixelError) {
          console.error('Erro ao disparar Meta Pixel:', pixelError);
        }
      } else {
        console.warn('Função fbq do Meta Pixel não encontrada.');
      }

      navigate(location.pathname, { replace: true }); 
    }
  }, [location.search, navigate]); 

  if (!preferencesChecked) {
    return <div className="flex items-center justify-center h-64"><Loading /></div>;
  }

  if (!hasPreferences) {
    return <DashboardUpsellNotice />;
  }

  // Show loading for essential data
  if (loadingState.essential.isLoading && !dashboardData.totalExecutions) {
    return <EssentialDataSkeleton />;
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
      {songs && songs.length > 0 ? (
        songs.map((song: TopSong, index: number) => (
          <div key={index} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{song.song_title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{song.artist}</p>
            </div>
            <span className="text-gray-600 dark:text-gray-300">{song.executions}x</span>
          </div>
        ))
      ) : loadingState.secondary.isLoading ? (
        <div className="text-center py-4">
          <Loading />
          <p className="text-sm text-gray-500 mt-2">Carregando músicas...</p>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400">Nenhuma música encontrada</p>
        </div>
      )}
    </div>
  ));

  const ArtistBarChart = memo(({ data }: { data: ArtistData[] }) => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    if (loadingState.secondary.isLoading && (!data || data.length === 0)) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loading />
            <p className="text-sm text-gray-500 mt-2">Carregando artistas...</p>
          </div>
        </div>
      );
    }
    
    return (
      <Suspense fallback={<Loading />}>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1E3A8A" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#374151" : "#e0e0e0"} />
              <XAxis 
                dataKey="artist" 
                stroke={isDarkMode ? "#9ca3af" : "#6b7280"} 
                fontSize={12}
                tick={{ fill: isDarkMode ? "#e5e7eb" : "#374151" }}
              />
              <YAxis 
                stroke={isDarkMode ? "#9ca3af" : "#6b7280"} 
                fontSize={12}
                tick={{ fill: isDarkMode ? "#e5e7eb" : "#374151" }}
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
    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = (props: PieLabelRenderProps) => {
      const cx = Number(props.cx) || 0;
      const cy = Number(props.cy) || 0;
      const midAngle = Number(props.midAngle) || 0;
      const innerRadius = Number(props.innerRadius) || 0;
      const outerRadius = Number(props.outerRadius) || 0;
      const name = props.name || '';
      const value = props.value || 0;

      if (isNaN(cx) || isNaN(cy) || isNaN(midAngle) || isNaN(innerRadius) || isNaN(outerRadius)) {
        return null;
      }

      const radius = innerRadius + (outerRadius - innerRadius) * 1.1;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const textAnchor = x > cx ? 'start' : 'end';

      const isDarkMode = document.documentElement.classList.contains('dark');

      return (
        <text 
          x={x} 
          y={y} 
          textAnchor={textAnchor} 
          dominantBaseline="central"
          fontSize={12}
          fill={isDarkMode ? '#e5e7eb' : '#374151'}
        >
          {`${name}: ${value}%`} 
        </text>
      );
    };

    if (loadingState.optional.isLoading && (!data || data.length === 0)) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loading />
            <p className="text-sm text-gray-500 mt-2">Carregando gêneros...</p>
          </div>
        </div>
      );
    }

    return (
      <Suspense fallback={<Loading />}>
        {data && data.length > 0 ? (
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
                label={renderCustomizedLabel}
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

  const MonitoredRadiosList = memo(({ radios }: { radios: ActiveRadio[] }) => (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
      {radios && radios.length > 0 ? (
        radios.slice(0, 10).map((radio: ActiveRadio) => (
          <div key={radio.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300 truncate" title={radio.name}>{radio.name}</span>
          </div>
        ))
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma rádio ativa encontrada para seus segmentos.</p>
      )}
      {radios && radios.length > 10 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">+ {radios.length - 10} outras...</p>
      )}
    </div>
  ));

  return (
    <div className="dashboard-container p-4 md:p-6 space-y-6">
      {/* Trial alerts */}
      {planId === 'TRIAL' && daysRemaining !== null && daysRemaining > 0 && (
        <Alert variant="default" className="border-blue-500 bg-blue-50 dark:bg-blue-900/30">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Período de Teste Ativo</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            Você tem mais {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} para explorar todos os recursos do Songmetrix.
            Aproveite ao máximo!
          </AlertDescription>
        </Alert>
      )}

      {planId === 'expired_trial' && (
        <UpgradePrompt
          title="Você está usando a Conta Free"
          message="Seu período de teste terminou. Seu acesso ao Songmetrix agora é limitado. Assine um plano Premium para continuar com acesso completo."
          variant="warning"
        />
      )}

      {/* Header with refresh button */}
      <div className="flex justify-end items-center mb-4">
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Atualizado: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loadingState.essential.isLoading}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${loadingState.essential.isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      {!isComplete && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando dashboard...</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Metrics row */}
      {loadingState.essential.isLoading ? (
        <MetricsRowSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard 
            title="Rádios Ativas (Seu Formato)" 
            value={dashboardData.activeRadios?.length || 0} 
            icon={RadioIcon} 
          />
          <MetricCard 
            title="Execuções (Top 5 Artistas)" 
            value={dashboardData.totalExecutions || 0} 
            icon={Music} 
          />
          <MetricCard 
            title="Gênero Principal" 
            value={dashboardData.genreDistribution?.[0]?.name || '-'} 
            icon={Music} 
          />
        </div>
      )}

      {/* Songs and Radios row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loadingState.secondary.isLoading && !dashboardData.topSongs ? (
          <TopSongsSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold flex items-center mb-4">
              <Music className="w-5 h-5 mr-2" /> Músicas em Destaque
              <InfoTooltip text="Top 5 músicas mais tocadas nos últimos 7 dias, baseado no(s) formato(s) de rádio selecionados por você." />
            </h2>
            <TopSongsList songs={dashboardData.topSongs || []} />
          </div>
        )}

        {loadingState.essential.isLoading && !dashboardData.activeRadios ? (
          <RadioListSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold flex items-center mb-4">
              Rádios no seu segmento
              <InfoTooltip text="Dados baseados no(s) formato(s) de rádio selecionados por você." />
            </h2>
            <MonitoredRadiosList radios={dashboardData.activeRadios || []} />
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="flex flex-col md:flex-row gap-6">
        {loadingState.secondary.isLoading && !dashboardData.artistData ? (
          <ArtistChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1 md:w-1/2">
            <h2 className="text-lg font-semibold flex items-center mb-4">
              Artistas Mais Tocados
              <InfoTooltip text="Top 5 artistas com mais execuções nos últimos 7 dias, baseado no(s) formato(s) de rádio selecionados por você." />
            </h2>
            <div className="h-96 md:flex-grow md:min-h-[280px]">
              <ArtistBarChart data={dashboardData.artistData || []} />
            </div>
          </div>
        )}

        {loadingState.optional.isLoading && !dashboardData.genreDistribution ? (
          <GenreChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm flex flex-col flex-1 md:w-1/2">
            <h2 className="text-lg font-semibold flex items-center mb-4">
              Distribuição por Gênero
              <InfoTooltip text="Distribuição percentual das execuções por gênero (Top 5) nos últimos 7 dias, baseado no(s) formato(s) de rádio selecionados por você." />
            </h2>
            <div className="h-96 md:flex-grow md:min-h-[320px]">
              <GenrePieChart data={dashboardData.genreDistribution || []} colors={colors} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardProgressive;