import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userStatus } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasFavorites, setHasFavorites] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkUserFavorites = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        // Check user's favorite radios from metadata
        const favorites = currentUser.user_metadata?.favorite_radios || [];
        setHasFavorites(favorites.length > 0);
      } catch (error) {
        console.error('Error checking favorite radios:', error);
        setHasFavorites(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserFavorites();
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (userStatus === 'INATIVO') {
    return <Navigate to="/pending-approval" replace />;
  }

  // For admin users, allow access to all routes
  if (userStatus === 'ADMIN') {
    return <>{children}</>;
  }

  // For regular users
  if (userStatus === 'ATIVO') {
    // Only block access to admin-specific routes
    if (location.pathname.startsWith('/admin/')) {
      return <Navigate to="/ranking" replace />;
    }

    // If user hasn't selected favorite radios, redirect to first access
    if (hasFavorites === false && location.pathname !== '/first-access') {
      return <Navigate to="/first-access" replace />;
    }

    return <>{children}</>;
  }

  // If we get here, something is wrong with the user's status
  return <Navigate to="/login" replace />;
}
