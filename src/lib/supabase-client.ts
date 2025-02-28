import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Constantes para armazenamento
const LAST_ACTIVITY_KEY = 'songmetrix_last_activity';
const SESSION_EXPIRATION_TIME = 15 * 60 * 1000; // 15 minutos em milissegundos
const STORAGE_KEY = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;

let isRedirecting = false; // Flag para prevenir redirecionamentos múltiplos
let isInitialized = false; // Flag para controlar a inicialização única

// Função para limpar todos os dados de sessão
const clearAllSessionData = () => {
  try {
    // Limpar localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    
    // Limpar sessionStorage
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    
    // Limpar cookies relacionados (se houver)
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name.includes('supabase') || name.includes('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  } catch (error) {
    console.error('Erro ao limpar dados de sessão:', error);
  }
};

// Função para atualizar o timestamp de último acesso
const updateLastActivity = () => {
  try {
    const timestamp = Date.now().toString();
    sessionStorage.setItem(LAST_ACTIVITY_KEY, timestamp);
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
  }
};

// Função para verificar se a sessão expirou por inatividade
const hasSessionExpired = () => {
  try {
    // Verificar se há um token de sessão
    const sessionData = sessionStorage.getItem(STORAGE_KEY);
    if (!sessionData) {
      return false;
    }
    
    // Verificar última atividade
    const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) {
      // Se temos um token mas não temos registro de atividade, atualizamos
      updateLastActivity();
      return false;
    }
    
    const inactiveTime = Date.now() - parseInt(lastActivity);
    return inactiveTime > SESSION_EXPIRATION_TIME;
  } catch (error) {
    return false; // Em caso de erro, não consideramos como expirada
  }
};

// Verificar se há uma sessão válida no storage
const hasStoredSession = () => {
  try {
    // Verificar sessionStorage primeiro (principal)
    if (sessionStorage.getItem(STORAGE_KEY)) {
      return true;
    }
    
    // Verificar localStorage como fallback
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      // Migrar para sessionStorage
      sessionStorage.setItem(STORAGE_KEY, localData);
      updateLastActivity();
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

// Implementação otimizada de armazenamento
const customStorage = {
  getItem: (key: string) => {
    try {
      // Verificar expiração apenas para a chave de sessão
      if (key === STORAGE_KEY && hasSessionExpired()) {
        clearAllSessionData();
        return null;
      }
      
      // Buscar do sessionStorage primeiro
      const value = sessionStorage.getItem(key);
      if (value) {
        if (key === STORAGE_KEY) updateLastActivity();
        return value;
      }
      
      // Fallback para localStorage (migração de sistemas antigos)
      const localValue = localStorage.getItem(key);
      if (localValue && key === STORAGE_KEY) {
        sessionStorage.setItem(key, localValue);
        updateLastActivity();
        return localValue;
      }
      
      return localValue || null;
    } catch (error) {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      // Usar sessionStorage como principal
      sessionStorage.setItem(key, value);
      if (key === STORAGE_KEY) {
        updateLastActivity();
        isRedirecting = false;
      }
    } catch (error) {
      console.error('Erro ao definir item:', error);
    }
  },
  removeItem: (key: string) => {
    try {
      // Remover de ambos storages
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Erro ao remover item:', error);
    }
  }
};

// Inicialização rápida - verificar sessão existente
const hasExistingSession = hasStoredSession();

// Criar cliente Supabase com armazenamento personalizado
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: customStorage
  }
});

// Garantir que já temos atividade registrada se houver sessão
if (hasExistingSession && !sessionStorage.getItem(LAST_ACTIVITY_KEY)) {
  updateLastActivity();
}

// Inicialização única para evitar múltiplas verificações
if (!isInitialized) {
  isInitialized = true;
  
  // Verificar sessão inicial sem bloquear renderização
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      updateLastActivity();
    }
  }).catch(() => {});
  
  // Listener para mudanças de autenticação
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearAllSessionData();
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true;
        window.location.href = '/login';
      }
      return;
    }
    
    if (session) {
      updateLastActivity();
      isRedirecting = false;
    }
  });
  
  // Monitoramento de atividade do usuário (reduzido)
  if (typeof window !== 'undefined') {
    // Throttled update para interações do usuário
    let lastUpdate = 0;
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > 10000) { // 10 segundos
        lastUpdate = now;
        if (sessionStorage.getItem(STORAGE_KEY)) {
          updateLastActivity();
        }
      }
    };
    
    // Principais eventos de interação
    document.addEventListener('click', throttledUpdate);
    document.addEventListener('keydown', throttledUpdate);
    
    // Verificação periódica de expiração (reduzida)
    setInterval(() => {
      if (hasSessionExpired() && sessionStorage.getItem(STORAGE_KEY)) {
        clearAllSessionData();
        if (!isRedirecting && window.location.pathname !== '/login') {
          isRedirecting = true;
          window.location.href = '/login';
        }
      }
    }, 60000); // 1 minuto
    
    // Detectar refresh/reload da página para melhorar experiência
    window.addEventListener('beforeunload', () => {
      // Atualizar atividade antes do refresh para garantir persistência
      if (sessionStorage.getItem(STORAGE_KEY)) {
        updateLastActivity();
      }
    });
  }
}
