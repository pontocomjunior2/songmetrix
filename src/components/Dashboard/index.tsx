import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { Radio as RadioIcon, Music, Info, Clock } from 'lucide-react';
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
  const { currentUser, userStatus, trialDaysRemaining } = useAuth();
  const navigate = useNavigate();

  // Buscar rádios favoritas do usuário
  useEffect(() => {
    if (currentUser) {
      const userFavorites = currentUser.user_metadata?.favorite_radios || [];
      setFavoriteRadios(userFavorites);
    }
  }, [currentUser]);

 // Modificação no componente Dashboard (src/components/Dashboard/index.tsx)

// Buscar dados do dashboard
useEffect(() => {
  const fetchDashboardData = async () => {
    if (!currentUser || !favoriteRadios.length) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // 1. Buscar dados do dashboard
      const radioParams = favoriteRadios.map(radio => `radio=${encodeURIComponent(radio)}`).join('&');
      const dashboardResponse = await fetch(`/api/dashboard?${radioParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!dashboardResponse.ok) throw new Error('Falha ao carregar dados do dashboard');
      const dashboardData = await dashboardResponse.json();
      
      // 2. Buscar status atual das rádios favoritas
      const statusResponse = await fetch('/api/radios/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statusResponse.ok) throw new Error('Falha ao carregar status das rádios');
      const radiosStatus = await statusResponse.json();
      
      // 3. Filtrar apenas as rádios favoritas e mapear para o formato esperado
      const favoriteRadiosStatus = radiosStatus
        .filter(radio => favoriteRadios.includes(radio.name))
        .map(radio => ({
          name: radio.name,
          isOnline: radio.status === 'ONLINE'
        }));
      
      // 4. Atualizar os estados com os dados obtidos
      setActiveRadios(favoriteRadiosStatus);
      setTopSongs(dashboardData.topSongs || []);
      setArtistData(dashboardData.artistData || []);
      setGenreDistribution(dashboardData.genreData || []);
      setTotalSongs(dashboardData.totalSongs || 0);
      setSongsPlayedToday(dashboardData.songsPlayedToday || 0);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Falha ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  fetchDashboardData();
}, [currentUser, favoriteRadios]);

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
        <p className="text-gray-600">Você ainda não tem rádios favoritas. Adicione algumas rádios aos favoritos para ver o dashboard.</p>
      </div>
    );
  }

  // Customização do tooltip do gráfico de barras
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow">
          <p className="font-medium">{payload[0].payload.artist}</p>
          <p>{payload[0].value} execuções</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {userStatus === 'TRIAL' && trialDaysRemaining !== null && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-md">
          <div className="flex items-center">
            <Clock className="h-6 w-6 text-blue-500 mr-2" />
            <div>
              <p className="font-medium text-blue-700">Período de avaliação</p>
              <p className="text-blue-600">
                {trialDaysRemaining > 1 
                  ? `Você tem ${trialDaysRemaining} dias restantes no seu período de avaliação gratuito.` 
                  : trialDaysRemaining === 1 
                    ? 'Você tem 1 dia restante no seu período de avaliação gratuito.' 
                    : 'Seu período de avaliação gratuito termina hoje.'}
              </p>
              <p className="text-sm text-blue-500 mt-1">
                Após o término do período de avaliação, você precisará assinar um plano para continuar usando o sistema.
              </p>
            </div>
          </div>
        </div>
      )}

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
          <div className="space-y-4">
            {activeRadios.map((radio: Radio, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{radio.name}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  radio.isOnline 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {radio.isOnline ? 'Online' : 'Offline'}
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
              <TooltipHeader title="Top Músicas" />
            </h2>
          </div>
          <div className="space-y-4">
            {topSongs.map((song: TopSong, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{song.song_title}</p>
                  <p className="text-sm text-gray-500">{song.artist}</p>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {song.executions} execuções
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Artistas Mais Tocados */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <TooltipHeader title="Artistas Mais Tocados" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={artistData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="artist" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="executions" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Gênero */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <TooltipHeader title="Distribuição por Gênero" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genreDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                >
{genreDistribution.map((entry: GenreDistribution, index: number) => {
  const colors = ['#4F46E5', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];
  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
})}

                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
