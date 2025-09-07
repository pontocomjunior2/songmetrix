// Definir a URL base da API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PROD_URL = 'https://songmetrix.com.br';

import { supabase } from '../lib/supabase-client';

// Função para obter o token de autenticação - usando Supabase
const getAuthenticatedUserToken = async () => {
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

// Função para fazer retry automático em caso de erro de rede
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentativa ${attempt}/${maxRetries} para: ${url}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // Se a resposta for bem-sucedida, retorna
      if (response.ok) {
        return response;
      }

      // Se for erro de cliente (4xx), não tenta novamente
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Para erros de servidor (5xx) ou rede, tenta novamente
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      console.warn(`Tentativa ${attempt} falhou: ${lastError.message}`);

    } catch (error) {
      lastError = error;
      console.warn(`Tentativa ${attempt} falhou com erro de rede:`, error.message);

      // Se for erro ERR_BLOCKED_BY_CLIENT, adiciona delay extra
      if (error.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.warn('Erro ERR_BLOCKED_BY_CLIENT detectado - possível bloqueio por extensão');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Delay exponencial entre tentativas
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Função para verificar se está em produção
const isProduction = () => {
  return window.location.hostname !== 'localhost';
};

// Função de diagnóstico para problemas de conectividade
const diagnoseNetworkIssues = async () => {
  const diagnostics = {
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    cookiesEnabled: navigator.cookieEnabled,
    https: window.location.protocol === 'https:',
    hostname: window.location.hostname,
    timestamp: new Date().toISOString(),
    issues: []
  };

  // Verificar conectividade básica
  try {
    const testResponse = await fetch(`${API_URL}/api/radios/status`, {
      method: 'HEAD',
      cache: 'no-cache'
    });
    diagnostics.apiReachable = testResponse.ok;
  } catch (error) {
    diagnostics.apiReachable = false;
    diagnostics.issues.push(`API não acessível: ${error.message}`);
  }

  // Verificar se há extensões que podem bloquear
  const extensions = [];
  if (window.chrome && window.chrome.runtime) {
    try {
      // Tentar detectar ad blockers comuns
      const adBlockTest = await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
        method: 'HEAD',
        mode: 'no-cors'
      }).catch(() => ({ ok: false }));

      if (!adBlockTest.ok) {
        extensions.push('Possível ad blocker detectado');
      }
    } catch (e) {
      // Ignorar erros de detecção
    }
  }

  if (extensions.length > 0) {
    diagnostics.issues.push(...extensions);
  }

  // Verificar se há service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        diagnostics.serviceWorkers = registrations.length;
        diagnostics.issues.push(`${registrations.length} service worker(s) ativo(s)`);
      }
    } catch (error) {
      diagnostics.serviceWorkers = 'Erro ao verificar';
    }
  }

  console.log('Diagnóstico de rede:', diagnostics);
  return diagnostics;
};

// Função para normalizar URLs de imagens
const normalizeImageUrl = (url, radioName = '') => {
  if (!url) return '';
  
  // Remover referências a [null]
  let cleanUrl = url.replace(/\[null\]/g, '');
  
  // Verificar se a URL contém localhost (independente do ambiente)
  if (cleanUrl.includes('localhost')) {
    console.log('URL do servidor com localhost:', cleanUrl);
    
    // Extrair o nome do arquivo da URL
    const fileName = cleanUrl.split('/').pop() || '';
    
    // Se temos um nome de rádio, normalizar o nome do arquivo
    if (radioName) {
      const fileExtension = fileName.split('.').pop() || 'png';
      
      // Normalizar nome da rádio para formato de arquivo
      const normalizedRadioName = radioName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s-]/g, '') // Remover caracteres especiais
        .replace(/\s+/g, '_') // Substituir espaços por underscores
        .toLowerCase(); // Converter para minúsculas
      
      // Construir URL com nome normalizado
      cleanUrl = `https://songmetrix.com.br/uploads/logos/${normalizedRadioName}.${fileExtension}`;
    } else {
      // Sem nome de rádio, apenas substituir o domínio
      cleanUrl = `https://songmetrix.com.br/uploads/logos/${fileName}`;
    }
    
    console.log('URL normalizada para produção:', cleanUrl);
    return cleanUrl;
  }
  
  // Garantir que a URL não está duplicada
  if (cleanUrl.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/')) {
    cleanUrl = cleanUrl.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
  }
  
  // Garantir que usamos HTTPS
  cleanUrl = cleanUrl.replace('http://', 'https://');
  
  // Verificar se tem o prefixo correto
  if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/')) {
    cleanUrl = `https://songmetrix.com.br/uploads/logos/${cleanUrl}`;
  }
  
  return cleanUrl;
};

