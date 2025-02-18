import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { RadioStatus } from '../../types/components';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userStatus } = useAuth();
  const [hasFavorites, setHasFavorites] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkFavorites = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/radios/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data: RadioStatus[] = await response.json();
          const favoriteRadios = data.filter(radio => radio.isFavorite);
          setHasFavorites(favoriteRadios.length > 0);
        } else if (response.status === 403) {
          // Se receber 403, ainda permitimos continuar para selecionar favoritas
          setHasFavorites(false);
        } else {
          throw new Error('Falha ao verificar rádios favoritas');
        }
      } catch (error) {
        console.error('Erro ao verificar rádios favoritas:', error);
        setError('Erro ao verificar rádios favoritas');
        setHasFavorites(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkFavorites();
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (userStatus === 'INATIVO') {
    return <Navigate to="/pending-approval" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  // Se o usuário não tem rádios favoritas, redireciona para a tela de primeiro acesso
  if (hasFavorites === false) {
    return <Navigate to="/first-access" />;
  }

  return <>{children}</>;
}
