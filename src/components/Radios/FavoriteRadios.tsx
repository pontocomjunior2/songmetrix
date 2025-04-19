import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { Heart } from 'lucide-react';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';

interface Radio {
  id: string;
  name: string;
  thumbnail_url: string;
  // Outras propriedades relevantes...
}

export default function FavoriteRadios() {
  const [favoriteRadios, setFavoriteRadios] = useState<Radio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, updateFavoriteRadios } = useAuth();

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!currentUser?.user_metadata?.favorite_radios || currentUser.user_metadata.favorite_radios.length === 0) {
        setFavoriteRadios([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const favoriteIds = currentUser.user_metadata.favorite_radios;
        const { data, error: dbError } = await supabase
          .from('radios')
          .select('id, name, thumbnail_url') // Selecione os campos necessários
          .in('id', favoriteIds);

        if (dbError) {
          throw dbError;
        }

        setFavoriteRadios(data || []);
      } catch (err: any) {
        console.error("Erro ao buscar rádios favoritas:", err);
        setError('Não foi possível carregar suas rádios favoritas.');
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [currentUser?.user_metadata?.favorite_radios]); // Re-executar se a lista de favoritas mudar

  const handleRemoveFavorite = async (radioId: string) => {
    if (!currentUser?.user_metadata?.favorite_radios) return;

    const updatedFavorites = currentUser.user_metadata.favorite_radios.filter((id: string) => id !== radioId);
    
    try {
      await updateFavoriteRadios(updatedFavorites);
      // O estado local será atualizado pelo useEffect quando currentUser for atualizado
    } catch (error) {
      console.error("Erro ao remover favorita:", error);
      // Opcional: Adicionar toast ou erro visual aqui
    }
  };

  if (loading) {
    return <Loading message="Carregando favoritas..." size="small" />;
  }

  if (error) {
    return <ErrorAlert message={error} onClose={() => setError(null)} />;
  }

  if (favoriteRadios.length === 0) {
    return <p className="text-sm text-gray-500 italic">Você ainda não adicionou rádios favoritas.</p>;
  }

  return (
    <div className="space-y-3">
      {favoriteRadios.map((radio) => (
        <div key={radio.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
          <div className="flex items-center gap-3 overflow-hidden">
            <img 
              src={radio.thumbnail_url || 'https://via.placeholder.com/40?text=?'} 
              alt={radio.name} 
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{radio.name}</span>
          </div>
          <button
            onClick={() => handleRemoveFavorite(radio.id)}
            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            title="Remover dos favoritos"
          >
            <Heart className="w-4 h-4 fill-current" />
          </button>
        </div>
      ))}
    </div>
  );
} 