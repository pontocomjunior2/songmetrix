import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
// import { supabase } from '../../lib/supabase-client'; // Não parece ser mais necessário aqui

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, planId, loading: authLoading, error: authError } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (authError && !currentUser) {
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

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminPlan = planId === 'ADMIN';

  if (isAdminRoute && !isAdminPlan) {
     return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
