import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase-client';

export const useFavoriteRadios = () => {
  const { currentUser } = useAuth();
  const [favoriteRadios, setFavoriteRadios] = useState<string[]>([]);
  const [availableRadios, setAvailableRadios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const fetchFavoriteRadios = async () => {
    if (!currentUser) return;

    try {
      // Get favorite radios directly from user metadata
      const radios = currentUser.user_metadata?.favorite_radios || [];
      setFavoriteRadios(Array.isArray(radios) ? radios : []);
    } catch (error) {
      console.error('Erro ao buscar rádios favoritas:', error);
      setError('Não foi possível carregar suas rádios favoritas');
    }
  };

  const fetchAvailableRadios = async () => {
    if (!currentUser) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/radios/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch available radios: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data) {
        setAvailableRadios([]);
        return;
      }

      const radiosList = Array.isArray(data) 
        ? data.map(radio => radio.name)
        : [];
      
      setAvailableRadios(radiosList);
    } catch (error) {
      console.error('Erro ao buscar rádios disponíveis:', error);
      setError('Não foi possível carregar a lista de rádios');
    }
  };

  const saveFavoriteRadios = async (radios: string[]) => {
    if (!currentUser) return false;

    try {
      setLoading(true);
      
      // Update user metadata with new favorite radios
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...currentUser.user_metadata,
          favorite_radios: radios
        }
      });
      
      if (error) {
        console.error('Error saving favorite radios:', error);
        throw new Error(`Failed to save favorite radios: ${error.message}`);
      }

      // Força uma atualização do token após salvar as rádios favoritas
      await supabase.auth.refreshSession();

      // Só atualiza o estado local após confirmação do Supabase
      if (data.user) {
        const updatedRadios = data.user.user_metadata?.favorite_radios || [];
        setFavoriteRadios(Array.isArray(updatedRadios) ? updatedRadios : []);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao salvar rádios favoritas:', error);
      setError('Não foi possível salvar suas rádios favoritas');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const hasFavorites = (): boolean => {
    if (!currentUser) return false;
    const radios = currentUser.user_metadata?.favorite_radios || [];
    return Array.isArray(radios) && radios.length > 0;
  };

  // Escuta mudanças no user_metadata
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) {
        const radios = session.user.user_metadata?.favorite_radios || [];
        setFavoriteRadios(Array.isArray(radios) ? radios : []);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchFavoriteRadios(),
          fetchAvailableRadios()
        ]);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setError('Ocorreu um erro ao carregar os dados');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      loadData();
    }
  }, [currentUser, updateTrigger]);

  return {
    favoriteRadios,
    availableRadios,
    loading,
    error,
    saveFavoriteRadios,
    hasFavorites,
    refresh: async () => {
      setUpdateTrigger(prev => prev + 1);
    }
  };
};
