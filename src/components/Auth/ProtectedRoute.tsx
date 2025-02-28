import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userStatus, refreshUserStatus, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasFavorites, setHasFavorites] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Referências para controlar o fluxo de autenticação
  const initialCheckCompleted = useRef(false);
  const isVerifyingSession = useRef(false);
  const retryCount = useRef(0);
  
  // Verificar rapidamente se há uma sessão no storage
  const hasStoredSession = () => {
    try {
      const storageKey = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
      return !!sessionStorage.getItem(storageKey);
    } catch (e) {
      return false;
    }
  };

  // Verificar autenticação apenas na montagem inicial do componente
  useEffect(() => {
    // Se a verificação inicial já foi concluída ou está sendo feita, não executar novamente
    if (initialCheckCompleted.current || isVerifyingSession.current) {
      return;
    }
    
    // Se o AuthContext ainda está carregando e temos uma sessão armazenada, aguardar
    if (authLoading && hasStoredSession()) {
      return;
    }
    
    // Se já temos usuário e status, não é necessário verificar novamente
    if (currentUser && userStatus) {
      initialCheckCompleted.current = true;
      setIsLoading(false);
      return;
    }
    
    let isMounted = true;
    isVerifyingSession.current = true;
    
    // Função para verificar autenticação
    const checkAuth = async () => {
      try {
        // Verificar sessão rapidamente primeiro
        if (!hasStoredSession()) {
          if (isMounted) {
            setIsLoading(false);
            initialCheckCompleted.current = true;
            isVerifyingSession.current = false;
            
            // Redirecionar para login se estamos em uma rota protegida
            if (!location.pathname.startsWith('/login') && 
                !location.pathname.startsWith('/signup') && 
                !location.pathname.startsWith('/reset-password')) {
              navigate('/login', { replace: true });
            }
          }
          return;
        }
        
        // Temos sessão armazenada, obter sessão da API
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          // Erro ou sem sessão, tentar refresh
          if (retryCount.current < 2) {
            retryCount.current++;
            await refreshUserStatus();
            
            if (isMounted) {
              // Verificar se agora temos usuário após o refresh
              if (currentUser) {
                initialCheckCompleted.current = true;
                setIsLoading(false);
                isVerifyingSession.current = false;
                return;
              }
            }
          }
          
          if (isMounted) {
            // Se ainda não temos usuário após tentativas, mostrar erro
            setSessionError("Falha ao restaurar sessão");
            setIsLoading(false);
            initialCheckCompleted.current = true;
            isVerifyingSession.current = false;
          }
          return;
        }
        
        // Temos sessão mas não usuário no contexto, atualizar status
        if (!currentUser) {
          await refreshUserStatus();
        }
        
        if (isMounted) {
          setIsLoading(false);
          initialCheckCompleted.current = true;
          isVerifyingSession.current = false;
        }
      } catch (error) {
        if (isMounted) {
          setSessionError("Erro ao verificar autenticação");
          setIsLoading(false);
          initialCheckCompleted.current = true;
          isVerifyingSession.current = false;
        }
      }
    };
    
    // Executar verificação
    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, [currentUser, userStatus, refreshUserStatus, authLoading, navigate, location.pathname]);

  // Verificar favoritos quando o usuário estiver disponível
  useEffect(() => {
    // Só verificar favoritos se o usuário estiver autenticado e não tivermos verificado ainda
    if (!currentUser || hasFavorites !== null || isLoading) {
      return;
    }

    let isMounted = true;
    
    const checkUserFavorites = async () => {
      try {
        // Verificar favoritos do metadado do usuário
        const favorites = currentUser.user_metadata?.favorite_radios || [];
        if (isMounted) setHasFavorites(favorites.length > 0);
      } catch (error) {
        if (isMounted) setHasFavorites(false);
      }
    };

    checkUserFavorites();
    
    return () => {
      isMounted = false;
    };
  }, [currentUser, hasFavorites, isLoading]);

  // Mostrar loader enquanto verifica autenticação inicial
  if (authLoading || (isLoading && hasStoredSession())) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Carregando sua sessão...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro se houver falha na verificação
  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Erro de Autenticação</h2>
          <p className="text-gray-700 mb-4">{sessionError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Redirecionar para login se não temos usuário
  if (!currentUser && !hasStoredSession()) {
    return <Navigate to="/login" replace />;
  }

  // Verificações de status do usuário
  if (userStatus === 'INATIVO') {
    return <Navigate to="/plans" state={{ 
      trialExpired: true, 
      message: 'Seu período de avaliação gratuito expirou. Escolha um plano para continuar utilizando o sistema.' 
    }} replace />;
  }

  // Para admin, permitir acesso a qualquer rota
  if (userStatus === 'ADMIN') {
    return <>{children}</>;
  }

  // Para usuários regulares
  if (userStatus === 'ATIVO' || userStatus === 'TRIAL') {
    // Bloquear acesso a rotas de admin
    if (location.pathname.startsWith('/admin/')) {
      return <Navigate to="/ranking" replace />;
    }

    // Verificar se o usuário selecionou rádios favoritas
    if (hasFavorites === false && location.pathname !== '/first-access') {
      return <Navigate to="/first-access" replace />;
    }

    return <>{children}</>;
  }

  // Aguardar enquanto verificamos o status (durante refresh)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">Verificando permissões...</p>
      </div>
    </div>
  );
}
