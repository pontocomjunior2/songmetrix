import React, { useState, useEffect } from 'react';
import { Star, Radio, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { RadioStatus } from '../../types/components';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Radios() {
  const { currentUser } = useAuth();
  const [radios, setRadios] = useState<RadioStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
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
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/status', { headers });
      
      if (!response.ok) throw new Error('Failed to fetch radios');
      
      const data = await response.json();
      setRadios(data);
    } catch (error) {
      console.error('Error fetching radios:', error);
      setError('Erro ao carregar as rádios. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (radioName: string, currentFavorite: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/favorite', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          radioName,
          favorite: !currentFavorite
        })
      });

      if (!response.ok) throw new Error('Failed to update favorite status');

      // Update local state
      setRadios(prevRadios => 
        prevRadios.map(radio => 
          radio.name === radioName 
            ? { ...radio, isFavorite: !currentFavorite }
            : radio
        )
      );
    } catch (error) {
      console.error('Error updating favorite status:', error);
      setError('Erro ao atualizar favoritos. Por favor, tente novamente.');
    }
  };

  const formatLastUpdate = (lastUpdate: string) => {
    try {
      const date = new Date(lastUpdate);
      return {
        full: format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        relative: formatDistanceToNow(date, { locale: ptBR, addSuffix: true })
      };
    } catch (error) {
      return {
        full: 'Data indisponível',
        relative: 'Data indisponível'
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Carregando rádios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {radios.map((radio) => {
          const { full: fullDate, relative: relativeDate } = formatLastUpdate(radio.lastUpdate);
          
          return (
            <div
              key={radio.name}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {radio.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Última atualização: {relativeDate}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFavorite(radio.name, radio.isFavorite)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <Star
                    className={`w-5 h-5 ${
                      radio.isFavorite
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    radio.status === 'ONLINE'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    radio.status === 'ONLINE'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {radio.status}
                </span>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p title={fullDate}>
                  Última transmissão: {fullDate}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
