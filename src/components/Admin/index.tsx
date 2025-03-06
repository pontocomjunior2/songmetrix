import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList';
import StreamsManager from './StreamsManager';
import RadioManager from './RadioManager';
import RadioStreams from './RadioStreams';
import PaymentStatusChecker from './PaymentStatusChecker';

type AdminTab = 'users' | 'streams' | 'radios' | 'radiostreams';

export default function AdminDashboard() {
  const [selectedTab, setSelectedTab] = useState<AdminTab>('users');
  const [showPaymentChecker, setShowPaymentChecker] = useState(false);
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  // Detectar ambiente de desenvolvimento
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Painel de Administração</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowWebhookHelp(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Ajuda Webhook
            </button>
            <button
              onClick={() => setShowPaymentChecker(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              Verificar Pagamentos
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
        
        {/* Alerta de ambiente de desenvolvimento */}
        {isDev && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Ambiente de Desenvolvimento:</strong> Os webhooks do Stripe não conseguem alcançar localhost diretamente.
                  <button 
                    className="ml-2 font-medium text-yellow-700 underline"
                    onClick={() => setShowWebhookHelp(true)}
                  >
                    Saiba como resolver
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal para verificação de pagamentos */}
        {showPaymentChecker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="max-w-xl w-full">
              <PaymentStatusChecker onClose={() => setShowPaymentChecker(false)} />
            </div>
          </div>
        )}
        
        {/* Modal de ajuda para webhook */}
        {showWebhookHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Configuração de Webhook para Desenvolvimento</h2>
                <button 
                  onClick={() => setShowWebhookHelp(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                  <p className="text-yellow-700">
                    <strong>Problema:</strong> Em ambiente de desenvolvimento (localhost), o Stripe não consegue enviar webhooks diretamente para sua máquina.
                  </p>
                </div>
                
                <h3>Opção 1: Usar ngrok para expor seu servidor local</h3>
                <ol>
                  <li>Instale o <a href="https://ngrok.com/download" target="_blank" rel="noopener noreferrer">ngrok</a></li>
                  <li>Execute o comando: <code>ngrok http 3001</code></li>
                  <li>Copie a URL fornecida (ex: <code>https://1234-abcd-5678.ngrok.io</code>)</li>
                  <li>Acesse o <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer">painel do Stripe</a> e adicione um novo endpoint de webhook</li>
                  <li>Use a URL do ngrok + /webhook: <code>https://1234-abcd-5678.ngrok.io/webhook</code></li>
                  <li>Selecione os eventos <code>checkout.session.completed</code> e <code>customer.subscription.updated</code></li>
                  <li>Copie o signing secret e atualize no seu arquivo .env: <code>STRIPE_WEBHOOK_SECRET=whsec_...</code></li>
                </ol>
                
                <h3>Opção 2: Usar Stripe CLI para encaminhar eventos</h3>
                <ol>
                  <li>Instale o <a href="https://stripe.com/docs/stripe-cli" target="_blank" rel="noopener noreferrer">Stripe CLI</a></li>
                  <li>Faça login: <code>stripe login</code></li>
                  <li>Execute o comando: <code>stripe listen --forward-to localhost:3001/webhook</code></li>
                  <li>Copie o webhook signing secret fornecido no terminal</li>
                  <li>Atualize seu arquivo .env: <code>STRIPE_WEBHOOK_SECRET=whsec_...</code></li>
                  <li>Em outro terminal, você pode simular eventos: <code>stripe trigger checkout.session.completed</code></li>
                </ol>
                
                <h3>Opção 3: Use a ferramenta de administração (solução temporária)</h3>
                <ol>
                  <li>Após o pagamento ser processado no Stripe, use o botão "Verificar Pagamentos" no painel admin</li>
                  <li>Insira o ID da sessão do Stripe para verificar o status do pagamento</li>
                  <li>Ou use a opção "Verificar e Ativar" ou "Forçar" na lista de usuários para converter manualmente</li>
                </ol>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
                  <p className="text-blue-700">
                    <strong>Dica:</strong> Em produção, o webhook deve estar configurado para <code>https://songmetrix.com.br/webhook</code> com o 
                    signing secret apropriado no arquivo .env de produção.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowWebhookHelp(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setSelectedTab('users')}
                className={`px-6 py-3 font-medium text-sm ${
                  selectedTab === 'users'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Usuários
              </button>
              <button
                onClick={() => setSelectedTab('streams')}
                className={`px-6 py-3 font-medium text-sm ${
                  selectedTab === 'streams'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Streams
              </button>
              <button
                onClick={() => setSelectedTab('radios')}
                className={`px-6 py-3 font-medium text-sm ${
                  selectedTab === 'radios'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Rádios
              </button>
              <button
                onClick={() => setSelectedTab('radiostreams')}
                className={`px-6 py-3 font-medium text-sm ${
                  selectedTab === 'radiostreams'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Associar Streams
              </button>
            </nav>
          </div>
          <div className="p-6">
            {selectedTab === 'users' && <UserList />}
            {selectedTab === 'streams' && <StreamsManager />}
            {selectedTab === 'radios' && <RadioManager />}
            {selectedTab === 'radiostreams' && <RadioStreams />}
          </div>
        </div>
      </div>
    </div>
  );
} 