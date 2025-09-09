import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { toast } from 'react-toastify';
import { getAuthRedirectOptions } from '../lib/supabase-redirect';
// Importar APENAS o Context e a Interface do novo hook
import { AuthContext, AuthContextType } from '../hooks/useAuth';

// Manter erro customizado aqui pois é usado na função login
class CustomAuthError extends AuthError {
  constructor(message: string) {
    super('Authentication error');
    this.name = 'AuthError';
    this.message = message;
    this.__isAuthError = true;
  }
}

// Manter constante EMAIL_SERVER_URL aqui pois é usada
const EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3002';

// Remover interface DbUser se não for usada em mais nenhum lugar aqui
/*
interface DbUser { ... }
*/

// Remover interface AuthContextType daqui (movida)
/*
export interface AuthContextType { ... }
*/

// Remover criação do Context daqui (movida)
/*
const AuthContext = createContext<AuthContextType | undefined>(undefined);
*/

// Manter exportação nomeada do Provider
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  console.log('[AuthProvider] 🚀 COMPONENT MOUNTED - AuthProvider initialized');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [favoriteSegments, setFavoriteSegments] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRefreshing = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const isMounted = useRef(true);
  const hasWelcomeEmailBeenSent = useRef(false);
  const migrationAttempted = useRef(false); // Ref para controlar a tentativa de migração

  console.log('[AuthProvider] 📊 Initial state:', {
    currentUser: !!currentUser,
    isInitialized,
    loading
  });

  // Memoizar funções que não dependem de estados internos mutáveis (ou usar useCallback)
  // Exemplo: checkSessionActive geralmente não depende de estado interno.
  const checkSessionActive = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return false;
      return !!data.session;
    } catch (e) {
      return false;
    }
  }, []);

  // Envolver refreshUserData em useCallback
  const refreshUserData = useCallback(async (): Promise<boolean> => {
    isRefreshing.current = true;
    let shouldSetLoadingTrue = false;
    let success = false;

    try {
      const isSessionActive = await checkSessionActive();

      if (!isSessionActive) {
        if (isMounted.current) {
          setCurrentUser(null);
          setPlanId(null);
          setTrialEndsAt(null);
          setFavoriteSegments(null);
          setError(null);
        }
        success = false;
      } else {
        shouldSetLoadingTrue = true;
        if (isMounted.current) {
          setLoading(true);
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          if (isMounted.current) {
            setCurrentUser(null);
            setPlanId(null);
            setTrialEndsAt(null);
            setFavoriteSegments(null);
            setError(authError?.message || 'Falha ao obter usuário.');
          }
          success = false;
        } else {
          const userMetadata = user.user_metadata || {};
          const dbTrialEndsAt = userMetadata.trial_ends_at;
          const dbFavoriteSegments = userMetadata.favorite_segments as string[] | undefined;
          const dbPlanId = userMetadata.plan_id || 'FREE';

          if (isMounted.current) {
            setCurrentUser(user);
            setPlanId(dbPlanId);
            setTrialEndsAt(dbTrialEndsAt);
            setFavoriteSegments(dbFavoriteSegments || null);
            setError(null);
          }
          success = true;
        }
      }
    } catch (error) {
      if (isMounted.current) {
        setCurrentUser(null);
        setPlanId(null);
        setTrialEndsAt(null);
        setFavoriteSegments(null);
        setError('Erro inesperado ao carregar dados.');
      }
      success = false;
    } finally {
      if (shouldSetLoadingTrue && isMounted.current) {
        setLoading(false);
      }
      if (!isInitialized && isMounted.current) {
        setIsInitialized(true);
      }
      isRefreshing.current = false;
    }
    return success;
  }, [checkSessionActive, currentUser]);

  // Função para enviar email de boas-vindas
  const sendWelcomeEmail = useCallback(async (): Promise<boolean> => {
    try {
      // Não enviar se não houver usuário ou já tiver sido enviado
      if (!currentUser || hasWelcomeEmailBeenSent.current) {
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return false;
      }

      const response = await fetch(`${EMAIL_SERVER_URL}/api/email/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        toast.error('Erro ao enviar email de boas-vindas.');
        return false;
      }

      const result = await response.json();
      toast.success('Email de boas-vindas enviado!');
      hasWelcomeEmailBeenSent.current = true;
      return true;

    } catch (error) {
      toast.error('Falha ao processar envio do email de boas-vindas.');
      return false;
    }
  }, [currentUser]);

  // Nova função para atualizar segmentos (MOVIDA PARA CIMA)
  const updateFavoriteSegments = useCallback(async (segments: string[]) => {
    if (!currentUser) {
      toast.error("Você precisa estar logado para salvar preferências.");
      return;
    }
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          favorite_segments: segments
        }
      });

      if (error) {
        toast.error("Não foi possível salvar seus formatos preferidos.");
        throw error;
      }
      if (data.user) {
        // Atualizar estado mesmo se componente não estiver montado
        setCurrentUser(prevUser => prevUser ? { ...prevUser, user_metadata: data.user!.user_metadata } : null);
        setFavoriteSegments(segments);
        toast.success("Formatos preferidos salvos!");
      }
    } catch (error) {
      console.error("Erro em updateFavoriteSegments:", error);
      throw error;
    }
  }, [currentUser]);

  // Nova função para verificar preferências (MOVIDA PARA CIMA)
  const userHasPreferences = useCallback(async (): Promise<boolean> => {
    if (!currentUser) {
      console.log('[AuthContext] ❌ userHasPreferences: No current user');
      return false;
    }
    const metadata = currentUser.user_metadata || {};
    console.log('[AuthContext] 🔍 userHasPreferences - Checking metadata:', metadata);

    // Corrigir verificação - garantir que retorne boolean
    const hasSegments = !!(metadata.favorite_segments && Array.isArray(metadata.favorite_segments) && metadata.favorite_segments.length > 0);
    const hasRadios = !!(metadata.favorite_radios && Array.isArray(metadata.favorite_radios) && metadata.favorite_radios.length > 0);

    console.log('[AuthContext] 📊 userHasPreferences - Results:', {
      hasSegments,
      hasRadios,
      segmentsLength: metadata.favorite_segments?.length || 0,
      radiosLength: metadata.favorite_radios?.length || 0,
      finalResult: hasSegments || hasRadios
    });

    return hasSegments || hasRadios;
  }, [currentUser]);

  // Função para limpar cache quando houver problemas
  const clearAuthCache = useCallback((scope: 'auth' | 'all' = 'auth') => {
    try {
      console.log(`[AuthContext] Clearing ${scope} cache...`);

      if (scope === 'all') {
        // Limpeza completa e agressiva
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) allKeys.push(key);
        }
        allKeys.forEach(key => localStorage.removeItem(key));
        sessionStorage.clear();

        // Limpar cookies relacionados
        document.cookie.split(";").forEach(c => {
          const cookieName = c.split("=")[0].trim();
          if (cookieName.includes('supabase') || cookieName.includes('auth')) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          }
        });
      } else {
        // Limpeza específica de autenticação
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('auth') || key.includes('songmetrix'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Limpar apenas sessionStorage de auth
        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            sessionStorage.removeItem(key);
          }
        });
      }

      console.log(`[AuthContext] ${scope} cache cleared successfully`);
    } catch (error) {
      console.error('[AuthContext] Error clearing cache:', error);
    }
  }, []);

  // Função de emergência para reset completo
  const emergencyReset = useCallback(() => {
    console.log('[AuthContext] Executando reset de emergência...');

    // Limpar tudo
    clearAuthCache();

    // Limpar cache do navegador
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    // Resetar estado
    setCurrentUser(null);
    setPlanId(null);
    setTrialEndsAt(null);
    setFavoriteSegments(null);
    setLoading(false);
    setError(null);
    setIsInitialized(false);

    // Recarregar página
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);

  }, [clearAuthCache]);

  // Função para detectar e resolver conflitos de sessão automaticamente
  const detectAndResolveSessionConflicts = useCallback(async () => {
    try {
      console.log('[AuthContext] Checking for session conflicts...');

      // Verificar se há múltiplas sessões ativas
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.log('[AuthContext] Session error detected, clearing cache:', error.message);
        clearAuthCache('auth');
        return true; // Indica que houve resolução
      }

      if (currentSession) {
        // Verificar se a sessão é válida e não expirada
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = currentSession.expires_at;

        if (expiresAt && expiresAt < now) {
          console.log('[AuthContext] Session expired, clearing cache');
          clearAuthCache('auth');
          return true;
        }

        // Verificar se há dados inconsistentes no localStorage
        // Procurar por chaves relacionadas ao Supabase no localStorage
        const supabaseKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('supabase') && key.includes('auth-token')) {
            supabaseKeys.push(key);
          }
        }

        if (supabaseKeys.length > 0) {
          const storedSessionKey = supabaseKeys[0]; // Pegar a primeira chave encontrada
          const storedSession = localStorage.getItem(storedSessionKey);

          if (storedSession) {
            try {
              const parsedStored = JSON.parse(storedSession);
              if (parsedStored.access_token !== currentSession.access_token) {
                console.log('[AuthContext] Session token mismatch detected, clearing cache');
                clearAuthCache('auth');
                return true;
              }
            } catch (parseError) {
              console.log('[AuthContext] Invalid session data in localStorage, clearing cache');
              clearAuthCache('auth');
              return true;
            }
          }
        }

        // Verificação adicional: verificar se há múltiplas chaves de sessão
        if (supabaseKeys.length > 1) {
          console.log('[AuthContext] Multiple session keys detected, clearing cache to prevent conflicts');
          clearAuthCache('auth');
          return true;
        }

        // Verificar se há dados de sessão antiga no sessionStorage
        const sessionStorageKeys = Object.keys(sessionStorage);
        const oldSessionKeys = sessionStorageKeys.filter(key =>
          key.includes('supabase') || key.includes('auth')
        );

        if (oldSessionKeys.length > 0) {
          console.log('[AuthContext] Old session data found in sessionStorage, clearing...');
          oldSessionKeys.forEach(key => sessionStorage.removeItem(key));
          return true;
        }
      } else {
        // Se não há sessão atual, mas há dados no localStorage, limpar
        const hasSupabaseData = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
          .some(key => key && (key.includes('supabase') || key.includes('auth')));

        if (hasSupabaseData) {
          console.log('[AuthContext] No active session but auth data exists, clearing cache');
          clearAuthCache('auth');
          return true;
        }
      }

      console.log('[AuthContext] No session conflicts detected');
      return false; // Não houve resolução
    } catch (error) {
      console.error('[AuthContext] Error detecting session conflicts:', error);
      // Em caso de erro, fazer limpeza preventiva
      clearAuthCache('auth');
      return true;
    }
  }, [clearAuthCache]);

  // Função específica para limpar cache de reset de senha (mais seletiva)
  const clearPasswordResetCache = useCallback(() => {
    try {
      console.log('[AuthContext] Limpando cache específico de reset de senha...');

      // Limpar apenas dados conflitantes, não todos os dados de auth
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          // Remover apenas tokens antigos e dados de sessão conflitantes
          (key.includes('supabase') && key.includes('auth-token')) ||
          (key.includes('supabase') && key.includes('session')) ||
          // Manter dados importantes como user preferences
          false // Esta condição nunca será true, mas mantém a estrutura
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Limpar apenas sessionStorage de auth, não tudo
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('supabase') && (key.includes('auth') || key.includes('session'))) {
          sessionStorage.removeItem(key);
        }
      });

      // Limpar URL hash se houver tokens de reset
      if (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      console.log('[AuthContext] Cache de reset de senha limpo (seletivamente)');
    } catch (error) {
      console.error('[AuthContext] Erro ao limpar cache de reset:', error);
    }
  }, []);

  // Efeito para inicializar autenticação e configurar listeners
  useEffect(() => {
    // Detectar e resolver conflitos de sessão antes de inicializar
    detectAndResolveSessionConflicts().then((wasResolved) => {
      if (wasResolved) {
        console.log('[AuthContext] Session conflicts resolved, refreshing user data...');
      }
      // Chamar refreshUserData após verificar conflitos
      refreshUserData();
    });

    // Configurar renovação automática de tokens - mais agressiva
    const tokenRefreshInterval = setInterval(async () => {
      if (currentUser && isMounted.current) {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            const expiresAt = session.expires_at;
            const now = Math.floor(Date.now() / 1000);
            const timeToExpiry = expiresAt ? expiresAt - now : 0;

            // Se faltar menos de 15 minutos para expirar, renovar automaticamente
            if (timeToExpiry > 0 && timeToExpiry < 15 * 60) {
              console.log(`Token expirando em ${Math.floor(timeToExpiry / 60)} minutos - renovando automaticamente`);
              const { data: newSession, error } = await supabase.auth.refreshSession();

              if (error) {
                console.error('Erro ao renovar token automaticamente:', error);
                // Se falhar, tentar novamente em 1 minuto
                setTimeout(async () => {
                  console.log('Tentando renovar token novamente...');
                  const { error: retryError } = await supabase.auth.refreshSession();
                  if (retryError) {
                    console.error('Falha na segunda tentativa de renovação:', retryError);
                  }
                }, 60 * 1000);
              } else if (newSession) {
                console.log('Token renovado automaticamente com sucesso');
              }
            }
          } else {
            console.warn('Sessão não encontrada durante verificação de renovação');
          }
        } catch (error) {
          console.error('Erro na verificação de renovação de token:', error);
        }
      }
    }, 2 * 60 * 1000); // Verificar a cada 2 minutos (mais frequente)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] 🔴 Auth state change:', event, !!session);

      if (event === 'INITIAL_SESSION') {
        console.log('[AuthContext] 🔴 Initial session event, session exists:', !!session);
        console.log('[AuthContext] 🔴 State: isInitialized:', isInitialized, 'currentUser:', !!currentUser);

        if (session && !isInitialized && isMounted.current) {
          console.log('[AuthContext] 🔴 Processing initial session - refreshing user data');
          await refreshUserData();
        } else if (!session && !isInitialized && isMounted.current) {
          console.log('[AuthContext] 🔴 No session - setting initialized');
          setIsInitialized(true);
        } else if (session && isInitialized) {
          console.log('[AuthContext] 🔴 Session exists and initialized - user is logged in');

          // ✅ USUÁRIO JÁ LOGADO - IGNORAR REDIRECIONAMENTOS AUTOMÁTICOS
          // 🔥 SE ALGO TENTAR RESETAR ESSE ESTADO, BLOCAR!
          if (!currentUser) {
            console.error('[AuthContext] 🚨 ALERT: Initial Session EXISTS but currentUser null - recovering...');
            // Emergency recovery - refresh user data silently
            await refreshUserData();
          } else {
            console.log('[AuthContext] ✅ User session stable - allowing navigation');
          }
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        console.log('[AuthContext] User signed in, checking for session conflicts...');
        // Verificar conflitos após login (útil para logins após reset de senha)
        detectAndResolveSessionConflicts().then((wasResolved) => {
          if (wasResolved) {
            console.log('[AuthContext] Session conflicts resolved after sign in');
          }
        });
      }

      else if (event === 'SIGNED_OUT') {

        if (isMounted.current) {
          setCurrentUser(null);
          setPlanId(null);
          setTrialEndsAt(null);
          setFavoriteSegments(null);
          setLoading(false);
        }
      }
      else if (event === 'USER_UPDATED') {
        if (session && session.user) {
            const userFromEvent = session.user;
            const userMetadata = userFromEvent.user_metadata || {};
            const dbPlanId = (userMetadata.plan_id || 'FREE').trim().toUpperCase();
            const dbTrialEndsAt = userMetadata.trial_ends_at;
            const dbFavoriteSegments = userMetadata.favorite_segments as string[] | undefined;

            let finalPlanId = dbPlanId;
            if (finalPlanId === 'TRIAL' && dbTrialEndsAt) {
              const now = new Date();
              const trialEnd = new Date(dbTrialEndsAt);
              if (trialEnd < now) {
                finalPlanId = 'FREE';
              }
            }

            if (isMounted.current) {
              setCurrentUser(userFromEvent);
              setPlanId(finalPlanId);
              setTrialEndsAt(dbTrialEndsAt);
              setFavoriteSegments(dbFavoriteSegments || null);
              setError(null);
            } else {
            }
        } else {
            await new Promise(resolve => setTimeout(resolve, 200));
            await refreshUserData();
        }
      }
      else if (event === 'TOKEN_REFRESHED') {
        console.log('Token renovado - atualizando dados do usuário');
        await refreshUserData();
      }
    });

    return () => {
      subscription?.unsubscribe();
      clearInterval(tokenRefreshInterval);
      isMounted.current = false;
    };
  }, [currentUser, detectAndResolveSessionConflicts]);

  // Efeito para tentar migração de rádios para segmentos (EXISTENTE, AGORA APÓS AS FUNÇÕES QUE USA)
  useEffect(() => {
    const attemptMigration = async () => {
      if (!currentUser || !isInitialized || migrationAttempted.current) {
        return;
      }

      const metadata = currentUser.user_metadata || {};
      const needsMigration = !metadata.favorite_segments?.length && metadata.favorite_radios?.length > 0;

      if (needsMigration) {
        migrationAttempted.current = true;
        

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) {
             throw new Error('Token de autenticação não encontrado para a migração.');
          }
          
          const response = await fetch('/api/radios/segments-map', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ radioNames: metadata.favorite_radios })
          });

          if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Erro na API de mapeamento: ${response.statusText} - ${errorBody.message || 'Erro desconhecido'}`);
          }

          const mappedSegments: string[] = await response.json();
          

          if (mappedSegments.length > 0) {
            await updateFavoriteSegments(mappedSegments);
            

            try {
              const { error: cleanupError } = await supabase.auth.updateUser({
                data: { favorite_radios: null }
              });
              if (cleanupError) {
                console.warn('[AuthContext Migration] Falha ao limpar favorite_radios antigos:', cleanupError);
              } else {
                
                setCurrentUser(prevUser => {
                  if (!prevUser) return null;
                  const newMeta = { ...prevUser.user_metadata };
                  delete newMeta.favorite_radios;
                  return { ...prevUser, user_metadata: newMeta };
                });
              }
            } catch(cleanupCatchError) {
               console.warn('[AuthContext Migration] Exceção ao limpar favorite_radios antigos:', cleanupCatchError);
            }
          } else {
 
          }
        } catch (migrationError) {
          console.error('[AuthContext Migration] Falha durante o processo de migração:', migrationError);
          toast.error('Houve um problema ao atualizar suas preferências antigas.');
        }
      } else {
         if (currentUser && isInitialized && !migrationAttempted.current) {
            migrationAttempted.current = true;
         }
      }
    };

    attemptMigration();

  }, [currentUser, isInitialized, updateFavoriteSegments]);

  // Envolver login em useCallback
  const login = useCallback(async (email: string, password: string): Promise<{ error: CustomAuthError | null }> => {
    let loginError: CustomAuthError | null = null;
    let shouldNavigate = false;

    console.log('[AuthContext] 🔐 Starting login process for:', email);
    console.log('[AuthContext] Current pathname:', window.location.pathname);

    // Verificar se pode ser um login após reset de senha
    const urlParams = new URLSearchParams(window.location.search);
    const fromReset = urlParams.get('reset') === 'true' || window.location.pathname === '/update-password';

    if (fromReset) {
      console.log('[AuthContext] Detected login after password reset, but cache already cleared by Login.tsx...');
      // Cache já foi limpo pelo Login.tsx, não limpar novamente para evitar conflitos
    }

    if (isMounted.current) {
      setError(null);
      setLoading(true);
    }

    try {
      console.log('[AuthContext] Calling supabase.auth.signInWithPassword...');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
         console.error('[AuthContext] Sign in error:', signInError);
         loginError = new CustomAuthError(signInError.message || 'Falha no login.');
         if (isMounted.current) setError(loginError.message);
         throw loginError;
      }

      if (!data?.user) {
         console.error('[AuthContext] No user returned after sign in');
         loginError = new CustomAuthError('Usuário não encontrado após login.');
         if (isMounted.current) setError(loginError.message);
         throw loginError;
      }

      console.log('[AuthContext] Sign in successful, calling refreshUserData...');
      const refreshSuccess = await refreshUserData();
      console.log('[AuthContext] refreshUserData result:', refreshSuccess);

      if (refreshSuccess && isMounted.current && !hasWelcomeEmailBeenSent.current) {
         console.log('[AuthContext] Sending welcome email...');
         await sendWelcomeEmail();
      }

      shouldNavigate = true;
      console.log('[AuthContext] Login successful, shouldNavigate = true');

      return { error: null };

    } catch (err: any) {
      console.error('[AuthContext] Login error:', err);
      loginError = err instanceof CustomAuthError ? err : new CustomAuthError(err.message || 'Erro desconhecido no login');
      if (isMounted.current) {
        setError(loginError.message);
        setCurrentUser(null);
        setPlanId(null);
        setTrialEndsAt(null);
        setFavoriteSegments(null);
      }
      return { error: loginError };
    } finally {
       console.log('[AuthContext] Login finally block, setting loading to false');
       if (isMounted.current) {
         setLoading(false);
         console.log('[AuthContext] Loading set to false');
         // Só navega após o loading ser resetado
         if (shouldNavigate && !loginError) {
           console.log('[AuthContext] Login successful - navigation should happen automatically');
           // Removido navegação forçada - deixar que o sistema de rotas do React faça seu trabalho
         }
       }
    }
  }, [refreshUserData, error, currentUser, sendWelcomeEmail, clearAuthCache]);

  // Envolver logout em useCallback
  const logout = useCallback(async () => {
    setLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      toast.error("Erro ao sair. Tente novamente.");
    }
  }, []);

  // Envolver signUp em useCallback
  const signUp = useCallback(async (email: string, password: string, fullName?: string, whatsapp?: string) => {
    setLoading(true);
    setError(null);
    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const signUpOptions = {
        options: {
          emailRedirectTo: getAuthRedirectOptions().emailRedirectTo,
          data: {
            full_name: fullName,
            whatsapp: whatsapp,
            plan_id: 'trial',
            trial_ends_at: trialEndDate.toISOString()
          }
        }
      };

      const { data, error: signUpAuthError } = await supabase.auth.signUp({
        email,
        password,
        ...signUpOptions
      });

      if (signUpAuthError) {
        throw signUpAuthError;
      }

      const userCreated = data.user;
      const confirmationRequired = data.session === null && data.user !== null;

      if (userCreated) {
        console.log(`Usuário ${email} criado no Auth. ID: ${userCreated.id}. Confirmação necessária: ${confirmationRequired}`);
        console.log(`Metadados iniciais (plan_id, trial_ends_at) definidos durante signUp para ${userCreated.id}.`);

        if (confirmationRequired) {
          return {
            error: null,
            confirmation_sent: true,
            should_redirect: true,
            message: 'Cadastro realizado! Verifique seu email para ativar sua conta.'
          };
        } else {
          return {
            error: null,
            confirmation_sent: false,
            should_redirect: false,
            message: 'Conta criada com sucesso!'
          };
        }
      } else {
        console.warn('Supabase signUp retornou sem erro, usuário ou sessão.');
        throw new CustomAuthError('Falha inesperada durante o cadastro.');
      }

    } catch (err: any) {
      console.error('Erro durante o processo de cadastro:', err);
      let errorMessage = 'Ocorreu um erro durante o cadastro.';
      if (err instanceof AuthError || err instanceof CustomAuthError) {
          errorMessage = err.message;
          if (errorMessage.includes('User already registered')) {
              errorMessage = 'Este email já está cadastrado. Tente fazer login.';
          } else if (errorMessage.includes('profile')) {
              errorMessage = err.message;
          }
      }
      setError(errorMessage);
      return {
        error: err,
        message: errorMessage
      };
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Envolver updateFavoriteRadios em useCallback
  const updateFavoriteRadios = useCallback(async (radios: string[]) => {
    if (!currentUser) {
      toast.error("Você precisa estar logado para salvar favoritas.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          favorite_radios: radios
        }
      });

      if (error) {
        toast.error("Não foi possível salvar suas rádios favoritas.");
        throw error;
      }

      if (data.user && isMounted.current) {
          setCurrentUser(prevUser => prevUser ? { ...prevUser, user_metadata: data.user!.user_metadata } : null);
          toast.success("Rádios favoritas salvas!");
      }

    } catch (error) {
    }
  }, [currentUser]);

  // Use useMemo para o valor do contexto para evitar re-renderizações desnecessárias
  const contextValue = useMemo(() => ({
    currentUser,
    planId,
    trialEndsAt,
    favoriteSegments,
    loading,
    error,
    isInitialized,
    login,
    logout,
    refreshUserData,
    signUp,
    updateFavoriteRadios,
    updateFavoriteSegments,
    userHasPreferences,
    sendWelcomeEmail,
    emergencyReset,
    clearPasswordResetCache
  }), [
    currentUser,
    planId,
    trialEndsAt,
    favoriteSegments,
    loading,
    error,
    isInitialized,
    login,
    logout,
    refreshUserData,
    signUp,
    updateFavoriteRadios,
    updateFavoriteSegments,
    userHasPreferences,
    sendWelcomeEmail,
    emergencyReset,
    clearPasswordResetCache
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
