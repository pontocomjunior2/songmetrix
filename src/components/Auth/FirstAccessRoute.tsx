import React, { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import SegmentSelector from '../FirstAccess/SegmentSelector';
import Loading from '../Common/Loading';
import { toast } from 'react-toastify';

export default function FirstAccessRoute() {
  const { currentUser, updateFavoriteSegments, userHasPreferences } = useAuth();
  const [hasPreferencesChecked, setHasPreferencesChecked] = useState<boolean>(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkPreferences = async () => {
      setLoadingCheck(true);
      const hasPrefs = await userHasPreferences();
      setHasPreferencesChecked(hasPrefs);
      setLoadingCheck(false);
    };
    if (currentUser) {
      checkPreferences();
    } else {
      setLoadingCheck(false);
    }
  }, [userHasPreferences, currentUser]);

  const handleSaveSegments = useCallback(async (selectedSegments: string[]) => {
    console.log("Salvando segmentos preferidos:", selectedSegments);
    if (selectedSegments.length === 0) {
      toast.info("Selecione pelo menos um formato de rádio para continuar.");
      return;
    }

    try {
      await updateFavoriteSegments(selectedSegments);

      console.log('Segmentos preferidos salvos com sucesso, redirecionando para dashboard...');
      toast.success('Preferências salvas!');
      navigate('/dashboard');
    } catch (error) {
      console.error("Erro ao salvar segmentos preferidos:", error);
      toast.error("Erro ao salvar suas preferências. Tente novamente.");
      throw error;
    }
  }, [updateFavoriteSegments, navigate]);

  if (loadingCheck) {
    return <Loading />;
  }

  if (hasPreferencesChecked) {
    console.log('Usuário já tem preferências, redirecionando para dashboard...');
    return <Navigate to="/dashboard" replace />;
  }

  if (!loadingCheck && !hasPreferencesChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="max-w-4xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-gray-100">Bem-vindo ao SongMetrix!</h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            Para começar, selecione seus formatos de rádio preferidos. Isso nos ajuda a personalizar seu Dashboard e suas análises.
          </p>
          <SegmentSelector onSave={handleSaveSegments} />
          <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
            Você poderá alterar suas preferências a qualquer momento no seu perfil.
          </p>
        </div>
      </div>
    );
  }

  return <Loading />;
}
