import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
// import { supabase } from '../../lib/supabase-client'; // Não parece ser mais necessário aqui

// Definir rotas que exigem um plano pago (não FREE)
// const PAID_ROUTES = ['/realtime', '/ranking', '/relatorios'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, planId, loading: authLoading, error: authError, isInitialized, userHasPreferences } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingPreferences, setCheckingPreferences] = useState(true);

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
        } catch (err) {
          console.error("[ProtectedRoute] useEffect - Error checking preferences:", err);
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

  if (!isInitialized || authLoading || checkingPreferences) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando sessão...</p>
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
