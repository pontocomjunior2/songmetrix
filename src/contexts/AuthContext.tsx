import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { useNavigate } from 'react-router-dom';

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
  status: UserStatusType;
  created_at: string;
  updated_at: string;
  favorite_radios?: string[];
}

// Definir os tipos para o contexto
export type UserStatusType = 'ADMIN' | 'ATIVO' | 'INATIVO' | 'TRIAL';

export interface AuthContextType {
  currentUser: User | null;
  userStatus: UserStatusType | null;
  loading: boolean;
  error: string | null;
  trialDaysRemaining: number | null;
  login: (email: string, password: string) => Promise<{ error: CustomAuthError | null }>;
  logout: () => Promise<void>;
  updateUserStatus: (userId: string, newStatus: UserStatusType) => Promise<void>;
  refreshUserStatus: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ 
    error: any, 
    confirmation_sent?: boolean,
    should_redirect?: boolean,
    message?: string
  }>;
  updateFavoriteRadios: (radios: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const isRefreshing = useRef(false);
  const isInitialized = useRef(false);
  const isMounted = useRef(true);
  const navigate = useNavigate();

  // Desmontar o componente
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  // Função para atualizar status de um usuário (admin)
  const updateUserStatus = async (userId: string, newStatus: UserStatusType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const isAdmin = userStatus === 'ADMIN';
      if (!isAdmin) {
        throw new Error('Usuário não tem permissão de administrador');
      }

      // Atualizar status no banco de dados
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (dbError) {
        throw dbError;
      }

      // Atualizar metadados via API
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/users/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar metadados do usuário');
      }
    } catch (error) {
      throw error;
    }
  };

  // Função para atualizar explicitamente o status do usuário
  const refreshUserStatus = async (): Promise<boolean> => {
    if (isRefreshing.current) return false;
    
    isRefreshing.current = true;
    
    try {
      // Verificar se há uma sessão ativa
      const isSessionActive = await checkSessionActive();
      if (!isSessionActive) {
        isRefreshing.current = false;
        return false;
      }
      
      // Obter usuário da sessão ativa
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        isRefreshing.current = false;
        return false;
      }
      
      // Obter status do banco
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('status, created_at')
        .eq('id', user.id)
        .single();
        
      if (dbError || !dbUser) {
        isRefreshing.current = false;
        return false;
      }
      
      // Verificar status permitidos
      if (dbUser.status === 'ADMIN' || dbUser.status === 'ATIVO' || dbUser.status === 'TRIAL') {
        if (isMounted.current) {
          setCurrentUser(user);
          setUserStatus(dbUser.status as UserStatusType);
        }
        
        // Calcular dias restantes se for TRIAL
        if (dbUser.status === 'TRIAL') {
          const createdAt = new Date(dbUser.created_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - createdAt.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.max(0, 7 - diffDays);
          
          if (isMounted.current) {
            setTrialDaysRemaining(daysRemaining);
          }
          
          if (daysRemaining <= 0) {
            // Atualizar status no banco
            await supabase
              .from('users')
              .update({ status: 'INATIVO' })
              .eq('id', user.id);
              
            navigate('/plans', { 
              state: { 
                trialExpired: true,
                message: 'Seu período de avaliação gratuito expirou. Escolha um plano para continuar utilizando o sistema.'
              },
              replace: true
            });
            isRefreshing.current = false;
            return false;
          }
        } else if (isMounted.current) {
          setTrialDaysRemaining(null);
        }
        
        if (isMounted.current) {
          setLoading(false);
        }
        isRefreshing.current = false;
        return true;
      } else if (dbUser.status === 'INATIVO') {
        // Usuário inativo - não fazer logout, apenas redirecionar
        navigate('/pending-approval', {
          state: {
            message: 'Sua conta está aguardando aprovação. Por favor, aguarde o contato do nosso atendimento.'
          },
          replace: true
        });
        isRefreshing.current = false;
        return false;
      } else {
        // Status não permitido
        await supabase.auth.signOut();
        navigate('/login', {
          state: {
            error: 'Usuário inativo. Entre em contato com o administrador.'
          },
          replace: true
        });
        isRefreshing.current = false;
        return false;
      }
    } catch (error) {
      isRefreshing.current = false;
      return false;
    }
  };

  // Verificar sessão inicial e configurar listener para mudanças de autenticação
  useEffect(() => {
    // Evitar inicialização repetida
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const initializeAuth = async () => {
      if (!isMounted.current) return;
      
      try {
        // Verificar se há uma sessão rápida no storage
        const storageKey = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
        const hasStoredSession = !!sessionStorage.getItem(storageKey);
        
        if (!hasStoredSession) {
          // Não há sessão armazenada, finalizar carga rapidamente
          if (isMounted.current) {
            setCurrentUser(null);
            setUserStatus(null);
            setLoading(false);
          }
          return;
        }
        
        // Verificar sessão no Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (isMounted.current) {
            setCurrentUser(null);
            setUserStatus(null);
            setLoading(false);
          }
          return;
        }
        
        // Obter dados do usuário
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (isMounted.current) {
            setCurrentUser(null);
            setUserStatus(null);
            setLoading(false);
          }
          return;
        }
        
        // Obter status do usuário do banco de dados
        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('status, created_at')
          .eq('id', user.id)
          .single();
          
        if (dbError || !dbUser) {
          if (isMounted.current) {
            setCurrentUser(null);
            setUserStatus(null);
            setLoading(false);
          }
          return;
        }
        
        // Verificar status permitidos
        if (dbUser.status === 'ADMIN' || dbUser.status === 'ATIVO' || dbUser.status === 'TRIAL') {
          if (isMounted.current) {
            setCurrentUser(user);
            setUserStatus(dbUser.status as UserStatusType);
            
            // Calcular dias restantes para TRIAL
            if (dbUser.status === 'TRIAL') {
              const createdAt = new Date(dbUser.created_at);
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - createdAt.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const daysRemaining = Math.max(0, 7 - diffDays);
              
              if (isMounted.current) setTrialDaysRemaining(daysRemaining);
              
              if (daysRemaining <= 0) {
                // Atualizar status no banco
                await supabase
                  .from('users')
                  .update({ status: 'INATIVO' })
                  .eq('id', user.id);
                
                if (isMounted.current) {
                  setCurrentUser(null);
                  setUserStatus(null);
                  setLoading(false);
                }
                
                navigate('/plans', { 
                  state: { 
                    trialExpired: true,
                    message: 'Seu período de avaliação gratuito expirou. Escolha um plano para continuar.'
                  },
                  replace: true
                });
                return;
              }
            } else {
              if (isMounted.current) setTrialDaysRemaining(null);
            }
            
            setLoading(false);
          }
        } else {
          // Status não permitido
          await supabase.auth.signOut();
          
          if (isMounted.current) {
            setCurrentUser(null);
            setUserStatus(null);
            setLoading(false);
          }
          
          navigate('/login', {
            state: {
              error: 'Usuário inativo. Entre em contato com o administrador.'
            },
            replace: true
          });
        }
      } catch (error) {
        if (isMounted.current) {
          setCurrentUser(null);
          setUserStatus(null);
          setLoading(false);
        }
      }
    };
    
    // Inicializar autenticação
    initializeAuth();
    
    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Logar todos os eventos para diagnóstico
      console.log('Evento de autenticação:', event, session ? 'com sessão' : 'sem sessão');
      
      // Verificar especificamente eventos de confirmação de email
      if (event === 'USER_UPDATED' && session?.user) {
        console.log('Usuário atualizado:', {
          id: session.user.id,
          email: session.user.email,
          email_confirmado: session.user.email_confirmed_at ? 'Sim' : 'Não',
          created_at: session.user.created_at,
          metadados: session.user.user_metadata
        });
      }
      
      // Ignorar eventos específicos para evitar loops
      if (event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        return;
      }
      
      if (event === 'SIGNED_OUT' || !session) {
        if (isMounted.current) {
          setCurrentUser(null);
          setUserStatus(null);
          setTrialDaysRemaining(null);
        }
        return;
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!currentUser && isMounted.current) {
          // Atualizar dados apenas se não tivermos usuário ainda
          refreshUserStatus();
        }
      }
    });
    
    // Limpar listener ao desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const login = async (email: string, password: string): Promise<{ error: CustomAuthError | null }> => {
    try {
      if (isMounted.current) {
        setError(null);
        setLoading(true);
      }

      // Tentar fazer login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data?.user) {
        throw new CustomAuthError('Usuário não encontrado');
      }

      // Obter dados atualizados
      const { data: refreshedData, error: refreshError } = await supabase.auth.getUser();
      
      if (refreshError) throw refreshError;
      
      const user = refreshedData?.user || data.user;

      // Verificar status do usuário
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('status, created_at')
        .eq('id', user.id)
        .single();
        
      if (dbError) {
        console.error('Erro ao buscar usuário no banco:', dbError);
        
        // Se o usuário não existir no banco mas existir na auth, criar registro
        if (dbError.code === 'PGRST116') { // No rows returned
          console.log('Criando registro de usuário que não existe no banco:', user.id);
          
          // Determinar se é um usuário novo (< 7 dias)
          const createdAt = new Date(user.created_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - createdAt.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isNewUser = diffDays <= 7;
          
          // Inserir novo registro com status TRIAL para usuários novos
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              status: isNewUser ? 'TRIAL' : 'INATIVO', // TRIAL para novos usuários
              created_at: user.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error('Erro ao criar registro de usuário:', insertError);
            throw insertError;
          }
          
          // Buscar o registro recém-criado
          const { data: newDbUser, error: newDbError } = await supabase
            .from('users')
            .select('status, created_at')
            .eq('id', user.id)
            .single();
            
          if (newDbError) {
            console.error('Erro ao buscar usuário recém-criado:', newDbError);
            throw newDbError;
          }
          
          if (!newDbUser) {
            throw new CustomAuthError('Erro ao criar registro de usuário');
          }
          
          // Atualizar metadados para corresponder ao banco
          await supabase.auth.updateUser({
            data: { status: newDbUser.status }
          });
          
          // Usar o registro recém-criado
          if (isMounted.current) {
            setCurrentUser(user);
            setUserStatus(newDbUser.status as UserStatusType);
            setLoading(false);
          }
          
          navigate('/dashboard', { replace: true });
          return { error: null };
        } else {
          throw dbError;
        }
      }
      
      if (!dbUser) {
        throw new CustomAuthError('Usuário não encontrado no banco de dados');
      }
      
      const userStatus = dbUser.status;

      // Calcular dias restantes do trial
      let trialDaysRemaining = null;
      if (userStatus === 'TRIAL') {
        const createdAt = new Date(dbUser.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, 7 - diffDays);
        
        if (trialDaysRemaining <= 0) {
          await supabase.auth.signOut();
          throw new CustomAuthError('Seu período de avaliação gratuito expirou.');
        }
      }

      // Verificar status permitido
      if (userStatus !== 'ADMIN' && userStatus !== 'ATIVO' && userStatus !== 'TRIAL') {
        await supabase.auth.signOut();
        throw new CustomAuthError('Usuário inativo. Entre em contato com o administrador.');
      }

      // Atualizar estado
      if (isMounted.current) {
        setCurrentUser(user);
        setUserStatus(userStatus as UserStatusType);
        setTrialDaysRemaining(trialDaysRemaining);
        setLoading(false);
      }

      // Redirecionar para dashboard
      navigate('/dashboard', { replace: true });
            
      return { error: null };
    } catch (error) {
      await supabase.auth.signOut();
      
      if (isMounted.current) {
        setLoading(false);
      }
      
      if (error instanceof AuthError) {
        if (error.message.includes('Invalid login')) {
          return { error: new CustomAuthError('Email ou senha inválidos') };
        } else if (error.message.includes('Email not confirmed')) {
          return { error: new CustomAuthError('Email não confirmado') };
        } else if (error.message.includes('trial_expired') || error.message.includes('período de avaliação')) {
          return { error: new CustomAuthError('Seu período de avaliação gratuito expirou. Escolha um plano para continuar utilizando o sistema.') };
        }
        return { error: new CustomAuthError(error.message) };
      }
      
      return { error: new CustomAuthError('Erro ao fazer login') };
    }
  };

  // Função para deslogar o usuário
  const signOut = async () => {
    if (isMounted.current) {
      setLoading(true);
    }
    
    try {
      await supabase.auth.signOut();
      
      if (isMounted.current) {
        setCurrentUser(null);
        setUserStatus(null);
        setTrialDaysRemaining(null);
      }
      
      navigate('/login', { replace: true });
    } catch (error) {
      // Ignorar erros no logout
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Verificar se o email já existe
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);
        
      if (checkError) {
        console.error('Erro ao verificar email existente:', checkError);
      } else if (existingUsers && existingUsers.length > 0) {
        return { error: new CustomAuthError('Este email já está registrado. Por favor, faça login ou use outro email.') };
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { status: 'TRIAL' }
        }
      });
      
      if (error) {
        console.error('Erro no signUp do Supabase:', error);
        throw error;
      }
      
      // Garantir que o usuário foi criado e tem o status TRIAL
      if (data?.user) {
        console.log('Usuário criado com sucesso. ID:', data.user.id);
        
        // Criar ou atualizar o registro na tabela users
        const { error: dbError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            status: 'TRIAL',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (dbError) {
          console.error('Erro ao criar registro do usuário no banco de dados:', dbError);
        } else {
          console.log('Registro do usuário criado/atualizado com sucesso na tabela users');
        }
        
        // Retornar sucesso, mas sem fazer logout automaticamente
        return { 
          error: null,
          confirmation_sent: true,
          should_redirect: false,  // Indica que não deve ser redirecionado para login
          message: 'Conta criada com sucesso! Verifique seu email para confirmar o cadastro.'
        };
      } else {
        console.warn('Dados do usuário não disponíveis após signUp');
      }
      
      return { error: null };
    } catch (err) {
      console.error('Erro durante o processo de cadastro:', err);
      return { error: err };
    }
  };

  // Função para atualizar rádios favoritas no metadata do usuário
  const updateFavoriteRadios = async (radios: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Primeiro, atualizar os metadados do usuário na auth
      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          favorite_radios: radios
        }
      });

      if (error) throw error;
      
      // Também atualizar o campo favorite_radios na tabela users
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          favorite_radios: radios,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      if (dbError) {
        console.error('Erro ao atualizar rádios favoritas no banco de dados:', dbError);
        // Não lançar erro aqui para não impedir a navegação, pois os metadados já foram atualizados
      }
      
      console.log('Rádios favoritas atualizadas com sucesso:', radios);
    } catch (error) {
      console.error('Erro ao atualizar rádios favoritas:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    userStatus,
    loading,
    error,
    trialDaysRemaining,
    login,
    logout: signOut,
    updateUserStatus,
    refreshUserStatus,
    signUp,
    updateFavoriteRadios
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
