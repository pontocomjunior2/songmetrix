import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Constantes para controle de sessão
const LAST_ACTIVITY_KEY = 'songmetrix_last_activity';
const SESSION_INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas em milissegundos (mais realista)
const ACTIVITY_UPDATE_THROTTLE = 30 * 1000; // 30 segundos entre atualizações

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

  // Listener para mudanças de autenticação
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state change:', event, !!session);

    if (event === 'SIGNED_OUT') {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true;
        window.location.href = '/login';
      }
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      updateLastActivity();
      isRedirecting = false;
    }

    // Verificar inatividade apenas em eventos relevantes
    if (session && hasSessionExpiredByInactivity()) {
      console.log('Sessão expirada por inatividade');
      await supabase.auth.signOut();
    }
  });

  // Monitoramento de atividade otimizado
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

  const handleActivity = () => {
    updateLastActivity();
  };

  // Adicionar listeners de atividade
  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, { passive: true });
  });

  // Verificação periódica de inatividade (menos frequente)
  setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && hasSessionExpiredByInactivity()) {
      console.log('Sessão expirada por inatividade - fazendo logout');
      await supabase.auth.signOut();
    }
  }, 5 * 60 * 1000); // Verificar a cada 5 minutos

  // Atualizar atividade antes de fechar/recarregar a página
  window.addEventListener('beforeunload', () => {
    updateLastActivity();
  });
}
