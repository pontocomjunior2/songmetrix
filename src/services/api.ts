import { supabase } from '../lib/supabase-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
 * Função para fazer requisições GET à API
 */
export const apiGet = async (endpoint: string, params?: Record<string, any>) => {
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
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Falha na requisição: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`Erro na requisição GET para ${endpoint}:`, error);
    if (error?.code === 'auth/requires-recent-login') {
      alert('Sua sessão expirou. Por favor, faça login novamente.');
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
    create: (stream: any) => apiPost('/api/streams', stream),
    update: (id: number, stream: any) => apiPut(`/api/streams/${id}`, stream),
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
};

export default apiServices; 