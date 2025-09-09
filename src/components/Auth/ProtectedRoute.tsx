import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  console.log('[ProtectedRoute] 🚀 COMPONENT MOUNTED - ProtectedRoute initialized');

  const { currentUser, loading: authLoading, isInitialized, userHasPreferences } = useAuth();
  const location = useLocation();
  const [checkingPreferences, setCheckingPreferences] = useState(false);
  const [shouldRedirectToFirstAccess, setShouldRedirectToFirstAccess] = useState(false);

  console.log('[ProtectedRoute] 🔒 Check:', {
    currentUser: !!currentUser,
    authLoading,
    isInitialized,
    checkingPreferences,
    pathname: location.pathname,
    hasUser: !!currentUser,
    userId: currentUser?.id,
    userEmail: currentUser?.email,
    userMetadata: currentUser?.user_metadata
  });

  // 🔥 Efeito para verificar preferências do usuário
  useEffect(() => {
    console.log('[ProtectedRoute] 🔄 PREFERENCE CHECK EFFECT triggered');
    console.log('[ProtectedRoute] 📊 Effect conditions:', {
      hasCurrentUser: !!currentUser,
      isInitialized,
      authLoading,
      pathname: location.pathname,
      isNotFirstAccess: location.pathname !== '/first-access',
      hasUserHasPreferences: !!userHasPreferences
    });

    if (currentUser && isInitialized && !authLoading && location.pathname !== '/first-access' && userHasPreferences) {
      console.log('[ProtectedRoute] 🔍 Checking user preferences...');
      console.log('[ProtectedRoute] 👤 Current user metadata:', currentUser.user_metadata);
      setCheckingPreferences(true);

      userHasPreferences().then((hasPrefs) => {
        console.log('[ProtectedRoute] 📋 User has preferences?', hasPrefs);
        console.log('[ProtectedRoute] 📊 Preference check details:', {
          hasSegments: !!(currentUser.user_metadata?.favorite_segments?.length > 0),
          hasRadios: !!(currentUser.user_metadata?.favorite_radios?.length > 0),
          segments: currentUser.user_metadata?.favorite_segments,
          radios: currentUser.user_metadata?.favorite_radios
        });
        setCheckingPreferences(false);

        if (!hasPrefs) {
          console.log('[ProtectedRoute] 🎯 No preferences found, will redirect to first access');
          setShouldRedirectToFirstAccess(true);
        } else {
          console.log('[ProtectedRoute] ✅ User has preferences, allowing normal access');
        }
      }).catch((error) => {
        console.error('[ProtectedRoute] ❌ Error checking preferences:', error);
        setCheckingPreferences(false);
      });
    } else {
      console.log('[ProtectedRoute] ⏭️ Skipping preference check - conditions not met');
    }
  }, [currentUser, isInitialized, authLoading, location.pathname, userHasPreferences]);

  console.log('[ProtectedRoute] 🎯 RENDER DECISION - Current state:', {
    authLoading,
    isInitialized,
    checkingPreferences,
    hasCurrentUser: !!currentUser,
    shouldRedirectToFirstAccess,
    pathname: location.pathname
  });

  // Carregando autenticação ou verificando preferências
  if (authLoading || !isInitialized || checkingPreferences) {
    console.log('[ProtectedRoute] ⏳ Showing loading screen');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {checkingPreferences ? 'Verificando suas preferências...' : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  // Não logado - redireciona para login
  if (!currentUser) {
    console.log('[ProtectedRoute] 🔒 User not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 🔥 Nenhuma preferência encontrada - redirecionar para primeiro acesso
  if (shouldRedirectToFirstAccess && location.pathname !== '/first-access') {
    console.log('[ProtectedRoute] 🎯 Redirecting to first access due to no preferences');
    return <Navigate to="/first-access" replace />;
  }

  // Logado e com preferências - permite acesso
  console.log('[ProtectedRoute] ✅ User authenticated with preferences, allowing access');
  return <>{children}</>;
}
