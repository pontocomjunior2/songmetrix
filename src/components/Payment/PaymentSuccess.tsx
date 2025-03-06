import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, refreshUserStatus, userStatus } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [message, setMessage] = useState('Confirmando sua assinatura...');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10; // Número máximo de tentativas
  
  // Extrair o session_id do URL se disponível
  const searchParams = new URLSearchParams(location.search);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    const verifyPaymentStatus = async () => {
      console.log(`Tentativa ${retryCount + 1} de verificar status do pagamento`);
      
      if (!currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        // Se tiver o ID da sessão, verifique o status diretamente com a API
        if (sessionId) {
          console.log('Verificando status da sessão:', sessionId);
          
          // Chamar a API para verificar o status do pagamento
          const response = await fetch(`/check-payment-status/${sessionId}`);
          
          if (!response.ok) {
            throw new Error(`Erro ao verificar status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Resposta da verificação de pagamento:', data);
          
          // Se o usuário foi atualizado para ATIVO pelo endpoint
          if (data.user && data.user.status === 'ATIVO') {
            console.log('Usuário atualizado para ATIVO pelo endpoint');
            
            // Forçar refresh para atualizar o contexto
            await refreshUserStatus();
            
            setIsVerifying(false);
            setMessage('Assinatura confirmada! Redirecionando...');
            
            // Redireciona para a página Meu Plano com mensagem de sucesso
            setTimeout(() => {
              navigate('/my-plan', { 
                state: { 
                  message: 'Sua assinatura foi ativada com sucesso! Você tem acesso completo por 30 dias.'
                }
              });
            }, 1500);
            return;
          }
          
          // Se o pagamento foi confirmado no Stripe, mas o usuário ainda está como TRIAL
          if (data.session.payment_status === 'paid' && data.user && data.user.status === 'TRIAL') {
            console.log('Pagamento confirmado, mas usuário ainda em TRIAL. Tentando novamente.');
            
            // Chamar a API novamente para forçar a atualização (o endpoint fará a correção)
            await fetch(`/check-payment-status/${sessionId}`);
            
            // Forçar refresh para atualizar o contexto
            await refreshUserStatus();
            
            if (userStatus === 'ATIVO') {
              console.log('Status atualizado para ATIVO após correção');
              setIsVerifying(false);
              setMessage('Assinatura confirmada! Redirecionando...');
              
              setTimeout(() => {
                navigate('/my-plan', { 
                  state: { 
                    message: 'Sua assinatura foi ativada com sucesso! Você tem acesso completo por 30 dias.'
                  }
                });
              }, 1500);
              return;
            }
          }
        }
        
        // Como fallback, tenta atualizar o status via refreshUserStatus
        await refreshUserStatus();
        
        if (userStatus === 'ATIVO') {
          console.log('Status atualizado para ATIVO via refreshUserStatus');
          setIsVerifying(false);
          setMessage('Assinatura confirmada! Redirecionando...');
          
          // Redireciona para a página Meu Plano com mensagem de sucesso
          setTimeout(() => {
            navigate('/my-plan', { 
              state: { 
                message: 'Sua assinatura foi ativada com sucesso! Você tem acesso completo por 30 dias.'
              }
            });
          }, 1500);
          return;
        }
        
        // Se o status ainda não foi atualizado, verificar diretamente no banco
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('status, last_payment_date')
          .eq('id', currentUser.id)
          .single();
        
        if (dbError) {
          console.error('Erro ao verificar status no banco:', dbError);
          throw dbError;
        }
        
        if (userData.status === 'ATIVO') {
          console.log('Status ATIVO encontrado no banco de dados');
          
          // Forçar atualização dos metadados para sincronizar
          await supabase.auth.updateUser({
            data: { 
              ...currentUser.user_metadata,
              status: 'ATIVO' 
            }
          });
          
          // Forçar refresh para atualizar o contexto
          await refreshUserStatus();
          
          setIsVerifying(false);
          setMessage('Assinatura confirmada! Redirecionando...');
          
          // Redireciona para a página Meu Plano com mensagem de sucesso
          setTimeout(() => {
            navigate('/my-plan', { 
              state: { 
                message: 'Sua assinatura foi ativada com sucesso! Você tem acesso completo por 30 dias.'
              }
            });
          }, 1500);
          return;
        }
        
        // Se ainda está como TRIAL, verificar se atingiu o número máximo de tentativas
        if (retryCount >= maxRetries) {
          console.log('Número máximo de tentativas atingido, redirecionando mesmo assim');
          setIsVerifying(false);
          setMessage('Pagamento recebido! Seu status será atualizado em breve.');
          
          // Redireciona para a página Meu Plano com uma mensagem diferente
          setTimeout(() => {
            navigate('/my-plan', { 
              state: { 
                message: 'Seu pagamento foi recebido! Seu status será atualizado automaticamente em alguns instantes.'
              }
            });
          }, 2000);
          return;
        }
        
        // Ainda não está atualizado, aumentar contador e tentar novamente
        setRetryCount(prev => prev + 1);
        setMessage(`Aguardando confirmação do pagamento... (Tentativa ${retryCount + 1}/${maxRetries})`);
        
        // Aguardar 3 segundos antes da próxima tentativa
        timer = setTimeout(verifyPaymentStatus, 3000);
      } catch (error) {
        console.error('Erro ao verificar status de pagamento:', error);
        
        // Em caso de erro, tentar novamente se não atingiu o limite
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          timer = setTimeout(verifyPaymentStatus, 3000);
        } else {
          // Atingiu o limite, redirecionar mesmo assim
          navigate('/my-plan', { 
            state: { 
              message: 'Seu pagamento foi processado, mas estamos tendo dificuldades para atualizar seu status. Tente atualizar a página em alguns instantes.'
            }
          });
        }
      }
    };
    
    // Iniciar verificação quando o componente for montado
    verifyPaymentStatus();
    
    // Limpar timer quando componente for desmontado
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentUser, navigate, refreshUserStatus, userStatus, retryCount, sessionId]);

  return (
    <div className="flex items-center justify-center bg-gray-50 min-h-screen">
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
          {message}
        </p>
        {isVerifying && <Loading size="small" />}
        {sessionId && (
          <p className="text-xs text-gray-400 mt-4">
            ID da sessão: {sessionId.substring(0, 10)}...
          </p>
        )}
      </div>
    </div>
  );
}
