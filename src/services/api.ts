import { supabase } from '../lib/supabase-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;
const CRITICAL_ENDPOINTS = ['/api/radios/status', '/api/dashboard', '/api/ranking'];

// Função para delay com Promessa
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Obtém os cabeçalhos de autenticação para as requisições à API
 */
export const getAuthHeaders = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Nenhum token de autenticação disponível');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (error: any) {
    console.error('Erro ao obter cabeçalhos de autenticação:', error);
    throw error;
  }
};

/**
 * Função para fazer requisições GET à API com retry
 */
export const apiGet = async <T = any>(endpoint: string, params?: Record<string, any>, retryCount = 0): Promise<T> => {
  try {
    const headers = await getAuthHeaders();
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(val => url.searchParams.append(key, val));
        } else if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    // Log para endpoints críticos
    const isCritical = CRITICAL_ENDPOINTS.some(criticalEndpoint => endpoint.includes(criticalEndpoint));
    if (isCritical) {
      console.log(`Requisição para endpoint crítico ${endpoint}, tentativa ${retryCount + 1}/${MAX_RETRIES + 1}`);
    }
    
    // Adicionar timeout para evitar que a requisição fique pendurada
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout
    
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Tratar especificamente erros 503 (Service Unavailable)
      if (response.status === 503) {
        console.warn(`Serviço indisponível (503) para ${endpoint}. Tentativa ${retryCount + 1}/${MAX_RETRIES}`);
        
        // Se for um endpoint crítico e ainda não excedemos o número máximo de tentativas
        if (retryCount < MAX_RETRIES) {
          // Backoff exponencial para evitar sobrecarregar ainda mais o servidor
          const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Aguardando ${backoffDelay}ms antes da próxima tentativa...`);
          await delay(backoffDelay);
          return apiGet(endpoint, params, retryCount + 1);
        }
        
        // Se for um endpoint crítico e já tentamos o máximo, podemos retornar um fallback
        if (isCritical) {
          console.warn(`Todas as tentativas falharam para ${endpoint}, verificando fallback`);
          
          if (endpoint === '/api/radios/status') {
            // O fallback para o status das rádios está implementado mais abaixo
            // Deixar o código continuar para chegar lá
          } else {
            // Para outros endpoints críticos, lançar erro para que seja tratado no nível da aplicação
            throw new Error(`Serviço indisponível após ${MAX_RETRIES} tentativas: ${endpoint}`);
          }
        }
      }
      
      if (!response.ok) {
        // Verificar se o endpoint é crítico e merece retry
        if (isCritical && retryCount < MAX_RETRIES) {
          console.warn(`Falha na requisição para ${endpoint}: ${response.status}. Tentando novamente em ${RETRY_DELAY}ms...`);
          const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount);
          await delay(backoffDelay); // Exponential backoff
          return apiGet(endpoint, params, retryCount + 1);
        }
        
        // Se não for crítico ou já tentou suficiente, lança o erro
        throw new Error(`Falha na requisição: ${response.status} para ${endpoint}`);
      }
      
      return await response.json();
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Erro de timeout ou conexão
      if (fetchError.name === 'AbortError') {
        console.error(`Timeout na requisição para ${endpoint}`);
        
        // Para endpoints críticos, tentar novamente
        if (isCritical && retryCount < MAX_RETRIES) {
          console.warn(`Timeout na requisição para ${endpoint}. Tentando novamente...`);
          const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount);
          await delay(backoffDelay);
          return apiGet(endpoint, params, retryCount + 1);
        }
        
        throw new Error(`Timeout na requisição para ${endpoint}`);
      }
      
      // Para outros erros de rede em endpoints críticos
      if (isCritical && retryCount < MAX_RETRIES) {
        console.warn(`Erro na requisição para ${endpoint}: ${fetchError.message}. Tentando novamente...`);
        const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount);
        await delay(backoffDelay);
        return apiGet(endpoint, params, retryCount + 1);
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error(`Erro na requisição GET para ${endpoint}:`, error);
    
    // Implementação de fallback para endpoints críticos quando todas as retentativas falharem
    if (endpoint === '/api/radios/status' && retryCount >= MAX_RETRIES) {
      console.warn('Todas as tentativas falharam para /api/radios/status, retornando dados de fallback');
      
      try {
        // Tentar obter as rádios favoritas do usuário
        const { data: { user } } = await supabase.auth.getUser();
        const favoriteRadios = user?.user_metadata?.favorite_radios || [];
        
        // Retornar um fallback com status offline para todas as rádios favoritas
        return favoriteRadios.map((name: string) => ({
          name,
          status: 'OFFLINE',
          lastUpdate: new Date().toISOString(),
          isFavorite: true
        }));
      } catch (fallbackError) {
        console.error('Erro ao criar dados de fallback:', fallbackError);
      }
    }
    
    // Para outros endpoints críticos, propagamos o erro para ser tratado pelos componentes
    if (CRITICAL_ENDPOINTS.some(criticalEndpoint => endpoint.includes(criticalEndpoint)) && retryCount >= MAX_RETRIES) {
      throw new Error(`Falha no endpoint crítico ${endpoint} após ${MAX_RETRIES} tentativas: ${error.message}`);
    }
    
    if (error?.code === 'auth/requires-recent-login') {
      console.warn('Sessão expirada, redirecionando para login...');
      // Ao invés de usar alert que bloqueia a UI
      window.location.href = '/login';
    }
    throw error;
  }
};

/**
 * Função para fazer requisições POST à API
 */
export const apiPost = async (endpoint: string, data: any) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`Erro na requisição POST para ${endpoint}:`, error);
    if (error?.code === 'auth/requires-recent-login') {
      alert('Sua sessão expirou. Por favor, faça login novamente.');
    }
    throw error;
  }
};

/**
 * Função para fazer requisições PUT à API
 */
export const apiPut = async (endpoint: string, data: any) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`Erro na requisição PUT para ${endpoint}:`, error);
    if (error?.code === 'auth/requires-recent-login') {
      alert('Sua sessão expirou. Por favor, faça login novamente.');
    }
    throw error;
  }
};

/**
 * Função para fazer requisições DELETE à API
 */
export const apiDelete = async (endpoint: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`Erro na requisição DELETE para ${endpoint}:`, error);
    if (error?.code === 'auth/requires-recent-login') {
      alert('Sua sessão expirou. Por favor, faça login novamente.');
    }
    throw error;
  }
};

/**
 * Função para fazer upload de arquivos
 */
export const apiUpload = async (endpoint: string, formData: FormData) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Nenhum token de autenticação disponível');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      // Não incluir Content-Type aqui, o navegador irá definir automaticamente com o boundary correto
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`Erro na requisição de upload para ${endpoint}:`, error);
    if (error?.code === 'auth/requires-recent-login') {
      alert('Sua sessão expirou. Por favor, faça login novamente.');
    }
    throw error;
  }
};

/**
 * Serviços específicos da API
 */
export const apiServices = {
  // Serviços de relatórios
  reports: {
    getRadios: () => apiGet('/api/radios/status'),
    getRadioAbbreviations: () => apiGet('/api/radio-abbreviations'),
    getCities: () => apiGet('/api/cities'),
    getStates: () => apiGet('/api/states'),
    validateLocation: (city: string, state: string) => 
      apiGet('/api/validate-location', { city, state }),
    getRadiosByLocation: (city?: string, state?: string) => 
      apiGet('/api/radios/by-location', { city, state }),
    generateReport: (params: {
      startDate: string,
      endDate: string,
      limit: string,
      radios?: string,
      city?: string,
      state?: string,
      includeSpotify?: boolean
    }) => apiGet('/api/report', params),
  },
  
  // Serviços de streams
  streams: {
    getAll: () => apiGet('/api/streams'),
    getById: (id: number) => apiGet(`/api/streams/${id}`),
    create: (stream: any) => {
      // Normalizar URLs de imagens antes de enviar ao servidor
      const normalizedStream = { ...stream };
      if (normalizedStream.logo_url && normalizedStream.logo_url.includes('localhost') && 
          window.location.hostname !== 'localhost') {
        try {
          const urlObj = new URL(normalizedStream.logo_url);
          normalizedStream.logo_url = `${window.location.origin}${urlObj.pathname}`;
          console.log('API: URL da logo normalizada para produção:', normalizedStream.logo_url);
        } catch (e) {
          console.error('Erro ao normalizar URL da logo:', e);
        }
      }
      return apiPost('/api/streams', normalizedStream);
    },
    update: (id: number, stream: any) => {
      // Normalizar URLs de imagens antes de enviar ao servidor
      const normalizedStream = { ...stream };
      if (normalizedStream.logo_url && normalizedStream.logo_url.includes('localhost') && 
          window.location.hostname !== 'localhost') {
        try {
          const urlObj = new URL(normalizedStream.logo_url);
          normalizedStream.logo_url = `${window.location.origin}${urlObj.pathname}`;
          console.log('API: URL da logo normalizada para produção:', normalizedStream.logo_url);
        } catch (e) {
          console.error('Erro ao normalizar URL da logo:', e);
        }
      }
      console.log('Chamando apiPut para atualizar stream:', id, normalizedStream);
      return apiPut(`/api/streams/${id}`, normalizedStream);
    },
    delete: (id: number) => apiDelete(`/api/streams/${id}`),
    search: (query: string) => apiGet('/api/streams/search', { query }),
    filterByRegion: (region: string) => apiGet('/api/streams/filter', { region }),
    filterByState: (state: string) => apiGet('/api/streams/filter', { state }),
    filterByCity: (city: string) => apiGet('/api/streams/filter', { city }),
    filterBySegment: (segment: string) => apiGet('/api/streams/filter', { segment }),
  },
  
  // Adicione outros serviços conforme necessário
  ranking: {
    getRanking: (params: any) => apiGet('/api/ranking', params),
  },
  
  dashboard: {
    getDashboardData: (radioParams: string) => apiGet(`/api/dashboard?${radioParams}`),
  },
  
  // Serviços de upload
  uploads: {
    uploadLogo: (formData: FormData) => apiUpload('/api/uploads/logo', formData),
  },
};

export default apiServices; 