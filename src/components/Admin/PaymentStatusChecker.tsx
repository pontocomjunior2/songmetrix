import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentStatusCheckerProps {
  onClose: () => void;
}

export default function PaymentStatusChecker({ onClose }: PaymentStatusCheckerProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { userStatus } = useAuth();

  // Verificar se o usuário é administrador
  if (userStatus !== 'ADMIN') {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Acesso negado. Esta ferramenta é apenas para administradores.</p>
      </div>
    );
  }

  const handleCheckSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionId) {
      setError("ID da sessão é obrigatório");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const response = await fetch(`/check-payment-status/${sessionId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar status da sessão');
      }
      
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao verificar status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertUser = async () => {
    if (!userId) {
      setError("ID do usuário é obrigatório");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/convert-user-to-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          forceConversion: false
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao converter usuário');
      }
      
      setResults({
        title: 'Conversão realizada',
        message: 'Usuário convertido com sucesso',
        details: data
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao converter usuário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceConvertUser = async () => {
    if (!userId) {
      setError("ID do usuário é obrigatório");
      return;
    }
    
    if (!window.confirm('Tem certeza que deseja forçar a conversão deste usuário para ATIVO?')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/convert-user-to-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          forceConversion: true
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao converter usuário');
      }
      
      setResults({
        title: 'Conversão forçada realizada',
        message: 'Usuário convertido para ATIVO com sucesso (forçado)',
        details: data
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao converter usuário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded p-6 max-w-lg mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Verificador de Status de Pagamento</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          Fechar
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h3 className="font-semibold mb-3">Verificar Sessão do Stripe</h3>
          <form onSubmit={handleCheckSession} className="space-y-3">
            <div>
              <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700">
                ID da sessão do Stripe
              </label>
              <input
                type="text"
                id="sessionId"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="cs_test_..."
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Verificando...' : 'Verificar Status'}
            </button>
          </form>
        </div>
        
        <div className="border-b pb-4">
          <h3 className="font-semibold mb-3">Converter Usuário para ATIVO</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                ID do usuário
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="ID do usuário no Supabase"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleConvertUser}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isLoading ? 'Processando...' : 'Verificar e Ativar'}
              </button>
              <button
                onClick={handleForceConvertUser}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
              >
                {isLoading ? 'Processando...' : 'Forçar Ativação'}
              </button>
            </div>
          </div>
        </div>
        
        {results && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">{results.title || 'Resultados'}</h3>
            {results.message && <p className="mb-2">{results.message}</p>}
            <pre className="bg-gray-100 p-3 rounded-md overflow-auto text-xs">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 