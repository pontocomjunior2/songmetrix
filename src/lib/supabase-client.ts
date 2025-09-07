import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Constantes para controle de sessão
const LAST_ACTIVITY_KEY = 'songmetrix_last_activity';
const SESSION_INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 horas em milissegundos (mais realista)
const ACTIVITY_UPDATE_THROTTLE = 60 * 1000; // 60 segundos entre atualizações
const KEEP_ALIVE_INTERVAL = 15 * 60 * 1000; // 15 minutos para keep-alive

let isRedirecting = false;
let lastActivityUpdate = 0;

// Função para atualizar atividade (throttled)
const updateLastActivity = () => {
  const now = Date.now();
  if (now - lastActivityUpdate > ACTIVITY_UPDATE_THROTTLE) {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      lastActivityUpdate = now;
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
    }
  }
};

// Verificar se a sessão expirou por inatividade
const hasSessionExpiredByInactivity = () => {
  try {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) {
      updateLastActivity();
      return false;
    }

    const inactiveTime = Date.now() - parseInt(lastActivity);
    return inactiveTime > SESSION_INACTIVITY_TIMEOUT;
  } catch (error) {
    return false;
  }
};

// Criar cliente Supabase com configuração otimizada
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true, // Deixar o Supabase gerenciar o refresh automático
    persistSession: true,   // Usar localStorage para persistir sessão
    detectSessionInUrl: true,
    // Remover storage customizado - usar o padrão do Supabase
    flowType: 'pkce' // Usar PKCE para maior segurança
  }
});

// Configurar listeners apenas uma vez
let isInitialized = false;

if (!isInitialized && typeof window !== 'undefined') {
  isInitialized = true;

  // Verificar sessão inicial
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      updateLastActivity();
    }
  }).catch((error) => {
    console.error('Erro ao verificar sessão inicial:', error);
  });

  // Função para limpar cache completamente quando houver problemas de autenticação
  const clearAllCache = () => {
    try {
      // Limpar localStorage relacionado ao app
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('songmetrix') || key.includes('supabase') || key.includes('react-query'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Limpar sessionStorage
      sessionStorage.clear();

      // Limpar cache do React Query através de localStorage (persistido)
      const queryCacheKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('react-query')) {
          queryCacheKeys.push(key);
        }
      }
      queryCacheKeys.forEach(key => localStorage.removeItem(key));

      console.log('Cache completamente limpo devido a problemas de autenticação');
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  };

  // Listener para mudanças de autenticação
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state change:', event, !!session);

    if (event === 'SIGNED_OUT') {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      stopKeepAlive(); // Parar keep-alive quando deslogar
      clearAllCache(); // Limpar cache completamente no logout
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true;
        window.location.href = '/login';
      }
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      updateLastActivity();
      startKeepAlive(); // Iniciar keep-alive quando logar ou renovar token
      isRedirecting = false;
    }

    // Verificar inatividade apenas em eventos relevantes
    if (session && hasSessionExpiredByInactivity()) {
      console.log('Sessão expirada por inatividade');
      stopKeepAlive();
      clearAllCache(); // Limpar cache antes do logout
      await supabase.auth.signOut();
    }
  });

  // Monitoramento de atividade otimizado
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus', 'blur', 'visibilitychange'];

  const handleActivity = (event?: Event) => {
    // Para eventos de scroll e movimento, throttle mais agressivo
    if (event && (event.type === 'mousemove' || event.type === 'scroll')) {
      const now = Date.now();
      if (now - lastActivityUpdate < 10000) { // Só atualizar a cada 10 segundos para mouse/scroll
        return;
      }
    }

    updateLastActivity();
  };

  // Adicionar listeners de atividade
  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, { passive: true });
  });

  // Sistema de keep-alive inteligente
  let keepAliveInterval: NodeJS.Timeout | null = null;

  const startKeepAlive = () => {
    if (keepAliveInterval) return; // Já está rodando

    keepAliveInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Verificar se a sessão ainda é válida e não expirou por inatividade
          if (!hasSessionExpiredByInactivity()) {
            // Atualizar atividade para manter sessão viva
            updateLastActivity();

            // Tentar renovar token se estiver próximo do fim (opcional)
            const expiresAt = session.expires_at;
            const now = Math.floor(Date.now() / 1000);
            const timeToExpiry = expiresAt ? expiresAt - now : 0;

            // Se faltar menos de 30 minutos para expirar, tentar renovar
            if (timeToExpiry > 0 && timeToExpiry < 30 * 60) {
              console.log('Token próximo do fim - tentando renovar automaticamente');
              await supabase.auth.refreshSession();
            }
          } else {
            console.log('Sessão expirada por inatividade - fazendo logout');
            stopKeepAlive();
            await supabase.auth.signOut();
          }
        } else {
          stopKeepAlive();
        }
      } catch (error) {
        console.error('Erro no keep-alive:', error);
      }
    }, KEEP_ALIVE_INTERVAL);
  };

  const stopKeepAlive = () => {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  };

  // Verificação periódica de inatividade (menos frequente - a cada 15 minutos)
  setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && hasSessionExpiredByInactivity()) {
      console.log('Sessão expirada por inatividade - fazendo logout');
      stopKeepAlive();
      await supabase.auth.signOut();
    }
  }, 15 * 60 * 1000); // Verificar a cada 15 minutos

  // Atualizar atividade antes de fechar/recarregar a página
  window.addEventListener('beforeunload', () => {
    updateLastActivity();
  });
}
