import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';
import FavoriteRadios from '../FavoriteRadios';
import { Loader2 } from 'lucide-react';
import { RadioStatus } from '../../types/components';

export default function FirstAccessRoute() {
  const { currentUser } = useAuth();
  const [hasFavorites, setHasFavorites] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkFavorites = () => {
      if (!currentUser) return;

      try {
        // Check favorite radios directly from user metadata
        const favoriteRadios = currentUser.user_metadata?.favorite_radios || [];
        setHasFavorites(favoriteRadios.length > 0);
      } catch (error) {
        console.error('Erro ao verificar rádios favoritas:', error);
        setError('Erro ao verificar rádios favoritas. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    checkFavorites();
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (hasFavorites) {
    return <Navigate to="/dashboard" />;
  }

  const { updateFavoriteRadios } = useAuth();

  const handleSaveFavorites = async (selectedRadios: string[]) => {
    if (!currentUser) return;

    try {
      setError('');
      
      // Update favorite radios in user metadata
      await updateFavoriteRadios(selectedRadios);

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao salvar rádios favoritas:', error);
      setError('Não foi possível salvar suas rádios favoritas. Por favor, tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bem-vindo ao SongMetrix
          </h2>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
            Para começar, selecione suas rádios favoritas
          </p>
        </div>
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}
        <FavoriteRadios onSave={handleSaveFavorites} />
      </div>
    </div>
  );
}
