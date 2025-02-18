import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton } from '../Common/Button';

export default function PendingApproval() {
  const navigate = useNavigate();

  const handleContactClick = () => {
    window.open('https://wa.me/5511999999999', '_blank'); // Replace with your actual WhatsApp number
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full p-8 bg-white rounded-lg shadow-lg text-center">
        <img
          className="mx-auto h-12 w-auto mb-6"
          src="/logo.svg"
          alt="SongMetrix"
        />
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Sua assinatura está pendente de aprovação
              </p>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Conta Aguardando Aprovação
        </h2>
        
        <div className="space-y-4 text-gray-600">
          <p className="text-lg">
            Seu login foi criado, porém para ter acesso ao sistema você precisa adquirir uma assinatura.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Por que escolher o SongMetrix?</h3>
            <ul className="text-left text-blue-700 space-y-2">
              <li>✓ Análise em tempo real das músicas mais tocadas</li>
              <li>✓ Insights valiosos para sua programação musical</li>
              <li>✓ Relatórios detalhados de performance</li>
              <li>✓ Suporte técnico especializado</li>
            </ul>
          </div>
          
          <p>
            Entre em contato com nosso atendimento para ativar sua assinatura e começar a usar todas as funcionalidades do SongMetrix.
          </p>
          
          <p className="font-medium text-blue-600">
            Não perca a chance de ter inteligência musical a favor da sua rádio!
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <PrimaryButton
            onClick={handleContactClick}
            fullWidth
            className="bg-green-600 hover:bg-green-700"
          >
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              Falar com Atendimento
            </div>
          </PrimaryButton>
          
          <PrimaryButton
            onClick={() => navigate('/login')}
            fullWidth
            className="bg-gray-600 hover:bg-gray-700"
          >
            Voltar para Login
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
