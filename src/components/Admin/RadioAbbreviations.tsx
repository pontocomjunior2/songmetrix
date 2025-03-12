import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import { Loader2 } from 'lucide-react';

interface RadioAbbreviation {
  radio_name: string;
  abbreviation: string;
}

export default function RadioAbbreviations() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abbreviations, setAbbreviations] = useState<RadioAbbreviation[]>([]);
  const [editingRadio, setEditingRadio] = useState<string | null>(null);
  const [newAbbreviation, setNewAbbreviation] = useState('');

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  useEffect(() => {
    fetchAbbreviations();
  }, []);

  const fetchAbbreviations = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radio-abbreviations', { headers });
      
      if (!response.ok) throw new Error('Falha ao buscar abreviações');
      
      const data = await response.json();
      console.log('Dados recebidos da API:', data);
      console.log('Total de abreviações recebidas:', data.length);
      
      // Registrar abreviações por tipo
      const streamingPlatforms = data.filter((abbr: RadioAbbreviation) => ['Spotify', 'Youtube'].includes(abbr.radio_name));
      const radios = data.filter((abbr: RadioAbbreviation) => !['Spotify', 'Youtube'].includes(abbr.radio_name));
      
      console.log('Plataformas de streaming:', streamingPlatforms);
      console.log('Rádios:', radios);
      console.log('Total de rádios:', radios.length);
      
      setAbbreviations(data);
    } catch (error) {
      console.error('Erro ao buscar abreviações:', error);
      setError('Erro ao carregar abreviações. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (radioName: string, currentAbbreviation: string) => {
    setEditingRadio(radioName);
    setNewAbbreviation(currentAbbreviation);
  };

  const handleSave = async (radioName: string) => {
    try {
      setError(null);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radio-abbreviations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          radioName,
          abbreviation: newAbbreviation.toUpperCase()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao salvar abreviação');
      }

      const updatedAbbreviation = await response.json();
      setAbbreviations(prev => 
        prev.map(abbr => 
          abbr.radio_name === radioName 
            ? { ...abbr, abbreviation: updatedAbbreviation.abbreviation }
            : abbr
        )
      );
      setEditingRadio(null);
      setNewAbbreviation('');
    } catch (error: any) {
      console.error('Erro ao salvar abreviação:', error);
      setError(error.message || 'Erro ao salvar abreviação. Por favor, tente novamente.');
    }
  };

  const handleCancel = () => {
    setEditingRadio(null);
    setNewAbbreviation('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Carregando abreviações...</p>
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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Gerenciar Abreviações de Rádios
      </h2>
      
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Rádio
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Abreviação
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {abbreviations.map((abbr) => (
              <tr key={abbr.radio_name}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {abbr.radio_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {editingRadio === abbr.radio_name ? (
                    <input
                      type="text"
                      value={newAbbreviation}
                      onChange={(e) => setNewAbbreviation(e.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                      placeholder="ABC"
                    />
                  ) : (
                    abbr.abbreviation
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {editingRadio === abbr.radio_name ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSave(abbr.radio_name)}
                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={handleCancel}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(abbr.radio_name, abbr.abbreviation)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
