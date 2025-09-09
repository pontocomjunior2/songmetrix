import React, { useState, useEffect, Suspense, memo, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock, AlertCircle, Lock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, PieLabelRenderProps } from 'recharts';
import { useNavigate, useLocation } from 'react-router-dom';
import { UpgradePrompt } from '../Common/UpgradePrompt';
import Loading from '../Common/Loading';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Link } from 'react-router-dom';

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

  const daysRemaining = useMemo(() => calculateDaysRemaining(trialEndsAt), [trialEndsAt]);

  const fetchDashboardData = useCallback(async () => {
    if (!currentUser || !hasPreferences) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão não encontrada ou inválida para buscar dados.');
      }

      const limitParams = 'limit_songs=5&limit_artists=5&limit_genres=5';

      const dashboardResponse = await fetch(`/api/dashboard?${limitParams}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (!dashboardResponse.ok) throw new Error(`Falha ao carregar dashboard: ${dashboardResponse.statusText}`);

      const dashboardData = await dashboardResponse.json();

      // Processar dados recebidos
      setTopSongs(dashboardData.topSongs || []);
      setArtistData(dashboardData.artistData || []);
      setActiveRadios(dashboardData.activeRadios || []);

      // Calcular e processar dados de gênero
      const genreSourceData = dashboardData.genreData || [];
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
      setTotalExecutions(dashboardData.totalExecutions || 0);
      setUniqueArtists(dashboardData.uniqueArtists || 0);
      setUniqueSongs(dashboardData.uniqueSongs || 0);

      setLastUpdated(new Date());

    } catch (error: any) {
      console.error('[Dashboard] fetchDashboardData: Error:', error);
      setError('Falha ao carregar dados do dashboard');
    } finally {
      setLoading(false);
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
  }, [currentUser]); // Removido userHasPreferences e navigate para evitar loops

  // useEffect para chamar fetchDashboardData na montagem/mudança de dependências
  useEffect(() => {
    if (preferencesChecked && hasPreferences) {
      fetchDashboardData();
    } else if (preferencesChecked && !hasPreferences) {
      setLoading(false);
    }
  }, [preferencesChecked, hasPreferences]); // Removido fetchDashboardData das dependências para prevenir loop infinito




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

  const ArtistBarChart = memo(({ data }: { data: ArtistData[] }) => {
    // Detect dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    return (
      <Suspense fallback={<Loading />}>
        {data.length > 0 ? (
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
    // Custom label renderer
    const RADIAN = Math.PI / 180;
    // Define explicit types for label props
    const renderCustomizedLabel = (props: PieLabelRenderProps) => {
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

      // Detect dark mode
      const isDarkMode = document.documentElement.classList.contains('dark');

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
    };

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

       {/* Header com informações de atualização */}
       <div className="flex justify-end items-center mb-4">
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Atualizado: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
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
