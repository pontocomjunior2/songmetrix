import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { syncUserWithBrevo } from '../utils/brevo-service';

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
  const [userStatus, setUserStatus] = useState<UserStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const isRefreshing = useRef(false);
  const isInitialized = useRef(false);
  const isMounted = useRef(true);
  const hasWelcomeEmailBeenSent = useRef(false);
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
          const daysRemaining = Math.max(0, 14 - diffDays);
          
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

  // Função para enviar email de boas-vindas
  const sendWelcomeEmail = async (): Promise<boolean> => {
    try {
      if (!currentUser || hasWelcomeEmailBeenSent.current) {
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return false;
      }

      // Verificar se este usuário já recebeu um email de boas-vindas
      const { data: existingLogs, error: logsError } = await supabase
        .from('email_logs')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('status', 'SUCCESS')
        .limit(1);

      if (logsError) {
        console.error('Erro ao verificar logs de email:', logsError);
        return false;
      }

      // Se já recebeu email de boas-vindas, não enviar novamente
      if (existingLogs && existingLogs.length > 0) {
        hasWelcomeEmailBeenSent.current = true;
        return false;
      }

      // Chamar a API para enviar o email de boas-vindas
      try {
        const response = await fetch(`${EMAIL_SERVER_URL}/api/email/send-welcome`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ userId: currentUser.id })
        });

        if (!response.ok) {
          console.error(`Erro na API: ${response.status} ${response.statusText}`);
          return false;
        }

        const result = await response.json();

        if (result.success) {
          hasWelcomeEmailBeenSent.current = true;
          toast.success('Email de boas-vindas enviado com sucesso!');
          return true;
        } else {
          console.error('Erro ao enviar email de boas-vindas:', result.message);
          return false;
        }
      } catch (error) {
        console.error('Erro ao enviar email de boas-vindas:', error);
        return false;
      }
    } catch (error) {
      console.error('Erro ao enviar email de boas-vindas:', error);
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
        
        // Obter sessão atual com detalhes completos
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (isMounted.current) {
            setCurrentUser(null);
            setUserStatus(null);
            setLoading(false);
          }
          return;
        }
        
        // Atualizar usuário e status
        await refreshUserStatus();
        
        // Verificar se é o primeiro login 
        const isFirstAccess = !hasWelcomeEmailBeenSent.current;
        
        if (isFirstAccess) {
          // Verificar se o first_login_at já está registrado
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('first_login_at')
            .eq('id', user.id)
            .single();
            
          // Se first_login_at não estiver definido, atualizar com a data/hora atual
          if (!userError && userData && !userData.first_login_at) {
            await supabase
              .from('users')
              .update({ first_login_at: new Date().toISOString() })
              .eq('id', user.id);
              
            console.log('Primeiro login registrado para o usuário:', user.id);
            
            // Processar imediatamente os emails após primeiro login
            try {
              const { data: { session } } = await supabase.auth.getSession();
              
              if (session) {
                console.log('Processando emails após primeiro login para o usuário:', user.id);
                
                // Chamar API para processar emails de primeiro login específicos para este usuário
                const response = await fetch(`${EMAIL_SERVER_URL}/api/email/process-first-login`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                  },
                  body: JSON.stringify({ userId: user.id })
                });
                
                if (!response.ok) {
                  console.error('Erro ao processar emails após primeiro login:', response.status, response.statusText);
                } else {
                  const result = await response.json();
                  console.log('Resultado do processamento de emails após primeiro login:', result);
                }
              }
            } catch (processError) {
              console.error('Erro ao processar emails após primeiro login:', processError);
            }
          }
          
          // Enviar email de boas-vindas
          sendWelcomeEmail();
        }
      } catch (error) {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };
    
    // Inicializar autenticação
    initializeAuth();
    
    // Verificar se estamos na página de registro ou pending-approval
    const isRegisterOrPendingPage = 
      window.location.pathname.includes('/register') || 
      window.location.pathname.includes('/pending-approval');
    
    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Logar todos os eventos para diagnóstico
      console.log('Evento de autenticação:', event, session ? 'com sessão' : 'sem sessão');
      
      // Verificar especificamente eventos de atualização de usuário
      if (event === 'USER_UPDATED' && session?.user) {
        console.log('Usuário atualizado:', {
          id: session.user.id,
          email: session.user.email,
          created_at: session.user.created_at,
          metadados: session.user.user_metadata
        });
      }
      
      // Ignorar eventos específicos para evitar loops
      if (event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        return;
      }
      
      // Se estivermos na página de registro ou pending-approval, não redirecionar em caso de SIGNED_OUT
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
        .select('status, created_at, first_login_at')
        .eq('id', user.id)
        .single();

      if (dbError) {
        console.error('Erro ao buscar status do usuário:', dbError);
        throw new CustomAuthError('Erro ao verificar status do usuário');
      }

      // Atualizar estado com dados do usuário
      if (isMounted.current) {
        setCurrentUser(user);
        setUserStatus(dbUser.status as UserStatusType);
        
        // Registrar último acesso
        const { error: loginUpdateError } = await supabase
          .from('users')
          .update({ last_sign_in_at: new Date().toISOString() })
          .eq('id', user.id);
          
        if (loginUpdateError) {
          console.error('Erro ao registrar último acesso:', loginUpdateError);
        } else {
          console.log('Último acesso registrado para o usuário:', user.id);
        }
        
        // Se o usuário não tem primeiro login registrado
        if (!dbUser.first_login_at) {
          // Registrar o primeiro login
          const { error: updateError } = await supabase
            .from('users')
            .update({ first_login_at: new Date().toISOString() })
            .eq('id', user.id);
            
          if (updateError) {
            console.error('Erro ao registrar primeiro login:', updateError);
          } else {
            console.log('Primeiro login registrado para o usuário:', user.id);
            
            // Processar imediatamente os emails após primeiro login
            try {
              const { data: { session } } = await supabase.auth.getSession();
              
              if (session) {
                console.log('Processando emails após primeiro login para o usuário:', user.id);
                
                // Chamar API para processar emails de primeiro login específicos para este usuário
                const response = await fetch(`${EMAIL_SERVER_URL}/api/email/process-first-login`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                  },
                  body: JSON.stringify({ userId: user.id })
                });
                
                if (!response.ok) {
                  console.error('Erro ao processar emails após primeiro login:', response.status, response.statusText);
                } else {
                  const result = await response.json();
                  console.log('Resultado do processamento de emails após primeiro login:', result);
                }
              }
            } catch (processError) {
              console.error('Erro ao processar emails após primeiro login:', processError);
            }
          }
        }
      }

      // Calcular dias restantes do trial
      let trialDaysRemaining = null;
      if (dbUser.status === 'TRIAL') {
        const createdAt = new Date(dbUser.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, 14 - diffDays);
        
        if (trialDaysRemaining <= 0) {
          await supabase.auth.signOut();
          throw new CustomAuthError('Seu período de avaliação gratuito expirou.');
        }
      }

      // Verificar status permitido
      if (dbUser.status !== 'ADMIN' && dbUser.status !== 'ATIVO' && dbUser.status !== 'TRIAL') {
        await supabase.auth.signOut();
        throw new CustomAuthError('Usuário inativo. Entre em contato com o administrador.');
      }

      // Atualizar estado
      if (isMounted.current) {
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
      
      // Não redirecionar para o login se estiver na página de registro ou pending-approval
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/register') && !currentPath.includes('/pending-approval')) {
        navigate('/login', { replace: true });
      }
    } catch (error) {
      // Ignorar erros no logout
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const signUp = async (email: string, password: string, fullName?: string, whatsapp?: string) => {
    try {
      setLoading(true);
      
      // Verificar inputs
      if (!email || !password) {
        return { error: { message: 'Email e senha são obrigatórios' } };
      }

      // Realizar cadastro no Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            fullName: fullName,
            whatsapp: whatsapp,
            status: 'TRIAL'
          }
        }
      });

      if (error) throw error;
      
      // Garantir que o usuário foi criado e tem o status TRIAL
      if (data?.user) {
        console.log('Usuário criado com sucesso. ID:', data.user.id);
        
        // Tentar criar registro usando o endpoint de API em vez de direto no banco
        try {
          // Criar ou atualizar o registro na tabela users via API do servidor
          const userRegistrationResult = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: data.user.id,
              email: data.user.email,
              status: 'TRIAL',
              full_name: fullName,
              whatsapp: whatsapp,
            })
          });
          
          if (userRegistrationResult.ok) {
            console.log('Registro do usuário criado/atualizado com sucesso na tabela users via API');
          } else {
            console.error('Erro ao criar registro do usuário via API:', await userRegistrationResult.text());
            // Continuar mesmo com erro, pois o usuário foi criado na autenticação
          }
        } catch (dbError) {
          console.error('Erro ao criar registro do usuário no banco de dados:', dbError);
          // Continuar mesmo com erro, pois o usuário foi criado na autenticação
        }
        
        console.log('Processo de cadastro concluído com sucesso. Redirecionando...');
        
        // Retornar sucesso
        return { 
          error: null,
          confirmation_sent: true,
          message: 'Conta criada com sucesso! Verifique seu email para confirmar o cadastro.'
        };
      } else {
        console.warn('Dados do usuário não disponíveis após signUp');
      }
      
      return { 
        error: null
      };
    } catch (err) {
      console.error('Erro durante o processo de cadastro:', err);
      return { 
        error: err
      };
    } finally {
      setLoading(false);
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
    updateFavoriteRadios,
    sendWelcomeEmail
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
