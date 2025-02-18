import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/firebase';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { currentUser, userStatus } = useAuth();

  // Se não estiver autenticado, redireciona para login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Se não for admin, redireciona para o dashboard
  if (userStatus !== UserStatus.ADMIN) {
    return <Navigate to="/dashboard" />;
  }

  // Se for admin, permite o acesso
  return <>{children}</>;
}
