import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../types/auth';
import { supabase } from '../../lib/supabase-client';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = () => {
      if (!currentUser) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Check admin status from user metadata
      const userStatus = currentUser.user_metadata?.status;
      setIsAdmin(userStatus === UserStatus.ADMIN);
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  // Se não estiver autenticado, redireciona para login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Se não for admin, redireciona para a página de ranking
  if (!isAdmin) {
    return <Navigate to="/ranking" />;
  }

  // Se for admin, permite o acesso
  return <>{children}</>;
}
