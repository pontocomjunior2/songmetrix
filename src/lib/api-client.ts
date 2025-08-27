import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { env } from '../config/env';
import { supabase } from './supabase-client';

// Determinar a estratégia de URL baseada no ambiente
// Em desenvolvimento: usar proxy do Vite (caminho relativo)
// Em produção: usar URL absoluta conforme configurado
const isDevelopment = !import.meta.env.PROD;
const API_BASE_URL = isDevelopment ? '/api' : (env.VITE_API_BASE_URL || 'https://api.songmetrix.com.br');

class ApiClient {
    private async getAuthHeaders() {
        try {
            // Usar ensureValidToken para garantir que o token seja válido
            const { ensureValidToken } = await import('./auth');
            const token = await ensureValidToken();
            
            return {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
        } catch (error) {
            console.error('Erro ao obter token de autenticação:', error);
            
            // Fallback: tentar obter sessão diretamente
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                
                return {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json',
                };
            } catch (fallbackError) {
                console.error('Erro no fallback de autenticação:', fallbackError);
                return {
                    'Content-Type': 'application/json',
                };
            }
        }
    }

    async get<T>(endpoint: string, params: Record<string, any> = {}, force: boolean = false): Promise<T | null> {
        try {
            const headers = await this.getAuthHeaders();
            
            // Processar os parâmetros para o formato correto para a API
            const cleanParams: Record<string, any> = {};
            
            Object.entries(params).forEach(([key, value]) => {
                // Ignorar valores vazios, null ou undefined
                if (value === undefined || value === null || value === '') {
                    return;
                }
                
                // Se for um array, o Axios vai processar cada elemento como um parâmetro separado
                // com o mesmo nome, o que é o comportamento que queremos para rádios múltiplas
                cleanParams[key] = value;
            });
            

            
            // Incluir um parâmetro de timestamp quando force=true para evitar cache do navegador
            const requestParams = force 
                ? { ...cleanParams, _t: Date.now() }
                : cleanParams;
            
            const response = await axios.get<T>(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`, {
                headers,
                params: requestParams,
                validateStatus: (status) => status < 500,
                timeout: 10000,
                paramsSerializer: {
                    indexes: null
                }
            });
            
            if (response.status >= 400) {
                console.error(`Erro ${response.status} na requisição para ${endpoint}`);
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }
            
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ECONNABORTED') {
                console.error(`Erro de conexão na requisição GET para ${endpoint}. Servidor indisponível.`);
            } else {
                console.error(`Erro na requisição GET para ${endpoint}:`, error);
            }
            throw error;
        }
    }

    async post<T>(endpoint: string, data: any = {}, config: AxiosRequestConfig = {}): Promise<T | null> {
        try {
            const headers = await this.getAuthHeaders();
            
            console.log(`Fazendo requisição POST para ${endpoint} com dados:`, data);
            
            const response = await axios.post<T>(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`, data, {
                ...config,
                headers: {
                    ...headers,
                    ...(config.headers || {}),
                },
                validateStatus: (status) => status < 500,
                timeout: 10000
            });
            
            if (response.status >= 400) {
                console.error(`Erro ${response.status} na requisição para ${endpoint}`);
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }
            
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ECONNABORTED') {
                console.error(`Erro de conexão na requisição POST para ${endpoint}. Servidor indisponível.`);
            } else {
                console.error(`Erro na requisição POST para ${endpoint}:`, error);
            }
            throw error;
        }
    }

    async getDashboardData(
        radios: string[], 
        limits: {songs?: number; artists?: number; genres?: number;} = {},
        force: boolean = false
    ) {
        try {
            // Para endpoints que esperam múltiplas rádios, devemos enviar cada uma como um parâmetro separado
            // usando o mesmo nome de parâmetro repetido
            const params: Record<string, any> = {};
            
            // Adicionar parâmetros de limite
            params.songs_limit = limits.songs || 5;
            params.artists_limit = limits.artists || 5;
            params.genres_limit = limits.genres || 5;
            
            // Verificar se temos rádios para buscar
            if (!Array.isArray(radios) || radios.length === 0) {
                console.error('Nenhuma rádio especificada para buscar dados do dashboard');
                return null;
            }
            
            // Filtrar valores vazios
            const validRadios = (typeof radios === 'string') 
                ? [radios] 
                : radios.filter(r => r);
                
            if (validRadios.length === 0) {
                console.error('Nenhuma rádio válida para buscar dados do dashboard');
                return null;
            }
            

            
            // O backend espera que as rádios sejam enviadas como parâmetros repetidos
            // Ex: radio=A&radio=B&radio=C ao invés de radio=A,B,C
            validRadios.forEach(radio => {
                // Usar array para params permite que múltiplos valores sejam enviados com o mesmo nome
                if (!params.radio) {
                    params.radio = [];
                }
                params.radio.push(radio);
            });
            
            return this.get('/dashboard', params, force);
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            throw error;
        }
    }

    async getRadiosStatus(force: boolean = false) {
        try {
            return this.get('/radios/status', {}, force);
        } catch (error) {
            console.error('Erro ao buscar status das rádios:', error);
            throw error;
        }
    }

    async getRealTimeData(radio: string, limit: number = 10, force: boolean = false) {
        if (!radio) {
            console.error('Rádio não especificada para dados em tempo real');
            return null;
        }
        
        const params: Record<string, any> = {
            limit
        };
        
        // Adicionar a rádio como parâmetro
        params.radio = radio;
        
        return this.get('/radio/songs/realtime', params, force);
    }

    async getRadios(force: boolean = false) {
        try {
            return this.get('/radios', {}, force);
        } catch (error) {
            console.error('Erro ao buscar lista de rádios:', error);
            throw error;
        }
    }

    async getRanking(params: {
        radios?: string[];
        period?: string;
        limit?: number;
    } = {}, force: boolean = false) {
        try {
            // Preparar os parâmetros no formato esperado pela API
            const requestParams: Record<string, any> = {
                period: params.period || 'day',
                limit: params.limit || 10
            };
            
            // Processar rádios da mesma forma que fazemos para o dashboard
            if (params.radios && params.radios.length > 0) {
                // Filtrar valores vazios
                const validRadios = Array.isArray(params.radios) 
                    ? params.radios.filter(r => r)
                    : [params.radios as unknown as string];
                    
                if (validRadios.length > 0) {
                    // Criar um array de rádios para o parâmetro
                    requestParams.radio = [];
                    validRadios.forEach(radio => {
                        requestParams.radio.push(radio);
                    });
                }
            }
            
            return this.get('/ranking', requestParams, force);
        } catch (error) {
            console.error('Erro ao buscar dados de ranking:', error);
            throw error;
        }
    }

    async getExecutions(filters: {
        radio?: string;
        artist?: string;
        song?: string;
        startDate?: string;
        endDate?: string;
        startTime?: string;
        endTime?: string;
    } = {}, page: number = 0, force: boolean = false) {
        try {
            const requestParams: Record<string, any> = {
                page,
                limit: 50 // Número padrão de resultados por página
            };
            
            // Adicionar filtros se fornecidos
            if (filters.radio) requestParams.radio = filters.radio;
            if (filters.artist) requestParams.artist = filters.artist;
            if (filters.song) requestParams.song = filters.song;
            if (filters.startDate) requestParams.start_date = filters.startDate;
            if (filters.endDate) requestParams.end_date = filters.endDate;
            if (filters.startTime) requestParams.start_time = filters.startTime;
            if (filters.endTime) requestParams.end_time = filters.endTime;
            

            
            // Endpoint corrigido para evitar duplo prefixo '/api'
            return this.get('/executions', requestParams, force);
        } catch (error) {
            console.error('Erro ao buscar execuções:', error);
            throw error;
        }
    }
}

export const apiClient = new ApiClient(); 