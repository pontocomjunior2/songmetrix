import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  console.log('[ProtectedRoute] 🚀 COMPONENT MOUNTED - ProtectedRoute initialized');

  const { currentUser, loading: authLoading, isInitialized, userHasPreferences } = useAuth();
  const location = useLocation();
  const [checkingPreferences, setCheckingPreferences] = useState(false);
  const [shouldRedirectToFirstAccess, setShouldRedirectToFirstAccess] = useState(false);
  const hasCheckedPrefsRef = useRef<string | null>(null); // userId para quem já checamos
  const checkingInFlightRef = useRef(false);

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

  // 🔥 Efeito para verificar preferências do usuário (controlado por ref para evitar loop)
  useEffect(() => {
    console.log('[ProtectedRoute] 🔄 PREFERENCE CHECK EFFECT triggered');
    console.log('[ProtectedRoute] 📊 Effect conditions:', {
      hasCurrentUser: !!currentUser,
      isInitialized,
      authLoading,
      pathname: location.pathname,
      isNotFirstAccess: location.pathname !== '/first-access',
      hasCheckedPrefsForUser: hasCheckedPrefsRef.current === currentUser?.id,
      checkingInFlight: checkingInFlightRef.current,
    });

    // Só checar quando:
    // - há usuário
    // - auth inicializada e não carregando
    // - não estamos na página de primeiro acesso
    // - ainda não checamos para este usuário
    if (
      currentUser &&
      isInitialized &&
      !authLoading &&
      location.pathname !== '/first-access' &&
      hasCheckedPrefsRef.current !== currentUser.id &&
      !checkingInFlightRef.current
    ) {
      console.log('[ProtectedRoute] 🔍 Checking user preferences...');
      console.log('[ProtectedRoute] 👤 Current user metadata:', currentUser.user_metadata);

      setCheckingPreferences(true);
      checkingInFlightRef.current = true;

      userHasPreferences()
        .then((hasPrefs) => {
          console.log('[ProtectedRoute] 📋 User has preferences?', hasPrefs);
          console.log('[ProtectedRoute] 📊 Preference check details:', {
            hasSegments: !!(currentUser.user_metadata?.favorite_segments?.length > 0),
            hasRadios: !!(currentUser.user_metadata?.favorite_radios?.length > 0),
            segments: currentUser.user_metadata?.favorite_segments,
            radios: currentUser.user_metadata?.favorite_radios,
          });

          if (!hasPrefs) {
            console.log('[ProtectedRoute] 🎯 No preferences found, will redirect to first access');
            setShouldRedirectToFirstAccess(true);
          } else {
            console.log('[ProtectedRoute] ✅ User has preferences, allowing normal access');
            setShouldRedirectToFirstAccess(false);
          }

          hasCheckedPrefsRef.current = currentUser.id; // marcar como checado para este usuário
        })
        .catch((error) => {
          console.error('[ProtectedRoute] ❌ Error checking preferences:', error);
        })
        .finally(() => {
          checkingInFlightRef.current = false;
          setCheckingPreferences(false);
        });
    } else {
      console.log('[ProtectedRoute] ⏭️ Skipping preference check - conditions not met');
    }
  // Dependências estáveis para evitar re-execuções desnecessárias
  }, [currentUser?.id, isInitialized, authLoading, location.pathname]);

  console.log('[ProtectedRoute] 🎯 RENDER DECISION - Current state:', {
    authLoading,
    isInitialized,
    checkingPreferences,
    hasCurrentUser: !!currentUser,
    shouldRedirectToFirstAccess,
    pathname: location.pathname
  });

  // Carregando autenticação (não bloquear por checkingPreferences para evitar flicker)
  if (authLoading || !isInitialized) {
    console.log('[ProtectedRoute] ⏳ Showing loading screen');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
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
  if (!checkingPreferences && shouldRedirectToFirstAccess && location.pathname !== '/first-access') {
    console.log('[ProtectedRoute] 🎯 Redirecting to first access due to no preferences');
    return <Navigate to="/first-access" replace />;
  }

  // Logado e com preferências (ou enquanto verifica) - permite acesso
  console.log('[ProtectedRoute] ✅ User authenticated, allowing access');
  return <>{children}</>;
}
