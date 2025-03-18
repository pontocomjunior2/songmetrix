// Definir a URL base da API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PROD_URL = 'https://songmetrix.com.br';

import { supabase } from '../lib/supabase-client';

// Função para obter o token de autenticação - usando Supabase
const getToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      console.warn('Token de autenticação não encontrado');
      return '';
    }
    
    return token;
  } catch (error) {
    console.error('Erro ao obter token de autenticação:', error);
    return '';
  }
};

// Função para verificar se está em produção
const isProduction = () => window.location.hostname !== 'localhost';

// Função para normalizar URLs de imagens
const normalizeImageUrl = (url) => {
  if (!url) return '';
  
  // Remover referências a [null]
  let cleanUrl = url.replace(/\[null\]/g, '');
  
  // Extrair o nome do arquivo da URL (última parte após a última /)
  const fileName = cleanUrl.split('/').pop();
  
  // Se o nome do arquivo é vazio ou indefinido, retornar string vazia
  if (!fileName) return '';
  
  // Construir a URL correta com o nome do arquivo
  return `https://songmetrix.com.br/uploads/logos/${fileName}`;
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
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/streams`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar streams');
      }
      
      const data = await response.json();
      
      // Garantir que todas as URLs de imagens estejam corretas
      return data.map(stream => ({
        ...stream,
        logo_url: stream.logo_url_full || (stream.logo_url ? `${PROD_URL}/uploads/logos/${stream.logo_url}` : '')
      }));
    } catch (error) {
      console.error('Erro ao buscar streams:', error);
      throw error;
    }
  },
  
  create: async (streamData) => {
    try {
      if (!isProduction()) {
        throw new Error('Criação de streams só é permitida em ambiente de produção');
      }

      const token = await getToken();
      const response = await fetch(`${API_URL}/api/streams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(streamData)
      });
      
      if (!response.ok) {
        throw new Error('Erro ao criar stream');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao criar stream:', error);
      throw error;
    }
  },
  
  update: async (id, streamData) => {
    try {
      if (!isProduction()) {
        throw new Error('Atualização de streams só é permitida em ambiente de produção');
      }

      const token = await getToken();
      const response = await fetch(`${API_URL}/api/streams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(streamData)
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar stream');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar stream:', error);
      throw error;
    }
  },
  
  delete: async (id) => {
    try {
      if (!isProduction()) {
        throw new Error('Exclusão de streams só é permitida em ambiente de produção');
      }

      const token = await getToken();
      const response = await fetch(`${API_URL}/api/streams/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao excluir stream');
      }
      
      return true;
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
          'Authorization': `Bearer ${await getToken()}`
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
          'Authorization': `Bearer ${await getToken()}`
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
          'Authorization': `Bearer ${await getToken()}`
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
      if (!isProduction()) {
        throw new Error('Upload de imagens só é permitido em ambiente de produção');
      }

      const uploadUrl = `${PROD_URL}/api/uploads/logo`;
      
      console.log('Enviando upload para:', uploadUrl);
      
      let token = await getToken();
      if (!token) {
        token = localStorage.getItem('token');
        console.log('Usando token do localStorage como fallback');
      }
      
      if (!token) {
        throw new Error('Token de autenticação não disponível para upload');
      }

      // Verificar se o FormData contém os campos necessários
      let hasLogo = false;
      let hasRadioName = false;
      let radioName = '';
      let fileName = '';
      
      // Verificar campos sem consumir o FormData
      for (let [key, value] of formData.entries()) {
        console.log(`FormData campo: ${key}, valor: ${value instanceof File ? value.name : value}`);
        if (key === 'logo') {
          hasLogo = true;
          if (value instanceof File) {
            fileName = value.name;
          }
        }
        if (key === 'radioName') {
          hasRadioName = true;
          radioName = value;
        }
      }
      
      if (!hasLogo || !hasRadioName) {
        throw new Error('Arquivo e nome são obrigatórios para o upload');
      }
      
      console.log('Dados do upload: FormData válido com logo e radioName');
      console.log('Nome do arquivo original:', fileName);
      console.log('Nome da rádio:', radioName);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        mode: 'cors',
        credentials: 'include'
      });

      let responseText;
      try {
        responseText = await response.text();
        console.log('Resposta bruta do servidor:', responseText);
      } catch (e) {
        console.error('Erro ao ler resposta do servidor:', e);
        throw new Error('Erro ao ler resposta do servidor');
      }

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Erro ao parsear resposta do servidor:', e);
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        console.error('Erro do servidor:', data);
        throw new Error(data.message || data.error || 'Erro ao fazer upload da imagem');
      }

      // Garantir que a URL retornada seja completa
      if (data.success && data.url) {
        // Corrigir URLs duplicadas
        const fixDuplicatedUrl = (url) => {
          if (url.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/')) {
            return url.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
          }
          return url;
        };
        
        // Extrair o nome do arquivo da URL original retornada pelo servidor
        const originalFileName = data.fileName || data.url.split('/').pop();
        console.log('Nome do arquivo retornado pelo servidor:', originalFileName);
        
        // Usar o nome do arquivo retornado pelo servidor (UUID)
        const serverUrl = `https://songmetrix.com.br/uploads/logos/${originalFileName}`;
        console.log('URL do servidor normalizada:', serverUrl);
        
        // Verificar se a imagem está acessível com o nome do servidor
        try {
          console.log('Verificando se a imagem está acessível com UUID:', serverUrl);
          const checkResponse = await fetch(serverUrl, { method: 'HEAD' });
          if (checkResponse.ok) {
            console.log('Imagem acessível com UUID do servidor');
            data.url = serverUrl;
            return data;
          }
        } catch (error) {
          console.warn('Erro ao verificar imagem com UUID:', error);
        }
        
        // Se não conseguir acessar com o UUID, tentar com o nome baseado na rádio
        // Criar um nome de arquivo seguro baseado no nome da rádio
        const safeFileName = radioName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '-');
        
        // Extrair a extensão do arquivo original
        const fileExtension = originalFileName.split('.').pop();
        
        // Nome final do arquivo
        const finalFileName = `${safeFileName}.${fileExtension}`;
        console.log('Nome final do arquivo:', finalFileName);
        
        // Construir a URL com o nome da rádio
        const radioNameUrl = `https://songmetrix.com.br/uploads/logos/${finalFileName}`;
        console.log('Verificando se a imagem está acessível com nome da rádio:', radioNameUrl);
        
        try {
          const checkRadioNameResponse = await fetch(radioNameUrl, { method: 'HEAD' });
          if (checkRadioNameResponse.ok) {
            console.log('Imagem acessível com nome da rádio');
            data.url = radioNameUrl;
            return data;
          }
        } catch (error) {
          console.warn('Erro ao verificar imagem com nome da rádio:', error);
        }
        
        // Se nenhuma das URLs funcionar, usar a URL original do servidor
        console.warn('Nenhuma URL verificada está acessível, usando URL original do servidor');
        // Garantir que a URL use HTTPS e o domínio correto
        let originalUrl = data.url;
        if (originalUrl.includes('localhost')) {
          originalUrl = originalUrl.replace(/http:\/\/localhost:\d+\/uploads\/logos\//, 'https://songmetrix.com.br/uploads/logos/');
        }
        if (originalUrl.startsWith('http://')) {
          originalUrl = originalUrl.replace('http://', 'https://');
        }
        
        // Corrigir URLs duplicadas
        data.url = fixDuplicatedUrl(originalUrl);
      }

      console.log('Resposta final após upload:', data);
      return data;
    } catch (error) {
      console.error('Erro no upload:', error);
      throw error;
    }
  }
};

