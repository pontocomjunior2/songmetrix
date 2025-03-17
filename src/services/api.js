// Definir a URL base da API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Função para obter o token de autenticação - melhorada com verificação
const getToken = () => {
  const token = localStorage.getItem('token');
  
  // Verificar se o token existe e é válido (pelo menos não é null ou undefined)
  if (!token) {
    console.warn('Token de autenticação não encontrado');
    return '';
  }
  
  // Verificar se o token parece ser um JWT válido (deve ter 3 segmentos separados por ponto)
  if (!token.includes('.') || token.split('.').length !== 3) {
    console.warn('Token de autenticação parece estar malformado');
    return '';
  }
  
  return token;
};

// Serviço de autenticação
const auth = {
  login: async (credentials) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao fazer login');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Serviço de streams (rádios)
const streams = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/api/streams`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar streams');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar streams:', error);
      throw error;
    }
  },
  
  create: async (streamData) => {
    try {
      const response = await fetch(`${API_URL}/api/streams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(streamData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar stream');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao criar stream:', error);
      throw error;
    }
  },
  
  update: async (id, streamData) => {
    try {
      const response = await fetch(`${API_URL}/api/streams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(streamData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar stream');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar stream:', error);
      throw error;
    }
  },
  
  delete: async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/streams/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir stream');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir stream:', error);
      throw error;
    }
  }
};

// Serviço de dashboard
const dashboard = {
  getStats: async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar estatísticas');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  },
  
  getGenreDistribution: async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard/genre-distribution`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar distribuição de gêneros');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar distribuição de gêneros:', error);
      throw error;
    }
  }
};

// Serviço de execuções
const executions = {
  getRecent: async (limit = 10) => {
    try {
      const response = await fetch(`${API_URL}/api/executions/recent?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar execuções recentes');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar execuções recentes:', error);
      throw error;
    }
  }
};

const uploads = {
  uploadLogo: async (formData) => {
    try {
      const response = await fetch(`${API_URL}/api/uploads/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao fazer upload de logo:', errorData);
        throw new Error(errorData.message || 'Erro ao fazer upload de logo');
      }
      
      const data = await response.json();
      console.log('Resposta do servidor para upload de logo:', data);
      
      // Retornar os dados completos da resposta
      return {
        success: data.success,
        url: data.url,
        fileName: data.fileName,
        radioId: data.radioId,
        radioName: data.radioName
      };
    } catch (error) {
      console.error('Erro ao fazer upload de logo:', error);
      throw error;
    }
  }
};

const apiServices = {
  auth,
  streams,
  dashboard,
  executions,
  uploads
};

export default apiServices; 