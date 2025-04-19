import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
// import { supabase } from '../../lib/supabase-client'; // Não parece ser mais necessário aqui

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, planId, loading: authLoading, error: authError, isInitialized } = useAuth();
  const location = useLocation();
  console.log('[ProtectedRoute] Rendering. Initialized:', isInitialized, 'Loading:', authLoading, 'User:', !!currentUser, 'planId:', planId, 'Location:', location.pathname);

  if (!isInitialized || authLoading) {
    console.log('[ProtectedRoute] Condition: Not Initialized or Loading. Showing loader.');
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

  if (isInitialized && !currentUser) {
    console.error(`[ProtectedRoute] CRITICAL: Navigating to /login! State: isInitialized=${isInitialized}, currentUser=${currentUser}, planId=${planId}, authLoading=${authLoading}, authError=${authError}`);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminPlan = planId === 'ADMIN';

  if (isAdminRoute && !isAdminPlan) {
    console.log('[ProtectedRoute] Condition: Admin Route, Not Admin Plan. Navigating to /dashboard.');
    return <Navigate to="/dashboard" replace />;
  }

  // Se chegou aqui, está autorizado
  console.log('[ProtectedRoute] Condition: Authorized. Rendering children.');
  return <>{children}</>;
}