// Serviço de relatórios
const reports = {
  getRadios: async () => {
    try {
      const response = await fetch(`${API_URL}/api/radios/status`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar rádios');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar rádios:', error);
      throw error;
    }
  },
  
  getRadioAbbreviations: async () => {
    try {
      const response = await fetch(`${API_URL}/api/radio-abbreviations`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar abreviações de rádios');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar abreviações de rádios:', error);
      throw error;
    }
  },
  
  getCities: async () => {
    try {
      const response = await fetch(`${API_URL}/api/cities`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar cidades');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar cidades:', error);
      throw error;
    }
  },
  
  getStates: async () => {
    try {
      const response = await fetch(`${API_URL}/api/states`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar estados');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar estados:', error);
      throw error;
    }
  },
  
  validateLocation: async (city, state) => {
    try {
      const response = await fetch(`${API_URL}/api/validate-location?city=${city}&state=${state}`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao validar localização');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao validar localização:', error);
      throw error;
    }
  },
  
  getRadiosByLocation: async (city, state) => {
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    
    try {
      const response = await fetch(`${API_URL}/api/radios/by-location?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar rádios por localização');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar rádios por localização:', error);
      throw error;
    }
  },
  
  generateReport: async (params) => {
    try {
      console.log('Iniciando geração de relatório com parâmetros:', params);
      
      // Construir query params
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value);
          }
        }
      });
      
      const url = `${API_URL}/api/report?${queryParams}`;
      console.log('URL da requisição:', url);
      
      const token = await getToken();
      console.log('Token obtido:', token ? 'Token válido' : 'Token inválido ou ausente');
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Status da resposta:', response.status, response.statusText);
      
      if (!response.ok) {
        // Verificar o tipo de conteúdo da resposta
        const contentType = response.headers.get('content-type');
        console.log('Tipo de conteúdo da resposta de erro:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          console.error('Dados de erro JSON:', errorData);
          throw new Error(errorData.message || `Erro ao gerar relatório: ${response.status}`);
        } else {
          // Se não for JSON, tentar ler o texto da resposta
          const errorText = await response.text();
          console.error('Texto de erro da resposta:', errorText);
          throw new Error(`Erro ao gerar relatório: ${response.status} ${response.statusText}`);
        }
      }
      
      // Verificar o tipo de conteúdo da resposta bem-sucedida
      const contentType = response.headers.get('content-type');
      console.log('Tipo de conteúdo da resposta bem-sucedida:', contentType);
      
      let data;
      if (contentType && contentType.includes('application/json')) {
        const jsonData = await response.json();
        console.log('Dados brutos recebidos da API:', jsonData);
        
        // Extrair lista de rádios do parâmetro
        const radioParam = params.radios;
        const radiosList = radioParam ? radioParam.split('||') : [];
        console.log('Lista de rádios extraída do parâmetro:', radiosList);
        
        // Verificar se os dados estão no formato esperado
        if (Array.isArray(jsonData)) {
          data = jsonData;
        } else if (jsonData && typeof jsonData === 'object') {
          if (jsonData.data && Array.isArray(jsonData.data)) {
            data = jsonData.data;
          } else if (jsonData.results && Array.isArray(jsonData.results)) {
            data = jsonData.results;
          } else if (jsonData.songs && Array.isArray(jsonData.songs)) {
            data = jsonData.songs;
          } else if (jsonData.tracks && typeof jsonData.tracks === 'object') {
            // Extrai dados do formato {tracks: {id: {title, artist, executions}}}
            data = Object.entries(jsonData.tracks).map(([id, track]) => ({
              id,
              title: track.title || 'Título desconhecido',
              artist: track.artist || 'Artista desconhecido',
              executions: track.executions || {},
              total: track.total || Object.values(track.executions || {}).reduce((sum, count) => sum + Number(count || 0), 0) || 0
            }));
          } else if (jsonData.chart && Array.isArray(jsonData.chart)) {
            data = jsonData.chart.map(item => ({
              title: item.title || 'Título desconhecido',
              artist: item.artist || 'Artista desconhecido',
              executions: item.executions || {},
              total: item.total || Object.values(item.executions || {}).reduce((sum, count) => sum + Number(count || 0), 0) || 0
            }));
          } else if (jsonData.radios && typeof jsonData.radios === 'object') {
            // Formato especial para relatórios por cidade/estado: {radios: {radioName: {tracks: {id: count}}}}
            console.log('Detectado formato de relatório por cidade/estado');
            
            // Primeiro, extrair todas as músicas únicas de todas as rádios
            const allTracks = new Map(); // Map de id -> {title, artist}
            
            // Para cada rádio, obter suas músicas e contagens
            Object.entries(jsonData.radios).forEach(([radioName, radioData]) => {
              if (radioData.tracks) {
                Object.entries(radioData.tracks).forEach(([trackId, trackData]) => {
                  // Se for um objeto com title e artist, use-os
                  if (trackData && typeof trackData === 'object' && trackData.title && trackData.artist) {
                    if (!allTracks.has(trackId)) {
                      allTracks.set(trackId, {
                        title: trackData.title,
                        artist: trackData.artist,
                        executions: {},
                        total: 0
                      });
                    }
                    
                    // Verificar se há contagem direta ou se precisa calcular
                    const count = typeof trackData.count === 'number' ? trackData.count : 
                      (typeof trackData === 'number' ? trackData : 1);
                    
                    // Adicionar execuções para esta rádio
                    const track = allTracks.get(trackId);
                    track.executions[radioName] = count;
                    track.total += count;
                  }
                });
              }
            });
            
            // Converter o Map para array
            data = Array.from(allTracks.values());
            console.log(`Processadas ${data.length} músicas únicas de ${Object.keys(jsonData.radios).length} rádios`);
          } else {
            // Se não encontrar um formato conhecido, tentar extrair do objeto
            console.warn('Formato de dados desconhecido, tentando adaptar:', jsonData);
            data = [];
            
            // Se houver propriedades que parecem ser nomes de músicas
            if (Object.keys(jsonData).length > 0 && !Object.keys(jsonData).includes('error')) {
              Object.entries(jsonData).forEach(([key, value]) => {
                // Verificar se o valor tem informações sobre a música
                if (value && typeof value === 'object') {
                  if (value.title || value.artist) {
                    data.push({
                      title: value.title || key,
                      artist: value.artist || 'Desconhecido',
                      executions: value.executions || {},
                      total: value.total || Object.values(value.executions || {}).reduce((sum, count) => sum + Number(count || 0), 0) || 0
                    });
                  }
                }
              });
            }
          }
        }
        
        // Processar os dados para garantir que tenham o formato correto
        data = (data || []).map(item => {
          // Garantir que executions seja um objeto
          if (!item.executions) {
            item.executions = {};
          }
          
          // Se houver rádios nos parâmetros, garantir que cada uma tenha uma entrada em executions
          if (radiosList.length > 0) {
            radiosList.forEach(radio => {
              if (item.executions[radio] === undefined) {
                item.executions[radio] = 0;
              }
            });
          }
          
          // Recalcular o total baseado nas execuções
          item.total = Object.values(item.executions).reduce((sum, count) => sum + Number(count || 0), 0);
          
          return item;
        });
        
        // Ordenar por total de execuções (decrescente)
        data.sort((a, b) => (b.total || 0) - (a.total || 0));
        
        console.log(`Dados processados: ${data.length} músicas com execuções detalhadas`);
        return data;
      } else {
        // Se não for JSON, tentar ler o texto da resposta
        const text = await response.text();
        console.error('Resposta não é JSON:', text);
        throw new Error('Resposta da API não está no formato JSON esperado');
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }
};

const apiServices = {
  auth,
  streams,
  dashboard,
  executions,
  uploads,
  reports
};

export default apiServices;