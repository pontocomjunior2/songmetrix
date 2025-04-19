import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import FavoriteRadios from '../Radios/FavoriteRadios';
import Loading from '../Common/Loading';
import { PrimaryButton } from '../Common/Button';
import { toast } from 'react-toastify';

export default function FirstAccessRoute() {
  const { currentUser, updateFavoriteRadios } = useAuth();
  const [hasFavorites, setHasFavorites] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser?.user_metadata?.favorite_radios?.length > 0) {
      setHasFavorites(true);
    } else {
      setHasFavorites(false);
    }
    setLoading(false);
  }, [currentUser]);

  const handleSaveFavorites = async (selectedRadios: string[]) => {
    console.log("Salvando favoritas...");
    try {
      if (selectedRadios.length === 0) {
        toast.info("Selecione pelo menos uma rádio favorita para continuar.");
        return;
      }

      await updateFavoriteRadios(selectedRadios);

      console.log('Rádios favoritas salvas com sucesso, redirecionando para dashboard...');
      toast.success('Preferências salvas!');
      navigate('/dashboard');
    } catch (error) {
      console.error("Erro ao salvar favoritas:", error);
      toast.error("Erro ao salvar suas preferências. Tente novamente.");
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (hasFavorites === true) {
    console.log('Usuário já tem favoritas, redirecionando...');
    return <Navigate to="/dashboard" replace />;
  }

  if (hasFavorites === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-gray-100">Bem-vindo ao SongMetrix!</h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">Para começar, selecione algumas das suas rádios favoritas. Isso nos ajuda a personalizar sua experiência.</p>
          <FavoriteRadios />
          <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
            Você poderá alterar suas favoritas a qualquer momento no seu perfil.
          </p>
        </div>
      </div>
    );
  }

  return <Loading />;
}
