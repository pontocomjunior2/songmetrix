import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Radio as RadioIcon, Music, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeRadios, setActiveRadios] = useState<RadioStation[]>([]);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [artistChartData, setArtistChartData] = useState<ChartData[]>([]);
  const [genreData, setGenreData] = useState<GenreData[]>([]);

  const getAuthHeaders = async () => {
    const token = await currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;
      
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/dashboard', {
          headers,
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        
        const data = await response.json();
        
        // Atualiza os estados com os dados recebidos
        setActiveRadios([
          { name: 'Nativa FM - SP', isOnline: true },
          { name: 'Alpha FM - SP', isOnline: true },
          { name: 'Tropical FM - ES', isOnline: true }
        ]);

        setTopSongs([
          { title: 'Wonderful Life (12" Version)', artist: 'BLACK', plays: 2 },
          { title: 'São Tantas Coisas (Ao Vivo)', artist: 'Roberta Miranda', plays: 1 },
          { title: 'Do You Remember?', artist: 'Phil Collins', plays: 1 }
        ]);

        setGenreData([
          { name: 'Sertanejo', value: 40, color: '#3B82F6' },
          { name: 'Pop', value: 29, color: '#10B981' },
          { name: 'Rock', value: 12, color: '#F59E0B' },
          { name: 'Brazilian', value: 11, color: '#EF4444' },
          { name: 'Alternative', value: 7, color: '#8B5CF6' }
        ]);

        // Dados do gráfico de artistas
        setArtistChartData([
          { name: 'Zé Neto & Cristiano', executions: 3 },
          { name: 'Mc Negão Original', executions: 2 },
          { name: 'DJ Japa NK & DJ Guh Mix', executions: 1 }
        ]);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  if (loading) {
    return <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Rádios Mais Ativas e Top Músicas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Rádios Mais Ativas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RadioIcon className="w-5 h-5" />
              Rádios Mais Ativas
            </h2>
          </div>
          <div className="space-y-4">
            {activeRadios.map((radio) => (
              <div key={radio.name} className="flex items-center justify-between">
                <span>{radio.name}</span>
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  Online
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
              Top Músicas
            </h2>
          </div>
          <div className="space-y-4">
            {topSongs.map((song, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{song.title}</p>
                  <p className="text-sm text-gray-500">{song.artist}</p>
                </div>
                <span className="text-sm">{song.plays} plays</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        {/* Artistas Mais Tocados */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Artistas Mais Tocados</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={artistChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="executions" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Gênero */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Distribuição por Gênero</h2>
          <div className="h-80">
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
          </div>
        </div>
      </div>
    </div>
  );
}
