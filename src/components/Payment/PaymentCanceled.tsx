import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton } from '../Common/Button';

export default function PaymentCanceled() {
  const navigate = useNavigate();

  const handleTryAgain = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Pagamento Cancelado
        </h2>
        <p className="text-gray-600 mb-8">
          O processo de pagamento foi cancelado. Você pode tentar novamente quando quiser.
        </p>
        <div className="flex justify-center">
          <PrimaryButton onClick={handleTryAgain}>
            Tentar Novamente
          </PrimaryButton>
        </div>
        <div className="mt-4">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );
}
