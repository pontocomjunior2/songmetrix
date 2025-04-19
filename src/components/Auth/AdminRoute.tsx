import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { currentUser, planId, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = planId === 'ADMIN';

  if (!isAdmin) {
    console.log(`AdminRoute: Access denied for user ${currentUser.id}. PlanId: ${planId}. Redirecting.`);
    return <Navigate to="/ranking" replace />;
  }

  console.log(`AdminRoute: Access granted for user ${currentUser.id}. PlanId: ${planId}.`);
  return <>{children}</>;
}
