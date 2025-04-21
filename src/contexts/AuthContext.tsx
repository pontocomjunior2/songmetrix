import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { toast } from 'react-toastify';
import { getAuthRedirectOptions } from '../lib/supabase-redirect';
// Importar APENAS o Context e a Interface do novo hook
import { AuthContext, AuthContextType } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const migrationAttempted = useRef(false); // Ref para controlar a tentativa de migração

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
  }, []); // Array de dependência vazio

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
        if (isMounted.current) setLoading(true);
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
          // --- LER DADOS DO METADATA - APENAS OS NECESSÁRIOS AGORA ---
          const userMetadata = user.user_metadata || {};
          console.log('[AuthContext] User metadata (from getUser):', userMetadata);
          // O planId virá da nova API, ler apenas trialEndsAt e segments aqui
          const dbTrialEndsAt = userMetadata.trial_ends_at;
          const dbFavoriteSegments = userMetadata.favorite_segments as string[] | undefined;

          // REMOVER LÓGICA DE CÁLCULO DE planId daqui
          // let currentPlanId = ...
          // if (currentPlanId === 'trial' && trialEnd ...) { ... }

          console.log('[AuthContext] refreshUserData: Setting base user state (currentUser, trialEndsAt, segments).');
          if (isMounted.current) {
            setCurrentUser(user); // Atualiza o usuário
            // NÃO definir planId aqui
            setTrialEndsAt(dbTrialEndsAt); // Definir trialEndsAt do metadata
            setFavoriteSegments(dbFavoriteSegments || null); // Definir estado dos segmentos
            setError(null);
          }
          success = true; // Indica que o usuário básico foi carregado
        }
      }
    } catch (error) {
      console.error("[AuthContext] refreshUserData: Unexpected error.", error);
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
  }, [checkSessionActive]);

  // Função para enviar email de boas-vindas
  const sendWelcomeEmail = useCallback(async (): Promise<boolean> => {
    try {
      // Não enviar se não houver usuário ou já tiver sido enviado
      if (!currentUser || hasWelcomeEmailBeenSent.current) {
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("Tentativa de enviar email de boas-vindas sem sessão ativa.");
        return false;
      }

      console.log('Tentando enviar email de boas-vindas para:', currentUser.email);
      const response = await fetch(`${EMAIL_SERVER_URL}/api/email/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Usar token da sessão atual
        },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Erro ao enviar email de boas-vindas:', response.status, errorBody);
        toast.error('Erro ao enviar email de boas-vindas.');
        return false;
      }

      const result = await response.json();
      console.log('Email de boas-vindas enviado com sucesso:', result);
      toast.success('Email de boas-vindas enviado!');
      hasWelcomeEmailBeenSent.current = true; // Marca como enviado para esta sessão
      return true;

    } catch (error) {
      console.error('Erro na função sendWelcomeEmail:', error);
      toast.error('Falha ao processar envio do email de boas-vindas.');
      return false;
    }
  }, [currentUser]); // Depende de currentUser

  // Nova função para atualizar segmentos (MOVIDA PARA CIMA)
  const updateFavoriteSegments = useCallback(async (segments: string[]) => {
    if (!currentUser) {
      console.error("Tentativa de atualizar segmentos preferidos sem usuário logado.");
      toast.error("Você precisa estar logado para salvar preferências.");
      return;
    }
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { // Atualiza user_metadata
          favorite_segments: segments
          // Opcional: limpar favorite_radios aqui? Talvez melhor na migração.
          // favorite_radios: null
        }
      });
      if (error) {
        toast.error("Não foi possível salvar seus formatos preferidos.");
        throw error;
      }
      if (data.user && isMounted.current) {
        console.log("Metadados de segmentos atualizados no Auth.");
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
    if (!currentUser) return false;
    const metadata = currentUser.user_metadata || {};
    const hasSegments = metadata.favorite_segments && Array.isArray(metadata.favorite_segments) && metadata.favorite_segments.length > 0;
    const hasRadios = metadata.favorite_radios && Array.isArray(metadata.favorite_radios) && metadata.favorite_radios.length > 0;
    console.log(`[userHasPreferences] Has Segments: ${hasSegments}, Has Radios: ${hasRadios}`);
    return hasSegments || hasRadios;
  }, [currentUser]);

  // Efeito para inicializar autenticação e configurar listeners
  useEffect(() => {
    // Chamar refreshUserData incondicionalmente na montagem inicial
    refreshUserData(); 

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        // Lógica para tratar sessão inicial (se houver)
        console.log('[AuthContext] onAuthStateChange: INITIAL_SESSION event.');
        if (session && !isInitialized && isMounted.current) {
          console.log('[AuthContext] Initial session found. Refreshing user data...');
          await refreshUserData(); 
        } else if (!session && !isInitialized && isMounted.current) {
          // Se não há sessão inicial e ainda não inicializou, marca como inicializado
          setIsInitialized(true);
        }
        return; // Importante retornar após tratar INITIAL_SESSION
      }

      if (event === 'SIGNED_IN') {
        // IGNORAR COMPLETAMENTE O EVENTO SIGNED_IN AQUI
        console.log('[AuthContext] onAuthStateChange: SIGNED_IN event received. IGNORING - login function handles refresh.');
      } 
      
      else if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] onAuthStateChange: SIGNED_OUT event received. Clearing state.');
        if (isMounted.current) {
          setCurrentUser(null);
          setPlanId(null);
          setTrialEndsAt(null);
          setFavoriteSegments(null);
          setError(null);
          setLoading(false);
          // Resetar isInitialized pode ser necessário dependendo do fluxo desejado pós-logout
          // setIsInitialized(false); 
        }
      } 

    });

    return () => {
      subscription?.unsubscribe();
      isMounted.current = false;
    };
  }, []); // Array vazio aqui

  // Efeito para tentar migração de rádios para segmentos (EXISTENTE, AGORA APÓS AS FUNÇÕES QUE USA)
  useEffect(() => {
    const attemptMigration = async () => {
      if (!currentUser || !isInitialized || migrationAttempted.current) {
        // Só roda se inicializado, com usuário e se ainda não tentou
        return;
      }

      const metadata = currentUser.user_metadata || {};
      const needsMigration = !metadata.favorite_segments?.length && metadata.favorite_radios?.length > 0;

      if (needsMigration) {
        migrationAttempted.current = true; // Marca que a tentativa foi feita
        console.log(`[AuthContext Migration] Usuário ${currentUser.id} precisa de migração. Rádios antigas:`, metadata.favorite_radios);

        try {
          // 1. Chamar a API para buscar os segmentos
          const response = await fetch('/api/radios/segments-map', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Adicionar token de autorização se a API exigir (authenticateBasicUser faz isso no backend?
              // Assumindo que o middleware de autenticação cuida disso no backend
              // 'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ radioNames: metadata.favorite_radios })
          });

          if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Erro na API de mapeamento: ${response.statusText} - ${errorBody.message || 'Erro desconhecido'}`);
          }

          const mappedSegments: string[] = await response.json();
          console.log('[AuthContext Migration] Segmentos mapeados:', mappedSegments);

          if (mappedSegments.length > 0) {
            // 2. Atualizar os metadados com os novos segmentos
            await updateFavoriteSegments(mappedSegments);
            console.log('[AuthContext Migration] Segmentos salvos com sucesso.');

            // 3. Opcional: Limpar favorite_radios antigos
            try {
              const { error: cleanupError } = await supabase.auth.updateUser({
                data: { favorite_radios: null }
              });
              if (cleanupError) {
                console.warn('[AuthContext Migration] Falha ao limpar favorite_radios antigos:', cleanupError);
              } else {
                console.log('[AuthContext Migration] favorite_radios antigos removidos.');
                // Atualiza currentUser localmente para refletir a remoção
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
            console.log('[AuthContext Migration] Nenhum segmento encontrado para as rádios antigas. Nenhuma atualização necessária.');
          }
        } catch (migrationError) {
          console.error('[AuthContext Migration] Falha durante o processo de migração:', migrationError);
          toast.error('Houve um problema ao atualizar suas preferências antigas.');
          // Não re-tenta automaticamente para evitar loops
        }
      } else {
         // Se não precisa de migração, marca como tentado para não verificar de novo
         if (currentUser && isInitialized && !migrationAttempted.current) {
            migrationAttempted.current = true;
         }
      }
    };

    attemptMigration();

  }, [currentUser, isInitialized, updateFavoriteSegments]); // Correto

  // Envolver login em useCallback
  const login = useCallback(async (email: string, password: string): Promise<{ error: CustomAuthError | null }> => {
    let loginError: CustomAuthError | null = null;
    if (isMounted.current) {
      setError(null);
      setLoading(true); // <-- Iniciar loading aqui
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
         loginError = new CustomAuthError(signInError.message || 'Falha no login.');
         if (isMounted.current) setError(loginError.message);
         throw loginError; // Jogar o erro para o catch tratar o loading/error state
      }

      if (!data?.user) {
         loginError = new CustomAuthError('Usuário não encontrado após login.');
         if (isMounted.current) setError(loginError.message);
         throw loginError;
      }

      // *** LOGIN BEM SUCEDIDO NO SUPABASE AUTH ***
      console.log('[AuthContext] Login successful in Supabase Auth.');

      // 1. Tentar carregar dados básicos do usuário (sem definir planId ainda)
      const refreshSuccess = await refreshUserData();
      if (!refreshSuccess) {
          loginError = new CustomAuthError(error || 'Falha ao carregar dados básicos do usuário após login.');
          if (isMounted.current) setError(loginError.message);
          throw loginError;
      }

      // 2. Buscar o planId ATUALIZADO do backend
      console.log('[AuthContext] Fetching current planId from backend...');
      try {
          const { data: { session } } = await supabase.auth.getSession(); // Pegar token atual
          if (!session?.access_token) throw new Error('Token não encontrado para buscar plano.');

          const response = await fetch('/api/users/my-plan', { // Usar a nova rota
              headers: {
                  'Authorization': `Bearer ${session.access_token}`
              }
          });
          if (!response.ok) {
              const errorBody = await response.text();
              throw new Error(`Falha ao buscar plano: ${response.status} ${errorBody}`);
          }
          const { planId: backendPlanId } = await response.json();
          console.log(`[AuthContext] Received planId from backend: ${backendPlanId}`);

          // 3. Definir o planId no estado
          if (isMounted.current) {
              setPlanId(backendPlanId);
              console.log(`[AuthContext] Final planId set to: ${backendPlanId}`);
          }

      } catch (planFetchError: any) {
          console.error('[AuthContext] Error fetching planId from backend:', planFetchError);
          // Decidir como tratar: Usar um fallback? Mostrar erro? Por enquanto, loga e continua.
          // Poderia tentar ler dos metadados como fallback, mas pode estar desatualizado.
          if (isMounted.current) {
              // Definir um estado de erro ou um planId padrão/fallback?
              // setError('Falha ao verificar o plano de assinatura.');
              // setPlanId(currentUser?.user_metadata?.plan_id || 'trial'); // Fallback para metadados (pode estar errado)
              setError(null); // Optando por não mostrar erro de plano, pode impactar a UI
              setPlanId(currentUser?.user_metadata?.plan_id || 'trial'); // Fallback
              console.warn('[AuthContext] Using fallback planId from possibly outdated metadata.');
          }
      }

      // Navegar apenas após tudo (incluindo busca do plano)
      console.log('[AuthContext] Login process complete. Navigating to dashboard...');
      navigate('/dashboard');
      return { error: null }; // Sucesso total

    } catch (err: any) {
      loginError = err instanceof CustomAuthError ? err : new CustomAuthError(err.message || 'Erro desconhecido no login');
      if (isMounted.current) {
        setError(loginError.message);
        // Certificar que currentUser e planId são resetados em caso de erro no login
        setCurrentUser(null);
        setPlanId(null);
        setTrialEndsAt(null);
        setFavoriteSegments(null);
      }
      return { error: loginError };
    } finally {
       if (isMounted.current) {
         setLoading(false); // <-- Terminar loading no finally
       }
    }
  }, [refreshUserData, error, navigate, currentUser]); // Adicionar currentUser como dependência devido ao fallback

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
      // Definir data de fim do trial
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // Opções para o signUp, incluindo metadata e URL de redirecionamento
      const signUpOptions = {
        options: {
          emailRedirectTo: getAuthRedirectOptions().emailRedirectTo, // Usa a função centralizada
          data: { // user_metadata inicial
            full_name: fullName,
            whatsapp: whatsapp,
            plan_id: 'trial', // <-- INCLUIR AQUI
            trial_ends_at: trialEndDate.toISOString() // <-- INCLUIR AQUI
          }
        }
      };

      // Tenta criar o usuário no Supabase Auth
      const { data, error: signUpAuthError } = await supabase.auth.signUp({
        email,
        password,
        ...signUpOptions
      });

      if (signUpAuthError) {
        throw signUpAuthError; // Joga o erro para o catch tratar
      }

      // Verifica se o usuário foi criado e se a confirmação é necessária
      const userCreated = data.user;
      const confirmationRequired = data.session === null && data.user !== null; // Indica que email de confirmação foi enviado

      if (userCreated) {
        console.log(`Usuário ${email} criado no Auth. ID: ${userCreated.id}. Confirmação necessária: ${confirmationRequired}`);

        // REMOVER Bloco de inserção na tabela 'users' 
        /*
        try {
            // ... (código .from('users').insert(...) removido) ...
        } catch (profileInsertError: any) {
           console.error("Erro capturado durante a inserção do perfil:", profileInsertError);
           throw profileInsertError;
        }
        */
        console.log(`Metadados iniciais (plan_id, trial_ends_at) definidos durante signUp para ${userCreated.id}.`);

        // Preparar resposta de sucesso
        if (confirmationRequired) {
          return {
            error: null,
            confirmation_sent: true,
            should_redirect: true, // Pode redirecionar para uma página de "Verifique seu email"
            message: 'Cadastro realizado! Verifique seu email para ativar sua conta.'
          };
        } else {
          // Se a confirmação não for necessária (auto-confirm ativado no Supabase)
          // O listener 'SIGNED_IN' será disparado, fará o refreshUserData e redirecionará.
          return {
            error: null,
            confirmation_sent: false,
            should_redirect: false, // O listener cuidará do redirect
            message: 'Conta criada com sucesso!'
          };
        }
      } else {
        // Caso inesperado: signUp não retornou erro, mas não criou usuário nem sessão.
        console.warn('Supabase signUp retornou sem erro, usuário ou sessão.');
        throw new CustomAuthError('Falha inesperada durante o cadastro.');
      }

    } catch (err: any) {
      console.error('Erro durante o processo de cadastro:', err);
      let errorMessage = 'Ocorreu um erro durante o cadastro.';
      if (err instanceof AuthError || err instanceof CustomAuthError) {
          errorMessage = err.message;
          // Tratar erros específicos, ex: usuário já existe
          if (errorMessage.includes('User already registered')) {
              errorMessage = 'Este email já está cadastrado. Tente fazer login.';
          } else if (errorMessage.includes('profile')) {
              // Mensagem do erro de criação de perfil
              errorMessage = err.message;
          }
      }
      setError(errorMessage);
      return {
        error: err, // Retorna o objeto de erro original
        message: errorMessage // Retorna a mensagem tratada
      };
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []); // Remover dependências como getAuthRedirectOptions se ela for pura

  // Envolver updateFavoriteRadios em useCallback
  const updateFavoriteRadios = useCallback(async (radios: string[]) => {
    if (!currentUser) {
      console.error("Tentativa de atualizar favoritas sem usuário logado.");
      toast.error("Você precisa estar logado para salvar favoritas.");
      return;
    }

    try {
      // Atualizar APENAS os metadados no Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        data: { // Atualiza user_metadata
          favorite_radios: radios
        }
      });

      if (error) {
        toast.error("Não foi possível salvar suas rádios favoritas.");
        throw error;
      }

      // Atualiza o currentUser localmente se a atualização no Auth foi bem sucedida
      if (data.user && isMounted.current) {
          console.log("Metadados de favoritas atualizados no Auth.");
          // É importante atualizar o objeto currentUser local para refletir a mudança
          // sem precisar de um refresh completo da sessão/dados.
          setCurrentUser(prevUser => prevUser ? { ...prevUser, user_metadata: data.user!.user_metadata } : null);
          toast.success("Rádios favoritas salvas!");
      }

    } catch (error) {
      // Erro já logado e notificado
    }
  }, [currentUser]); // Depende de currentUser

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
    sendWelcomeEmail
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
    sendWelcomeEmail
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