// Função para garantir que o diretório de uploads exista
export async function ensureUploadsDirectory() {
  const hostname = window.location.hostname;
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDevelopment) {
    console.log('Ambiente de desenvolvimento: simulando verificação de diretório de uploads');
    return true; // Em desenvolvimento, apenas simula o sucesso
  }
  
  // Em produção, não precisamos verificar o diretório - o servidor já garante isso
  // Evitamos a chamada que está resultando em 404
  console.log('Ambiente de produção: assumindo que o diretório de uploads existe');
  return true;
}

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
      const token = await getAuthenticatedUserToken();
      const response = await fetchWithRetry(`${API_URL}/api/streams`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar streams: ${response.status} ${response.statusText} - ${errorText}`);
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

      const token = await getAuthenticatedUserToken();
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
      console.log('Função update chamada com ID:', id);
      console.log('Dados recebidos para atualização:', streamData);
      
      if (!id) {
        console.error('ID não fornecido para atualização!');
        throw new Error('ID é obrigatório para atualizar stream');
      }
      
      if (!isProduction()) {
        throw new Error('Atualização de streams só é permitida em ambiente de produção');
      }

      const token = await getAuthenticatedUserToken();
      
      // Certificar que o ID não seja perdido no JSON
      const dataToSend = {
        ...streamData,
        id: id // Garantir que o ID está incluído para o backend
      };
      
      console.log('URL de atualização:', `${API_URL}/api/streams/${id}`);
      console.log('Dados formatados para envio:', dataToSend);
      
      const response = await fetchWithRetry(`${API_URL}/api/streams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSend)
      });
      
      console.log('Status da resposta de atualização:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resposta de erro:', errorText);
        
        let errorMessage = 'Erro ao atualizar stream';
        try {
          // Tentar extrair mensagem de erro JSON
          const errorData = JSON.parse(errorText);
          if (errorData.message || errorData.error) {
            errorMessage = errorData.message || errorData.error;
          }
        } catch (e) {
          // Se não for JSON válido, usar o texto completo
          errorMessage = `Erro ao atualizar stream: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const responseData = await response.json();
      console.log('Resposta de atualização bem-sucedida:', responseData);
      
      return responseData;
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

      const token = await getAuthenticatedUserToken();
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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

// Serviço de upload de arquivos
const uploads = {
  // Função para fazer upload de logo
  uploadLogo: async (formData) => {
    try {
      // Verificar ambiente atual
      const hostname = window.location.hostname;
      console.log('Hostname:', hostname);
      const isProd = hostname !== 'localhost';
      const env = isProd ? 'produção' : 'desenvolvimento';
      console.log('Ambiente detectado:', env);
      
      // Não precisamos mais verificar o diretório em produção
      // Isso estava causando erro 404
      
      // Logar campos do FormData para diagnóstico
      for (let [key, value] of formData.entries()) {
        console.log('FormData campo:', key, 'valor:', value.name || value);
      }
      
      // Verificar se temos um arquivo e um nome de rádio
      const file = formData.get('logo');
      const radioName = formData.get('radioName');
      
      if (!file || !(file instanceof File)) {
        throw new Error('Nenhum arquivo de logo enviado');
      }
      
      if (!radioName) {
        throw new Error('Nome da rádio não fornecido');
      }
      
      console.log('Arquivo de logo detectado:', file.name);
      console.log('Nome da rádio:', radioName);
      
      // Normalizar nome de arquivo com base no nome da rádio
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      // Sanitizar nome da rádio para usar como nome de arquivo
      const normalizedRadioName = radioName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s-]/g, '') // Remover caracteres especiais
        .replace(/\s+/g, '_') // Substituir espaços por underscores
        .toLowerCase(); // Converter para minúsculas
      
      const normalizedFileName = `${normalizedRadioName}.${fileExtension}`;
      console.log('Nome de arquivo normalizado:', normalizedFileName);
      
      // Em ambiente de desenvolvimento, simular upload
      if (!isProd) {
        // Criar um preview local para o usuário
        const filePreview = URL.createObjectURL(file);
        console.log('Preview local criado:', filePreview);
        
        // Simular upload em desenvolvimento
        console.log('Ambiente de desenvolvimento: simulando upload');
        return new Promise(resolve => {
          setTimeout(() => {
            const simulatedUrl = `https://songmetrix.com.br/uploads/logos/${normalizedFileName}`;
            console.log('Upload simulado bem-sucedido. URL simulada:', simulatedUrl);
            resolve({
              success: true,
              url: simulatedUrl,
              filePreview,
              fileName: normalizedFileName,
              message: 'Upload simulado com sucesso'
            });
          }, 500);
        });
      }
      
      // Em produção, fazer upload real
      console.log('Produção: fazendo upload real da imagem');
      const uploadUrl = `${PROD_URL}/api/uploads/logo`;
      console.log('Enviando upload para:', uploadUrl);
      
      // Obter token de autenticação
      let token = await getAuthenticatedUserToken();
      if (!token) {
        token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Usuário não autenticado');
        }
      }
      
      // Adicionar nome de arquivo normalizado ao FormData
      // Isso permite ao servidor usar esse nome em vez de UUID
      try {
        formData.append('normalizedFileName', normalizedFileName);
      } catch (e) {
        console.warn('Não foi possível adicionar normalizedFileName ao FormData:', e);
      }
      
      // Fazer o upload
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro no upload: ${response.status} - ${errorText}`);
        throw new Error(`Erro no upload: ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Resultado do upload (resposta do servidor):', result);
      
      let resultUrl = '';
      
      if (result.url) {
        // URL retornada pelo servidor - normalizar para garantir consistência
        resultUrl = normalizeImageUrl(result.url, radioName);
      } else {
        // Se o servidor não retornou uma URL, usar a URL normalizada
        resultUrl = `https://songmetrix.com.br/uploads/logos/${normalizedFileName}`;
        console.log('Servidor não retornou URL, usando URL normalizada:', resultUrl);
      }
      
      // Adicionar timestamp para evitar cache
      const finalUrl = resultUrl.includes('?') 
        ? resultUrl
        : `${resultUrl}?t=${Date.now()}`;
      
      console.log('URL final da imagem após normalização:', finalUrl);
      
      return {
        success: true,
        url: finalUrl,
        // Não incluímos filePreview em produção para evitar problemas de URL incorreta
        message: result.message || 'Upload realizado com sucesso'
      };
    } catch (error) {
      console.error('Erro durante upload de logo:', error);
      return {
        success: false,
        message: error.message || 'Erro ao fazer upload da imagem',
        error: error.toString()
      };
    }
  }
};

// Serviço de relatórios
const reports = {
  getRadios: async () => {
    try {
      const response = await fetch(`${API_URL}/api/radios/status`, {
        headers: {
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
          'Authorization': `Bearer ${await getAuthenticatedUserToken()}`
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
      
      const token = await getAuthenticatedUserToken();
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
  reports,
  diagnoseNetworkIssues
};

export default apiServices;