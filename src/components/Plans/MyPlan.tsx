import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PrimaryButton } from '../Common/Button';
import { Clock, CreditCard, AlertTriangle } from 'lucide-react';

export default function MyPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.message || '';
  const { userStatus, trialDaysRemaining, subscriptionDaysRemaining } = useAuth();

  const handleSubscribe = () => {
    navigate('/plans');
  };

  // Formatar a data de renovação (30 dias após o último pagamento)
  const formatRenewalDate = () => {
    if (subscriptionDaysRemaining === null) return '';
    
    const today = new Date();
    const renewalDate = new Date(today);
    renewalDate.setDate(today.getDate() + subscriptionDaysRemaining);
    return renewalDate.toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Meu Plano</h1>

        {/* Mensagem de Sucesso */}
        {message && (
          <div className="mb-8 p-4 bg-green-50 border-l-4 border-green-400 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status do Plano */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Status da Conta</h2>
          
          {userStatus === 'TRIAL' ? (
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Período de Avaliação
                  </h3>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    {trialDaysRemaining === null ? 'Carregando informações...' : 
                      trialDaysRemaining > 1
                        ? `Você tem ${trialDaysRemaining} dias restantes no seu período de avaliação.`
                        : trialDaysRemaining === 1
                        ? 'Você tem 1 dia restante no seu período de avaliação.'
                        : 'Seu período de avaliação termina hoje.'
                    }
                  </p>
                </div>
              </div>
          
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <CreditCard className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Assine Agora
                    </h3>
                    <p className="mt-1 text-gray-500 dark:text-gray-400 mb-4">
                      Garanta acesso completo a todas as funcionalidades do Songmetrix.
                    </p>
                    <PrimaryButton onClick={handleSubscribe}>
                      Ver Planos Disponíveis
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            </div>
          ) : userStatus === 'ATIVO' ? (
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <CreditCard className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Assinatura Premium Ativa
                  </h3>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    Você tem acesso completo a todas as funcionalidades do Songmetrix.
                  </p>
                </div>
              </div>
              
              {/* Aviso de vencimento próximo */}
              {subscriptionDaysRemaining !== null && subscriptionDaysRemaining <= 5 && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Sua assinatura está próxima do vencimento
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {subscriptionDaysRemaining > 1
                          ? `Restam apenas ${subscriptionDaysRemaining} dias para o vencimento da sua assinatura.`
                          : subscriptionDaysRemaining === 1
                          ? 'Sua assinatura vence amanhã.'
                          : 'Sua assinatura vence hoje.'}
                      </p>
                      <div className="mt-3">
                        <PrimaryButton onClick={handleSubscribe} className="text-sm py-1 px-3">
                          Renovar Agora
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sua assinatura será renovada automaticamente em {formatRenewalDate()}.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <CreditCard className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Plano Inativo
                </h3>
                <p className="mt-1 text-gray-500 dark:text-gray-400 mb-4">
                  Seu plano está inativo. Assine agora para retomar o acesso completo.
                </p>
                <PrimaryButton onClick={handleSubscribe}>
                  Reativar Assinatura
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}