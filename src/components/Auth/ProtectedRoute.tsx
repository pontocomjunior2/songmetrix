import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/firebase';
import Loading from '../Common/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { currentUser, userStatus, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading size="large" message="Carregando..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (userStatus === UserStatus.INATIVO) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Se requer admin, verifica se o usuário é admin
  if (requireAdmin && userStatus !== UserStatus.ADMIN) {
    return <Navigate to="/dashboard" replace />;
  }

  // Se não requer admin, verifica se o usuário está ativo ou é admin
  if (!requireAdmin && userStatus !== UserStatus.ATIVO && userStatus !== UserStatus.ADMIN) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
