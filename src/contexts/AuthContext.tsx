import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { toast } from 'react-toastify';
import { getAuthRedirectOptions } from '../lib/supabase-redirect';

// Custom error type that includes both Auth and Postgrest errors
class CustomAuthError extends AuthError {
  constructor(message: string) {
    super('Authentication error');
    this.name = 'AuthError';
    this.message = message;
    this.__isAuthError = true;
  }
}

interface DbUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  favorite_radios?: string[];
  plan_id: string | null;
  trial_ends_at: string | null;
  full_name?: string;
  whatsapp?: string;
}

export interface AuthContextType {
  currentUser: User | null;
  planId: string | null;
  trialEndsAt: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ error: CustomAuthError | null }>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<boolean>;
  signUp: (email: string, password: string, fullName?: string, whatsapp?: string) => Promise<{
    error: any,
    confirmation_sent?: boolean,
    should_redirect?: boolean,
    message?: string
  }>;
  updateFavoriteRadios: (radios: string[]) => Promise<void>;
  sendWelcomeEmail: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constante para a URL do servidor de email
const EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3002';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isRefreshing = useRef(false);
  const isInitialized = useRef(false);
  const isMounted = useRef(true);
  const hasWelcomeEmailBeenSent = useRef(false);

  // Função para verificar se há uma sessão ativa rapidamente
  const checkSessionActive = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return false;
      return !!data.session;
    } catch (e) {
      return false;
    }
  };

  // Função para buscar dados do usuário (plano, trial, etc.) e verificar expiração
  const refreshUserData = async (): Promise<boolean> => {
    if (isRefreshing.current) return false;
    isRefreshing.current = true;
    setLoading(true);

    try {
      // Verificar se há uma sessão ativa
      const isSessionActive = await checkSessionActive();
      if (!isSessionActive) {
        if (isMounted.current) {
          setCurrentUser(null);
          setPlanId(null);
          setTrialEndsAt(null);
          setLoading(false);
        }
        isRefreshing.current = false;
        return false;
      }

      // Obter usuário da sessão ativa
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
         if (isMounted.current) {
           setCurrentUser(null);
           setPlanId(null);
           setTrialEndsAt(null);
           setLoading(false);
         }
        isRefreshing.current = false;
        return false;
      }

      // Obter dados do perfil/usuário do banco
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('plan_id, trial_ends_at')
        .eq('id', user.id)
        .single();

      if (dbError) {
        console.error('Erro ao buscar dados do perfil do usuário:', dbError);
        if (dbError.code === 'PGRST116') {
           console.warn(`Perfil não encontrado para usuário ${user.id}. Pode ser um cadastro recente ou falha.`);
           await supabase.auth.signOut();
           if (isMounted.current) {
             setCurrentUser(null);
             setPlanId(null);
             setTrialEndsAt(null);
             setLoading(false);
           }
           isRefreshing.current = false;
           return false;
        }
         if (isMounted.current) setLoading(false);
         isRefreshing.current = false;
         return false;
      }

      if (!dbUser) {
         console.error('Dados do perfil do usuário não encontrados (inesperado).');
         await supabase.auth.signOut();
         if (isMounted.current) {
           setCurrentUser(null);
           setPlanId(null);
           setTrialEndsAt(null);
           setLoading(false);
         }
         isRefreshing.current = false;
         return false;
      }

      // Verificar expiração do trial
      const now = new Date();
      const trialEnd = dbUser.trial_ends_at ? new Date(dbUser.trial_ends_at) : null;
      let currentPlanId = dbUser.plan_id;

      // Se o plano atual é 'trial' e a data de expiração existe e já passou
      if (currentPlanId === 'trial' && trialEnd && trialEnd < now) {
        console.log(`Trial expirado para o usuário: ${user.id}. Data fim: ${trialEnd.toISOString()}`);
        currentPlanId = 'expired_trial'; // Atualiza localmente para uso imediato

        // Tenta atualizar no banco de dados em background
        supabase
          .from('users')
          .update({ plan_id: 'expired_trial' })
          .eq('id', user.id)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.error(`Falha ao atualizar plan_id para expired_trial no DB para usuário ${user.id}:`, updateError);
              // O que fazer se a atualização falhar? O usuário ficará como 'trial' no DB.
              // Poderia tentar novamente depois ou notificar o admin.
            } else {
              console.log(`Plan_id atualizado para expired_trial no DB para usuário ${user.id}`);
              // Atualiza o estado local com o valor do DB confirmado, se a lógica depender disso
              // (Neste caso, currentPlanId já foi setado localmente antes)
            }
          });
      }

      // Atualiza o estado do contexto se o componente ainda estiver montado
      if (isMounted.current) {
        setCurrentUser(user);
        setPlanId(currentPlanId);
        setTrialEndsAt(dbUser.trial_ends_at);
        setLoading(false);
      }

      isRefreshing.current = false;
      return true;

    } catch (error) {
      console.error("Erro inesperado em refreshUserData:", error);
      if (isMounted.current) {
         setCurrentUser(null);
         setPlanId(null);
         setTrialEndsAt(null);
         setLoading(false);
       }
      isRefreshing.current = false;
      return false;
    }
  };

  // Função para enviar email de boas-vindas
  const sendWelcomeEmail = async (): Promise<boolean> => {
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
  };

  // Efeito para inicializar autenticação e configurar listeners
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    refreshUserData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (currentUser || !loading) {
            return;
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        if (!currentUser && isMounted.current) {
           const success = await refreshUserData();
           if (!success) {
              console.error("Falha ao carregar dados do usuário após SIGNED_IN (no currentUser case).");
           }
        } else if (currentUser && isMounted.current) {
           if (session?.user && currentUser.id !== session.user.id) {
               setCurrentUser(session.user);
           }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted.current) {
          setCurrentUser(null);
          setPlanId(null);
          setTrialEndsAt(null);
          setError(null);
          setLoading(false);
        }
      } else if (event === 'TOKEN_REFRESHED') {
         if (session?.user && isMounted.current) {
           if (currentUser?.id !== session.user.id || currentUser?.aud !== session.user.aud) {
             setCurrentUser(session.user);
           }
         } else if (!session && isMounted.current) {
           setCurrentUser(null);
           setPlanId(null);
           setTrialEndsAt(null);
           setLoading(false); 
         }
      } else if (event === 'USER_UPDATED') {
        if (session?.user && isMounted.current) {
          setCurrentUser(session.user);
        }
      } else if (event === 'PASSWORD_RECOVERY') {
         if (session && isMounted.current) {
           refreshUserData();
         }
      }
    });

    return () => {
      subscription?.unsubscribe();
      isInitialized.current = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ error: CustomAuthError | null }> => {
    try {
      if (isMounted.current) {
        setError(null);
        setLoading(true);
      }

      // Tentar fazer login
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
         console.error('Erro no Login:', signInError);
         if (isMounted.current) setError(signInError.message || 'Falha no login.');
         throw signInError; // Re-throw para o chamador saber que falhou
      }

      if (!data?.user) {
         if (isMounted.current) setError('Usuário não encontrado ou falha inesperada.');
         throw new CustomAuthError('Usuário não encontrado');
      }

      // A lógica de refreshUserData será chamada pelo listener 'SIGNED_IN'
      // Não precisamos chamar aqui explicitamente para evitar chamadas duplicadas.
      // Apenas garantimos que setLoading(false) será chamado pelo refreshUserData.

      // Retorna sucesso (sem erro)
      return { error: null };

    } catch (err: any) {
      // O erro já foi setado ou logado acima
      if (isMounted.current) {
        setLoading(false); // Garante que loading termina em caso de erro
      }
      // Retorna o erro para o formulário de login poder tratar
      return { error: err instanceof AuthError || err instanceof CustomAuthError ? err : new CustomAuthError(err.message || 'Erro desconhecido no login') };
    }
  };

  // Logout
  const logout = async () => {
    setLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Erro ao fazer logout:", signOutError);
      toast.error("Erro ao sair. Tente novamente.");
      // Mesmo com erro, limpamos o estado local
    }
  };

  // Cadastro
  const signUp = async (email: string, password: string, fullName?: string, whatsapp?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Opções para o signUp, incluindo metadata e URL de redirecionamento
      const signUpOptions = {
        options: {
          emailRedirectTo: getAuthRedirectOptions().emailRedirectTo, // Usa a função centralizada
          data: { // user_metadata inicial
            full_name: fullName,
            whatsapp: whatsapp,
            // NÃO definir plan_id ou trial_ends_at aqui, será feito na tabela 'users'
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
        console.error("Erro no Supabase Auth signUp:", signUpAuthError);
        throw signUpAuthError; // Joga o erro para o catch tratar
      }

      // Verifica se o usuário foi criado e se a confirmação é necessária
      const userCreated = data.user;
      const confirmationRequired = data.session === null && data.user !== null; // Indica que email de confirmação foi enviado

      if (userCreated) {
        console.log(`Usuário ${email} criado no Auth. ID: ${userCreated.id}. Confirmação necessária: ${confirmationRequired}`);

        // INSERIR/ATUALIZAR PERFIL NA TABELA 'users'
        // Idealmente, isso seria um TRIGGER no Supabase (`handle_new_user`).
        // Se não for trigger, fazemos aqui (menos robusto).
        try {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 14);

            const { error: profileError } = await supabase
              .from('users') // Confirme o nome da tabela
              .insert({
                id: userCreated.id,
                email: userCreated.email,
                plan_id: 'trial', // Plano inicial
                trial_ends_at: trialEndDate.toISOString(), // Data de fim do trial
                full_name: fullName, // Adiciona nome
                whatsapp: whatsapp, // Adiciona whatsapp
                // status: 'ATIVO' // Se ainda usar status, defina um inicial
              });

            if (profileError) {
               // Log detalhado do erro de perfil
               console.error(`Erro ao criar perfil para ${userCreated.id} na tabela 'users':`, profileError);

               // O que fazer aqui? O usuário existe no Auth mas não no Profiles.
               // Opção 1: Tentar deletar o usuário do Auth (requer privilégios admin ou chamar API backend)
               // Opção 2: Logar o erro e retornar falha, deixando o usuário 'órfão'.
               // Opção 3: Retornar um erro específico para o usuário tentar novamente?

               // Vamos retornar um erro específico por enquanto.
               throw new CustomAuthError(`Falha ao inicializar o perfil do usuário. Código: ${profileError.code}`);
            } else {
               console.log(`Perfil criado com sucesso para ${userCreated.id} na tabela 'users'.`);
               // Remover sincronização com Brevo após criar perfil
               /*
               syncUserWithBrevo({ id: userCreated.id, email, name: fullName, whatsapp });
               */
            }
        } catch (profileInsertError: any) {
           // Captura erro do bloco try/catch da inserção do perfil
           console.error("Erro capturado durante a inserção do perfil:", profileInsertError);
           // Re-throw para ser pego pelo catch externo do signUp
           throw profileInsertError;
        }

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
  };

  // Função para atualizar rádios favoritas no metadata do usuário
  const updateFavoriteRadios = async (radios: string[]) => {
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
        console.error("Erro ao atualizar rádios favoritas no Auth:", error);
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
  };

  // Montar o valor do contexto
  const value: AuthContextType = {
    currentUser,
    planId,
    trialEndsAt,
    loading,
    error,
    login,
    logout,
    refreshUserData,
    signUp,
    updateFavoriteRadios,
    sendWelcomeEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto de autenticação
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
