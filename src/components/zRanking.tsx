import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RankingItem {
  id: number;
  artist: string;
  song_title: string;
  genre: string;
  executions: number;
}

export default function Ranking() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [selectedRadios, setSelectedRadios] = useState<string[]>([]);
  const [radios, setRadios] = useState<string[]>([]);
  const [rankingSize, setRankingSize] = useState('10');

  // Data padrão: últimos 10 dias
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), 10), 'yyyy-MM-dd');

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
      fetchRanking();
    }
  }, [currentUser]);

  const getAuthHeaders = async () => {
    const token = await currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchRadios = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios', { headers });
      if (!response.ok) throw new Error('Failed to fetch radios');
      const data = await response.json();
      setRadios(data);
    } catch (error) {
      console.error('Error fetching radios:', error);
    }
  };

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        startDate,
        endDate,
        rankingSize,
...(selectedRadios.length > 0 && { radio: selectedRadios.join('||') })
      });

      const response = await fetch(`/api/ranking?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch ranking');
      const data = await response.json();
      setRankingData(data);
    } catch (error) {
      console.error('Error fetching ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRadioChange = (radio: string) => {
    const newSelection = selectedRadios.includes(radio)
      ? selectedRadios.filter(r => r !== radio)
      : [...selectedRadios, radio];
    setSelectedRadios(newSelection);
  };

  const handleRankingSizeChange = (size: string) => {
    setRankingSize(size);
    fetchRanking();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Rádios
            </label>
            <div className="flex flex-wrap gap-2">
              {radios.map((radio) => (
                <button
                  key={radio}
                  onClick={() => handleRadioChange(radio)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedRadios.includes(radio)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {radio}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              TOP
            </label>
            <select
              value={rankingSize}
              onChange={(e) => handleRankingSizeChange(e.target.value)}
              className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="10">TOP 10</option>
              <option value="20">TOP 20</option>
              <option value="40">TOP 40</option>
              <option value="100">TOP 100</option>
              <option value="200">TOP 200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Posição</th>
                <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Artista</th>
                <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Música</th>
                <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Gênero</th>
                <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Execuções</th>
              </tr>
            </thead>
            <tbody>
              {rankingData.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                    {index + 1}º
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                    {item.artist}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                    {item.song_title}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                    {item.genre}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-200">
                    {item.executions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && rankingData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum registro encontrado
          </div>
        )}
      </div>
    </div>
  );
}
