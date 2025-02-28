import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase-client';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = {
  ACCESS_TOKEN: 'supabase.auth.token',
  REFRESH_TOKEN: 'supabase.auth.refresh_token'
};

// Componente de carregamento simples
const LoadingComponent = ({ message = "Carregando..." }: { message?: string }) => (

  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 9999
  }}>
    <div style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold', color: '#3498db' }}>{message}</div>
    <div style={{ 
      width: '60px', 
      height: '60px', 
      border: '6px solid #f3f3f3',
      borderTop: '6px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

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
  signOut: () => Promise<void>;
  updateUserStatus: (userId: string, newStatus: UserStatusType) => Promise<void>;
  refreshUserStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Carregando...");
  const navigate = useNavigate();

  // Função para controlar o estado de loading
const finishLoading = () => {
    // Verificar se temos os dados necessários antes de desativar o loading
    if (currentUser && userStatus) {
      console.log("Dados carregados com sucesso, desativando loading...", { 
        user: currentUser.email, 
        status: userStatus 
      });
      setDataLoaded(true);
      setLoadingMessage("Finalizando...");
      setTimeout(() => {
        setLoading(false);
      }, 300);
    } else {
      console.log("Dados ainda não carregados completamente:", { 
        user: currentUser?.email || null, 
        status: userStatus 
      });
      
      // Mesmo sem todos os dados, vamos garantir que o loading seja desativado após um tempo
      if (currentUser) {
        // Se temos pelo menos o usuário, podemos definir um status padrão
        if (!userStatus) {
          const defaultStatus = currentUser.user_metadata?.status || 'ATIVO';
          console.log("Definindo status padrão para finalizar loading:", defaultStatus);
          setUserStatus(defaultStatus as UserStatusType);
        }
        
        // Definir um timeout para garantir que o loading seja desativado
        setTimeout(() => {
          console.log("Forçando finalização do loading após timeout...");
          setDataLoaded(true);
          setLoadingMessage("Finalizando...");
          setTimeout(() => {
            setLoading(false);
          }, 300);
        }, 800);
      } else {
        // Se não temos nem o usuário, vamos para a tela de login
        console.log("Sem dados de usuário, redirecionando para login...");
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
        setLoading(false);
      }
      
      if (currentUser && !userStatus) {
        setLoadingMessage("Carregando informações do usuário...");
      } else if (!currentUser) {
        setLoadingMessage("Verificando autenticação...");
      }
    }


  };

  // Efeito para verificar quando os dados são carregados
  useEffect(() => {
    if (currentUser && userStatus && !dataLoaded) {
      console.log("Dados detectados, finalizando loading...");
      finishLoading();
    }
  }, [currentUser, userStatus, dataLoaded]);

  // Função para executar uma operação com retry
  const executeWithRetry = async <T,>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delay: number = 1000,
    operationName: string = 'Operação'
  ): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`Tentativa ${attempt} para ${operationName}...`);
        }
        
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`${operationName} bem-sucedida na tentativa ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        console.error(`Erro na tentativa ${attempt} para ${operationName}:`, error);
        
        if (attempt <= maxRetries) {
          console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Aumentar o delay para a próxima tentativa (exponential backoff)
          delay = delay * 1.5;
        }
      }
    }
    
    throw lastError;
  };

  // Função para verificar a conexão com o banco de dados
const checkDatabaseConnection = async (): Promise<boolean> => {
    try {
      console.log("Verificando conexão com o banco de dados...");
      const startTime = Date.now();
      
      // Adicionar um timeout específico para a verificação de conexão
      const connectionPromise = executeWithRetry(
        async () => {
          const response = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true });
          return response;
        },
        2,
        500,
        'Verificação de conexão com o banco de dados'
      );
      
      // Criar uma promessa de timeout
      const timeoutPromise = new Promise<{error: {message: string}}>((resolve) => {
        setTimeout(() => {
          resolve({error: {message: 'Timeout ao verificar conexão com o banco de dados'}});
        }, 3000);
      });
      
      // Usar Promise.race para pegar o resultado mais rápido
      const result = await Promise.race([connectionPromise, timeoutPromise]);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (result.error) {
        console.error("Erro ao verificar conexão com o banco de dados:", result.error);
        return false;
      }
      
      console.log(`Conexão com o banco de dados verificada com sucesso. Tempo de resposta: ${responseTime}ms`);
      return true;
    } catch (error) {
      console.error("Erro crítico ao verificar conexão com o banco de dados:", error);
      return false;
    }
  };



  // Função para sincronizar o status do usuário com o banco de dados
  const syncUserStatus = async (user: User): Promise<UserStatusType> => {
    try {
      console.log("Sincronizando status do usuário:", user.email);
      
      // Verificar conexão com o banco de dados
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        console.warn("Sem conexão com o banco de dados, usando status dos metadados");
        return user.user_metadata?.status as UserStatusType || 'ATIVO';
      }
      
      // Primeiro, verificar se há status nos metadados
      const metadataStatus = user.user_metadata?.status as UserStatusType | undefined;
      console.log("Status nos metadados:", metadataStatus || "não definido");
      
      // Tentar obter status do banco
      console.log("Buscando status no banco de dados para o usuário:", user.id);
      
      const result = await executeWithRetry(
        async () => {
          const response = await supabase
            .from('users')
            .select('status, created_at')
            .eq('id', user.id)
            .single();
          return response;
        },
        2,
        500,
        'Busca de status do usuário'
      );
        
      if (result.error) {
        console.error("Erro ao buscar status no banco:", result.error);
        // Em caso de erro, usar os metadados
        console.log("Usando status dos metadados devido a erro:", metadataStatus || 'ATIVO');
        return metadataStatus || 'ATIVO';
      }
      
      const dbUser = result.data;
      if (!dbUser) {
        console.error("Usuário não encontrado no banco");
        // Em caso de usuário não encontrado, usar os metadados
        console.log("Usando status dos metadados devido a usuário não encontrado:", metadataStatus || 'ATIVO');
        return metadataStatus || 'ATIVO';
      }
      
      console.log("Status encontrado no banco:", dbUser.status);
      
      // Se o status do banco for diferente do status nos metadados, atualizar os metadados
      if (metadataStatus !== dbUser.status) {
        console.log("Atualizando metadados com status do banco:", dbUser.status);
        await executeWithRetry(
          async () => {
            const response = await supabase.auth.updateUser({
              data: { status: dbUser.status }
            });
            return response;
          },
          2,
          500,
          'Atualização de metadados do usuário'
        );
      }
      
      // Verificar se é TRIAL e calcular dias restantes
      if (dbUser.status === 'TRIAL') {
        const createdAt = new Date(dbUser.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, 7 - diffDays);
        
        console.log("Dias restantes de trial:", daysRemaining);
        setTrialDaysRemaining(daysRemaining);
        
        if (daysRemaining <= 0) {
          console.log("Trial expirado, atualizando status...");
          // Atualizar status no banco e nos metadados
          await executeWithRetry(
            async () => {
              const response = await supabase
                .from('users')
                .update({ status: 'INATIVO' })
                .eq('id', user.id);
              return response;
            },
            2,
            500,
            'Atualização de status do usuário para INATIVO'
          );
            
          await executeWithRetry(
            async () => {
              const response = await supabase.auth.updateUser({
                data: { status: 'INATIVO' }
              });
              return response;
            },
            2,
            500,
            'Atualização de metadados do usuário para INATIVO'
          );
          
          return 'INATIVO';
        }
      } else {
        setTrialDaysRemaining(null);
      }
      
      return dbUser.status as UserStatusType;
    } catch (error) {
      console.error("Erro ao sincronizar status do usuário:", error);
      // Em caso de erro, usar os metadados ou definir um padrão
      return user.user_metadata?.status as UserStatusType || 'ATIVO';
    }
  };

  // Função para armazenar a sessão
  const storeSession = (session: Session) => {
    sessionStorage.setItem(STORAGE_KEY.ACCESS_TOKEN, session.access_token);
    sessionStorage.setItem(STORAGE_KEY.REFRESH_TOKEN, session.refresh_token);
  };

  // Função para obter a sessão armazenada
  const getStoredSession = () => {
    const access_token = sessionStorage.getItem(STORAGE_KEY.ACCESS_TOKEN);
    const refresh_token = sessionStorage.getItem(STORAGE_KEY.REFRESH_TOKEN);
    return access_token && refresh_token ? { access_token, refresh_token } : null;
  };

  // Função para limpar sessão antes do fechamento da página
  useEffect(() => {
    // Remover o evento beforeunload que limpa o sessionStorage
  }, []);


  // Função para atualizar explicitamente o status do usuário
  const refreshUserStatus = async (): Promise<boolean> => {
    try {
      console.log("Iniciando refreshUserStatus...");
      setLoading(true);
      setDataLoaded(false);
      setLoadingMessage("Atualizando informações do usuário...");
      
      // Configurar um timeout para garantir que o loading seja desativado
      const refreshTimeout = setTimeout(() => {
        console.log('Timeout de refresh atingido, verificando dados...');
        finishLoading();
      }, 8000); // 8 segundos
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error("Erro ao obter usuário:", error);
        clearTimeout(refreshTimeout);
        setLoading(false);
        return false;
      }
      
      if (!user) {
        console.error("Nenhum usuário encontrado");
        clearTimeout(refreshTimeout);
        setLoading(false);
        return false;
      }
      
      // Definir o usuário imediatamente
      setCurrentUser(user);
      
      console.log("Usuário obtido:", user.email);
      console.log("Metadados do usuário:", user.user_metadata);
      
      // Primeiro, tentar obter status do banco
      console.log("Verificando status no banco de dados...");
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('status, created_at')
        .eq('id', user.id)
        .single();
        
      // Limpar o timeout
      clearTimeout(refreshTimeout);
        
      if (dbError) {
        console.error("Erro ao buscar status no banco:", dbError);
        // Em caso de erro, usar os metadados
        const userStatus = user.user_metadata?.status || 'ATIVO';
        console.log("Usando status dos metadados devido a erro:", userStatus);
        setUserStatus(userStatus as UserStatusType);
        finishLoading();
        return true;
      }
      
      if (!dbUser) {
        console.error("Usuário não encontrado no banco");
        // Em caso de usuário não encontrado, usar os metadados
        const userStatus = user.user_metadata?.status || 'ATIVO';
        console.log("Usando status dos metadados devido a usuário não encontrado:", userStatus);
        setUserStatus(userStatus as UserStatusType);
        finishLoading();
        return true;
      }
      
      console.log("Status encontrado no banco:", dbUser.status);
      
      // Atualizar metadados com o status do banco
      await supabase.auth.updateUser({
        data: { status: dbUser.status }
      });
      
      // Verificar status permitidos
      if (dbUser.status === 'ADMIN' || dbUser.status === 'ATIVO' || dbUser.status === 'TRIAL') {
        console.log("Status válido encontrado:", dbUser.status);
        setUserStatus(dbUser.status as UserStatusType);
        
        // Calcular dias restantes se for TRIAL
        if (dbUser.status === 'TRIAL') {
          const createdAt = new Date(dbUser.created_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - createdAt.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.max(0, 7 - diffDays);
          
          console.log("Dias restantes de trial:", daysRemaining);
          setTrialDaysRemaining(daysRemaining);
          
          if (daysRemaining <= 0) {
            console.log("Trial expirado, atualizando status...");
            // Atualizar status no banco e nos metadados
            const { error: updateError } = await supabase
              .from('users')
              .update({ status: 'INATIVO' })
              .eq('id', user.id);
              
            if (updateError) {
              console.error("Erro ao atualizar status no banco:", updateError);
            }
            
            await supabase.auth.updateUser({
              data: { status: 'INATIVO' }
            });
            
            navigate('/plans', { 
              state: { 
                trialExpired: true,
                message: 'Seu período de avaliação gratuito expirou. Escolha um plano para continuar utilizando o sistema.'
              } 
            });
            setLoading(false);
            return false;
          }
        } else {
          setTrialDaysRemaining(null);
        }
        
        console.log("Autenticação bem-sucedida, permitindo acesso");
        finishLoading();
        return true;
      } else {
        console.log("Status não permitido:", dbUser.status);
        navigate('/login', {
          state: {
            error: 'Usuário inativo. Entre em contato com o administrador.'
          }
        });
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error("Erro crítico em refreshUserStatus:", error);
      setLoading(false);
      return false;
    }
  };

  // Verificar sessão inicial
  useEffect(() => {
    let isSubscribed = true;
    let authSubscription: { unsubscribe: () => void } | null = null;
    
    console.log("Iniciando verificação de autenticação...");
    
    // Configurar um timeout global para garantir que o loading seja desativado
    const globalTimeout = setTimeout(() => {
      console.log('Timeout global atingido, forçando desativação do loading...');
      if (isSubscribed) {
        // Verificar se temos pelo menos o usuário
        if (currentUser && !userStatus) {
          // Se temos o usuário mas não o status, definir um status padrão
          const defaultStatus = currentUser.user_metadata?.status || 'ATIVO';
          console.log('Definindo status padrão devido ao timeout global:', defaultStatus);
          setUserStatus(defaultStatus as UserStatusType);
        }
        setLoading(false);
      }
    }, 5000); // Timeout global
    
    const getInitialSession = async () => {
      if (!isSubscribed) return;
      try {
        setLoading(true);
        setDataLoaded(false);
        setLoadingMessage("Verificando sessão...");
        console.log("Iniciando verificação de sessão inicial...");
        
        // Verificar conexão com o banco de dados
        await checkDatabaseConnection();
        
        // Configurar um timeout específico para a verificação de sessão
        const sessionTimeout = setTimeout(() => {
          console.log('Timeout de verificação de sessão atingido...');
          if (isSubscribed) {
            setLoading(false);
            if (window.location.pathname !== '/login') {
              navigate('/login');
            }
          }
        }, 3000);
        
        // Simplificar a obtenção da sessão
        console.log("Obtendo sessão atual...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Limpar o timeout específico
        clearTimeout(sessionTimeout);
        
        if (sessionError) {
          console.error("Erro ao obter sessão:", sessionError);
          setLoading(false);
          if (window.location.pathname !== '/login') {
            navigate('/login');
          }
          return;
        }
        
        if (!session) {
          console.log("Nenhuma sessão inicial encontrada");
          setCurrentUser(null);
          setUserStatus(null);
          if (window.location.pathname !== '/login') {
            navigate('/login');
          }
          setLoading(false);
          return;
        }        
        
        console.log("Sessão inicial encontrada para:", session.user.email);
        
        // Armazenar a sessão no sessionStorage
        storeSession(session);
        console.log("Sessão armazenada no sessionStorage");
        
        // Definir o usuário imediatamente
        setCurrentUser(session.user);
        console.log("Usuário definido:", session.user.email);
        
        // Definir um status padrão dos metadados para evitar tela de loading
        const defaultStatus = session.user.user_metadata?.status || 'ATIVO';
        setUserStatus(defaultStatus as UserStatusType);
        console.log("Status padrão definido:", defaultStatus);
        
        // Sincronizar o status do usuário com o banco de dados
        try {
          console.log("Iniciando sincronização de status...");
          const status = await syncUserStatus(session.user);
          console.log("Status sincronizado:", status);
          
          if (status === 'INATIVO') {
            console.log("Usuário inativo, redirecionando para login...");
            navigate('/login', {
              state: {
                error: 'Usuário inativo. Entre em contato com o administrador.'
              }
            });
            setLoading(false);
            return;
          } else if (status === 'TRIAL' && trialDaysRemaining !== null && trialDaysRemaining <= 0) {
            console.log("Trial expirado, redirecionando para planos...");
            navigate('/plans', { 
              state: { 
                trialExpired: true,
                message: 'Seu período de avaliação gratuito expirou. Escolha um plano para continuar.'
              } 
            });
            setLoading(false);
            return;
          }
          
          setUserStatus(status);
          console.log("Status definido após sincronização:", status);
          
          // Redirecionar para o dashboard se estiver na página de login
          if (window.location.pathname === '/login') {
            console.log("Redirecionando para o dashboard...");
            navigate('/dashboard');
          }
          
          console.log("Sessão inicial verificada com sucesso!");
        } catch (error) {
          console.error("Erro ao sincronizar status do usuário:", error);
          // Em caso de erro, manter o status padrão
        } finally {
          console.log("Finalizando carregamento após verificação de sessão...");
          finishLoading();
        }
      } catch (error) {
        console.error("Erro crítico na verificação de sessão:", error);
        if (isSubscribed) {
          setCurrentUser(null);
          setUserStatus(null);
        }
        navigate('/login', {
          state: {
            error: 'Erro ao verificar sessão. Por favor, tente novamente.'
          }
        });
        setLoading(false);
      }
    };

    // Iniciar a verificação de sessão apenas uma vez
    getInitialSession();
    
    // Configurar o listener de autenticação
    authSubscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;
        
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_OUT' || !session) {
          console.log('Usuário desconectado ou sessão expirada');
          setCurrentUser(null);
          setUserStatus(null);
          setTrialDaysRemaining(null);
          sessionStorage.removeItem('supabase.auth.token');
          sessionStorage.removeItem('supabase.auth.refresh_token');
          if (window.location.pathname !== '/login') {
            navigate('/login');
          }
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('Usuário conectado ou token atualizado:', session.user.email);
          
          // Definir o usuário imediatamente para evitar tela de loading
          setCurrentUser(session.user);
          console.log("Usuário definido após evento de autenticação:", session.user.email);
          
          // Armazenar a sessão no sessionStorage
          storeSession(session);
          console.log("Sessão armazenada no sessionStorage após evento de autenticação");
          
          // Definir um status padrão dos metadados para evitar tela de loading
          const defaultStatus = session.user.user_metadata?.status || 'ATIVO';
          setUserStatus(defaultStatus as UserStatusType);
          console.log("Status padrão definido após evento de autenticação:", defaultStatus);
          
          // Desativar loading imediatamente para melhorar a experiência do usuário
          setLoading(false);
          
          // Sincronizar o status do usuário com o banco de dados em segundo plano
          setTimeout(() => {
            console.log("Iniciando sincronização de status após evento de autenticação em segundo plano...");
            syncUserStatus(session.user).then(status => {
              console.log("Status sincronizado após evento de autenticação em segundo plano:", status);
              
              if (status === 'INATIVO') {
                console.log("Usuário inativo, redirecionando para login...");
                supabase.auth.signOut().then(() => {
                  setCurrentUser(null);
                  setUserStatus(null);
                  navigate('/login', {
                    state: {
                      error: 'Usuário inativo. Entre em contato com o administrador.'
                    }
                  });
                });
                return;
              } else if (status === 'TRIAL' && trialDaysRemaining !== null && trialDaysRemaining <= 0) {
                console.log("Trial expirado, redirecionando para planos...");
                navigate('/plans', { 
                  state: { 
                    trialExpired: true,
                    message: 'Seu período de avaliação gratuito expirou. Escolha um plano para continuar.'
                  } 
                });
                return;
              }
              
              setUserStatus(status);
              console.log("Status definido após sincronização em evento de autenticação:", status);
              
              // Redirecionar para o dashboard se estiver na página de login
              if (window.location.pathname === '/login') {
                console.log("Redirecionando para o dashboard após evento de autenticação...");
                navigate('/dashboard');
              }
              
              console.log("Login concluído com sucesso!");
            }).catch(error => {
              console.error("Erro ao sincronizar status do usuário após evento de autenticação:", error);
              // Em caso de erro, manter o status padrão
            });
          }, 100);
        } else {
          console.log("Evento de autenticação não tratado:", event);
        }
      }
    ).data.subscription;
    
    return () => {
      console.log("Limpando efeito de autenticação...");
      isSubscribed = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
      // Limpar o timeout global
      clearTimeout(globalTimeout);
    };
  }, [navigate, trialDaysRemaining]);

  const login = async (email: string, password: string): Promise<{ error: CustomAuthError | null }> => {
    try {
      setError(null);
      setLoading(true);
      setDataLoaded(false);
      setLoadingMessage("Realizando login...");
      console.log('Iniciando processo de login...');

      // Configurar um timeout para garantir que o loading seja desativado
      // Aumentando o timeout para 5 segundos
      const loadingTimeout = setTimeout(() => {
        console.log('Timeout de login atingido, verificando dados...');
        finishLoading();
      }, 5000);

      // 1. Tentar fazer login
      console.log("Tentando fazer login com email:", email);
      const result = await executeWithRetry(
        async () => {
          const response = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          return response;
        },
        2,
        500,
        'Login'
      );

      // Limpar o timeout se o login for bem-sucedido
      clearTimeout(loadingTimeout);

      if (result.error) {
        console.error('Erro no login:', result.error);
        throw result.error;
      }

      const data = result.data;
      if (!data?.user) {
        console.error('Usuário não encontrado nos dados de retorno');
        throw new CustomAuthError('Usuário não encontrado');
      }

      console.log("Login bem-sucedido para:", data.user.email);
      
      // Definir o usuário imediatamente para evitar tela de loading
      setCurrentUser(data.user);
      console.log("Usuário definido após login:", data.user.email);
      
      // Verificar status nos metadados ou definir um padrão
      const userStatus = data.user.user_metadata?.status || 'ATIVO';
      setUserStatus(userStatus as UserStatusType);
      console.log("Status definido após login:", userStatus);
      
      // Armazenar a sessão no sessionStorage
      if (data.session) {
        storeSession(data.session);
        console.log("Sessão armazenada no sessionStorage após login");
      }
      
      // Redirecionar para o dashboard antes de iniciar a sincronização
      console.log('Login bem-sucedido, redirecionando para o dashboard...');
      navigate('/dashboard');
      
      // Desativar loading após redirecionar
      console.log("Finalizando carregamento após login...");
      finishLoading();
      
      // Sincronizar o status do usuário em segundo plano, sem bloquear a UI
      setTimeout(() => {
        console.log("Iniciando sincronização de status em segundo plano...");
        syncUserStatus(data.user).then(status => {
          console.log("Status sincronizado em segundo plano:", status);
          setUserStatus(status);
        }).catch(error => {
          console.error("Erro ao sincronizar status em segundo plano:", error);
        });
      }, 100);
      
      return { error: null };
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      await supabase.auth.signOut();
      
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

  const signOut = async () => {
    setCurrentUser(null);
    setUserStatus(null);
    await supabase.auth.signOut();
    navigate('/login');
  };

  const updateUserStatus = async (userId: string, newStatus: UserStatusType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const isAdmin = user.user_metadata?.status === 'ADMIN';

      if (!isAdmin) {
        throw new Error('Usuário não tem permissão de administrador');
      }

      // Update user status in the database
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (dbError) {
        console.error('Error updating user status:', dbError);
        throw dbError;
      }

      // Get the user's current metadata
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        throw userError;
      }

      // Update user metadata through the API
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
        throw new Error('Failed to update user metadata');
      }

    } catch (error) {
      console.error('Error in updateUserStatus:', error);
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
    signOut,
    updateUserStatus,
    refreshUserStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loading && <LoadingComponent message={loadingMessage} />}
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
