import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/firebase';
import { LoadingScreen } from '../Common/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userStatus, loading, redirectToStripeCheckout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (currentUser && userStatus === UserStatus.NOT_PAID) {
        try {
          await redirectToStripeCheckout();
        } catch (error) {
          console.error('Erro ao redirecionar para checkout:', error);
        }
      }
    };

    checkPaymentStatus();
  }, [currentUser, userStatus, redirectToStripeCheckout]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    // Redireciona para o login, salvando a localização atual
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (userStatus === UserStatus.NOT_PAID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Assinatura Necessária
          </h2>
          <p className="text-gray-600 mb-6">
            Para acessar o conteúdo, é necessário completar sua assinatura.
            Você será redirecionado para o checkout em instantes...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Se o usuário está autenticado e tem status PAID ou ADMIN, renderiza o conteúdo protegido
  return <>{children}</>;
}
