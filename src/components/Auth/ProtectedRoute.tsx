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

  console.log('[ProtectedRoute] Rendering. Initialized:', isInitialized, 'Loading:', authLoading, 'User:', !!currentUser, 'planId:', planId, 'Location:', location.pathname, 'CheckingPrefs:', checkingPreferences);

  useEffect(() => {
    let isMounted = true;

    if (isInitialized && currentUser) {
      setCheckingPreferences(true);
      console.log('[ProtectedRoute] useEffect - Checking preferences...');
      const check = async () => {
        try {
          const hasPrefs = await userHasPreferences();
          console.log('[ProtectedRoute] useEffect - hasPreferences result:', hasPrefs);
          if (isMounted) {
            if (!hasPrefs && location.pathname !== '/first-access') {
              console.log('[ProtectedRoute] useEffect - No preferences found, navigating to /first-access.');
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
        } finally {
          console.log('[ProtectedRoute] useEffect - Preference check attempt finished.');
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
    console.log(`[ProtectedRoute] Condition: Loading. Initialized=${!isInitialized}, AuthLoading=${authLoading}, CheckingPrefs=${checkingPreferences}. Showing loader.`);
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
    console.log('[ProtectedRoute] Condition: Initialized, Auth Error, No User. Showing error page.');
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
    console.log('[ProtectedRoute] Condition: Admin Route, Not Admin Plan. Navigating to /dashboard.');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[ProtectedRoute] Condition: Authorized & Preferences OK / Navigating or on /first-access. Rendering children.');
  return <>{children}</>;
}
