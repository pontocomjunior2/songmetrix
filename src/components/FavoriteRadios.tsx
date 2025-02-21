import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { RadioStatus } from '../types/components';
import { supabase } from '../lib/supabase-client';

interface FavoriteRadiosProps {
  onSave: (selectedRadios: string[]) => void;
}

const FavoriteRadios: React.FC<FavoriteRadiosProps> = ({ onSave }) => {
  const { currentUser, updateFavoriteRadios } = useAuth();
  const [radios, setRadios] = useState<RadioStatus[]>([]);
  const [selectedRadios, setSelectedRadios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (retryCount < 3) { // Limitar a 3 tentativas
      fetchRadios();
    }
  }, [retryCount]);

  const fetchRadios = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/radios/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          // Se receber 403, esperar um pouco e tentar novamente
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000);
          return;
        }
        throw new Error('Falha ao carregar lista de rádios');
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setRadios(data);
        setError('');
      } else {
        setError('Nenhuma rádio disponível no momento');
      }
    } catch (error) {
      console.error('Erro ao carregar rádios:', error);
      setError('Não foi possível carregar a lista de rádios. Por favor, tente novamente.');
      
      // Se ainda não atingiu o limite de tentativas, tentar novamente
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (radio: string) => {
    setSelectedRadios((prev) =>
      prev.includes(radio)
        ? prev.filter((r) => r !== radio)
        : [...prev, radio]
    );
  };

  const handleSubmit = async () => {
    if (selectedRadios.length === 0) {
      setError('Por favor, selecione pelo menos uma rádio');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      // Update favorite radios in user metadata
      await updateFavoriteRadios(selectedRadios);

      // Call the parent's onSave callback to update UI
      await onSave(selectedRadios);
    } catch (error) {
      console.error('Erro ao salvar rádios favoritas:', error);
      setError('Não foi possível salvar suas rádios favoritas. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(0); // Resetar contador de tentativas
    fetchRadios();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600 dark:text-gray-400">
          Carregando lista de rádios...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            {retryCount >= 3 && (
              <button
                onClick={handleRetry}
                className="px-3 py-1 bg-red-100 dark:bg-red-800 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-700"
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}

        {radios.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            Nenhuma rádio disponível no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {radios.map((radio) => (
              <div
                key={radio.name}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <input
                  type="checkbox"
                  id={radio.name}
                  checked={selectedRadios.includes(radio.name)}
                  onChange={() => handleCheckboxChange(radio.name)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label
                  htmlFor={radio.name}
                  className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer"
                >
                  {radio.name}
                </label>
                <div
                  className={`w-2 h-2 rounded-full ${
                    radio.status === 'ONLINE'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSubmit}
            disabled={selectedRadios.length === 0 || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Favoritas'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FavoriteRadios;
