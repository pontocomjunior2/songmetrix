import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../Common/Loading';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();

  useEffect(() => {
    // Chamar refreshUserData para atualizar o estado do usuário em background
    refreshUserData().catch(err => {
      console.error("Erro ao atualizar dados do usuário após pagamento:", err);
      // Mesmo com erro, ainda redirecionamos.
    });

    // Aguarda um momento e redireciona para a página principal
    const redirectTimer = setTimeout(() => {
      console.log('Redirecionando para / após sucesso do pagamento...');
        navigate('/');
    }, 3000); // Aumentar um pouco o tempo se necessário

    return () => clearTimeout(redirectTimer);
    // Remover refreshUserData das dependências pois só queremos rodar na montagem
  }, [navigate]); 

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-4">
      <div className="bg-white shadow-xl rounded-lg p-8 text-center max-w-md">
        <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Pagamento Realizado com Sucesso!</h2>
        <p className="text-gray-600 mb-6">
          Seu plano foi ativado. Você será redirecionado em breve...
        </p>
        <Loading message="Redirecionando..." size="medium" />
      </div>
    </div>
  );
}
