import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
// import { supabase } from '../../lib/supabase-client'; // Não parece ser mais necessário aqui

// Definir rotas que exigem um plano pago (não FREE)
// const PAID_ROUTES = ['/realtime', '/ranking', '/relatorios'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, planId, loading: authLoading, error: authError, isInitialized, userHasPreferences, emergencyReset } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingPreferences, setCheckingPreferences] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [showEmergencyButton, setShowEmergencyButton] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (isInitialized && currentUser) {
      setCheckingPreferences(true);
      const check = async () => {
        try {
          const hasPrefs = await userHasPreferences();

          if (isMounted) {
            if (!hasPrefs && location.pathname !== '/first-access') {
              navigate('/first-access', { replace: true });
            } else {
              setCheckingPreferences(false);
            }
          }

          // Verificação adicional: se já estamos no dashboard e não temos preferências,
          // mas o usuário acabou de salvar, aguardar um pouco e verificar novamente
          if (hasPrefs === false && location.pathname === '/dashboard') {
            setTimeout(async () => {
              const hasPrefsAgain = await userHasPreferences();
              if (hasPrefsAgain && isMounted) {
                setCheckingPreferences(false);
              }
            }, 1000);
          }
        } catch (err) {
          if (isMounted) {
            setCheckingPreferences(false);
          }
        }
      };
      check();
    } else if (isInitialized && !currentUser) {
      setCheckingPreferences(false);
    }
    return () => {
      isMounted = false;
    };
  }, [isInitialized, currentUser, userHasPreferences, location.pathname, navigate]);

  // Efeito para mostrar botão de emergência após alguns segundos
  useEffect(() => {
    if (!isInitialized || authLoading || checkingPreferences) {
      const buttonTimeout = setTimeout(() => {
        setShowEmergencyButton(true);
      }, 5000); // 5 segundos

      return () => clearTimeout(buttonTimeout);
    } else {
      setShowEmergencyButton(false);
    }
  }, [isInitialized, authLoading, checkingPreferences]);

  // Efeito para detectar travamento no loading e tentar recuperação
  useEffect(() => {
    if (!isInitialized || authLoading || checkingPreferences) {
      const timeout = setTimeout(() => {
        if (retryCount < 3) {
          setRetryCount(prev => prev + 1);

          // Limpeza completa e agressiva
          try {
            // 1. Limpar localStorage completamente
            const allKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) allKeys.push(key);
            }
            allKeys.forEach(key => localStorage.removeItem(key));

            // 2. Limpar sessionStorage
            sessionStorage.clear();

            // 3. Limpar cookies relacionados
            document.cookie.split(";").forEach(c => {
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // 4. Limpar cache do navegador
            if ('caches' in window) {
              caches.keys().then(names => {
                names.forEach(name => {
                  caches.delete(name);
                });
              });
            }

            // 5. Forçar recarga da página
            window.location.href = window.location.href;

          } catch (error) {
            // Fallback: tentar apenas recarregar
            window.location.reload();
          }
        }
      }, 8000); // 8 segundos (mais rápido)

      return () => clearTimeout(timeout);
    } else {
      setRetryCount(0); // Resetar contador se não estiver mais carregando
    }
  }, [isInitialized, authLoading, checkingPreferences, retryCount]);

  if (!isInitialized || authLoading || checkingPreferences) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Carregando sessão...</p>
          {showEmergencyButton && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Parece que algo está travado.</p>
              <Button
                onClick={emergencyReset}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                🔄 Resetar Aplicação
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isInitialized && authError && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
         <div className="text-center p-6 bg-card rounded-lg shadow-md border border-destructive">
           <h2 className="text-xl font-bold text-destructive mb-4">Erro de Autenticação</h2>
           <p className="text-muted-foreground mb-4">
             {authError || 'Não foi possível verificar sua sessão. Tente novamente.'}
           </p>
           <button
             onClick={() => window.location.href = '/login'} // Forçar recarga para /login
             className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
           >
             Ir para Login
           </button>
         </div>
       </div>
    );
  }

  if (isInitialized && !checkingPreferences && !currentUser) {
    console.error(`[ProtectedRoute] CRITICAL: Navigating to /login! State: isInitialized=${isInitialized}, currentUser=${!!currentUser}, checkingPreferences=${checkingPreferences}`);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!currentUser) {
    console.warn('[ProtectedRoute] Warning: Reached end of checks without currentUser, redirecting to login as safeguard.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminPlan = planId === 'ADMIN';

  if (isAdminRoute && !isAdminPlan) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
