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

// Função para verificar se está em produção
// Modificado para permitir uploads em desenvolvimento
const isProduction = () => {
  // Sempre permitir uploads, independente do ambiente
  // Isso resolve o problema de CORS durante o desenvolvimento
  console.log('Operações permitidas em qualquer ambiente para desenvolvimento');
  return true;
};

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

// Função para garantir que o diretório de uploads exista
export async function ensureUploadsDirectory() {
  const hostname = window.location.hostname;
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDevelopment) {
    console.log('Ambiente de desenvolvimento: simulando verificação de diretório de uploads');
    return true; // Em desenvolvimento, apenas simula o sucesso
  }
  
  try {
    const token = await getAuthenticatedUserToken();
    const response = await fetch(`${API_URL}/api/ensure-uploads-directory`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao verificar diretório: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Não foi possível verificar/criar o diretório de upload', error);
    return false;
  }
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
      
      const response = await fetch(`${API_URL}/api/streams/${id}`, {
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

const uploads = {
  uploadLogo: async (formData) => {
    try {
      // Verificar ambiente
      const isDev = window.location.hostname === 'localhost';
      console.log('Hostname:', window.location.hostname);
      console.log('Ambiente detectado:', isDev ? 'desenvolvimento' : 'produção');
      
      // Garantir que o diretório de uploads exista (no desenvolvimento)
      if (isDev) {
        await ensureUploadsDirectory();
      }
      
      // Extrair informações do formData para diagnóstico e simulação
      let fileName = '';
      let radioName = '';
      let fileExtension = '';
      let file = null;
      
      for (let [key, value] of formData.entries()) {
        console.log(`FormData campo: ${key}, valor: ${value instanceof File ? value.name : value}`);
        if (key === 'logo' && value instanceof File) {
          file = value;
          fileName = value.name;
          fileExtension = fileName.split('.').pop() || 'png';
        }
        if (key === 'radioName') {
          radioName = value;
        }
      }
      
      if (!file) {
        console.error('Arquivo de logo não encontrado no formulário');
        return { 
          success: false, 
          message: 'Arquivo de logo não encontrado no formulário' 
        };
      }
      
      if (!radioName) {
        console.error('Nome da rádio não fornecido');
        return { 
          success: false, 
          message: 'Nome da rádio é obrigatório para o upload' 
        };
      }
      
      console.log('Arquivo de logo detectado:', fileName);
      console.log('Nome da rádio:', radioName);
      
      // Criar um preview da imagem para exibição imediata
      const filePreview = URL.createObjectURL(file);
      console.log('Preview local criado:', filePreview);
      
      // Normalizar o nome da rádio para uso no nome do arquivo
      // Remover caracteres especiais, substituir espaços por underscores
      const normalizedRadioName = radioName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s-]/g, '') // Remover caracteres especiais
        .replace(/\s+/g, '_') // Substituir espaços por underscores
        .toLowerCase(); // Converter para minúsculas
      
      const newFileName = `${normalizedRadioName}.${fileExtension}`;
      console.log('Nome de arquivo normalizado:', newFileName);
      
      // Em ambiente de desenvolvimento, simular o upload sem fazer requisição real
      if (isDev) {
        console.log('Ambiente de desenvolvimento: simulando upload');
        
        // URL simulada que seria retornada pelo servidor
        const mockUrl = `https://songmetrix.com.br/uploads/logos/${newFileName}`;
        
        // Após um pequeno delay para simular o tempo de upload
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Retornar uma resposta simulada bem-sucedida
        console.log('Upload simulado bem-sucedido. URL simulada:', mockUrl);
        return {
          success: true,
          url: mockUrl,
          fileName: newFileName,
          filePreview, // Incluir o preview local para uso durante o desenvolvimento
          originalFile: file, // Incluir o arquivo original para possíveis usos
          _dev_note: 'Esta é uma resposta simulada para ambiente de desenvolvimento'
        };
      }
      
      // Adicionar o nome normalizado ao formData para uso no servidor
      // Criamos um novo FormData para não modificar o original
      const uploadFormData = new FormData();
      for (let [key, value] of formData.entries()) {
        uploadFormData.append(key, value);
      }
      uploadFormData.append('normalizedFileName', newFileName);
      
      // Em produção, continuar com o upload real
      const uploadUrl = `${API_URL}/api/uploads/logo`;
      console.log('Enviando upload para:', uploadUrl);
      
      let token = await getAuthenticatedUserToken();
      if (!token) {
        token = localStorage.getItem('token');
        console.log('Usando token do localStorage como fallback');
      }
      
      if (!token) {
        console.error('Token de autenticação não disponível para upload');
        throw new Error('Token de autenticação não disponível para upload');
      }
      
      console.log('Enviando requisição para:', uploadUrl);
      console.log('Token de autenticação disponível:', !!token);
      
      // Em produção, fazer o upload normalmente
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadFormData,
        credentials: 'include'
      });
      
      console.log('Status da resposta:', response.status);
      
      if (!response.ok) {
        // Tentar obter detalhes do erro da resposta
        try {
          const errorData = await response.json();
          console.error('Erro detalhado do servidor:', errorData);
          return { 
            success: false, 
            message: errorData.message || `Erro do servidor: ${response.status}` 
          };
        } catch (e) {
          // Se não conseguir parsear a resposta JSON, usar o status HTTP
          console.error('Erro ao parsear resposta de erro:', e);
          return { 
            success: false, 
            message: `Erro do servidor: ${response.status}` 
          };
        }
      }
      
      // Tentar processar a resposta como JSON
      try {
        const data = await response.json();
        console.log('Resposta do servidor:', data);
        
        if (data.success && data.url) {
          // Normalizar URL para garantir compatibilidade
          const normalizedUrl = data.url
            .replace(/http:\/\/localhost:\d+\/uploads\/logos\//, 'https://songmetrix.com.br/uploads/logos/')
            .replace(/^http:/, 'https:');
          
          // Remover duplicações de domínio usando regex
          let fixedUrl = normalizedUrl;
          // Padrão para detectar o prefixo duplicado
          const duplicatedPrefix = 'https://songmetrix.com.br/uploads/logos/';
          // Encontrar o último prefixo + o nome do arquivo
          const regex = new RegExp(`(${duplicatedPrefix})+(.+)$`);
          const match = normalizedUrl.match(regex);
          
          if (match) {
            // Manter apenas o último prefixo + nome do arquivo
            fixedUrl = duplicatedPrefix + match[2];
            console.log('URL múltiplas vezes duplicada corrigida:', fixedUrl);
          }
          
          // Mesmo que o servidor não use o nome normalizado, vamos garantir que temos um URL com ele
          const serverFileName = fixedUrl.split('/').pop() || '';
          const serverFileNameIsNormalized = serverFileName === newFileName;
          
          if (!serverFileNameIsNormalized) {
            console.log('Servidor não usou o nome normalizado. URL recebida:', fixedUrl);
            fixedUrl = `${duplicatedPrefix}${newFileName}`;
            console.log('URL ajustada para usar nome normalizado:', fixedUrl);
          }
          
          console.log('URL normalizada e corrigida:', fixedUrl);
          
          return {
            success: true,
            url: fixedUrl,
            fileName: newFileName,
            filePreview, // Adicionar o preview local mesmo em produção
            originalFile: file // Incluir o arquivo original para possíveis usos
          };
        } else {
          console.error('Resposta do servidor não contém URL da imagem:', data);
          return {
            success: false,
            message: data.message || 'Resposta do servidor não contém URL da imagem'
          };
        }
      } catch (error) {
        console.error('Erro ao processar resposta JSON:', error);
        return {
          success: false,
          message: 'Erro ao processar resposta do servidor'
        };
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      return {
        success: false,
        message: error.message || 'Ocorreu um erro durante o upload'
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