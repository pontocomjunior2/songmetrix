import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../Common/Loading';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    // Aguarda um momento para garantir que o webhook do Stripe tenha processado
    const redirectTimer = setTimeout(() => {
      if (currentUser) {
        navigate('/');
      } else {
        navigate('/login');
      }
    }, 5000);

    return () => clearTimeout(redirectTimer);
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Pagamento Confirmado!
        </h2>
        <p className="text-gray-600 mb-8">
          Seu pagamento foi processado com sucesso. Você será redirecionado para o dashboard em instantes...
        </p>
        <Loading size="small" />
      </div>
    </div>
  );
}
