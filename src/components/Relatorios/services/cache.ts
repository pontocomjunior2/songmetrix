/**
 * Sistema de cache para armazenar os resultados das consultas de API
 * e reduzir o número de chamadas necessárias
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number; // tempo de expiração em milissegundos
}

class ApiCache {
  private cache: Map<string, CacheItem<any>>;
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas por padrão
  
  // Cache específico para diferentes tipos de dados
  private readonly TOKEN_EXPIRY = 50 * 60 * 1000; // 50 minutos para tokens
  private readonly TRACK_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 dias para dados de faixas
  private readonly QUERY_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas para resultados de consultas
  
  // Para prefetch e prewarming do cache
  private prefetchQueue: string[] = [];
  private isPrefetching = false;

  constructor() {
    this.cache = new Map();
    
    // Carregar cache do localStorage, se disponível
    this.loadFromStorage();
    
    // Configurar salvamento automático
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
    });
    
    // Também salvar a cada 2 minutos para evitar perda de dados
    setInterval(() => this.saveToStorage(), 2 * 60 * 1000);
    
    // Limpeza periódica de itens expirados (a cada 5 minutos)
    setInterval(() => this.cleanExpired(), 5 * 60 * 1000);
  }

  /**
   * Obtém um item do cache
   * @param key Chave do item
   * @returns O item armazenado ou undefined se não existir ou estiver expirado
   */
  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    
    if (!item) {
      return undefined;
    }
    
    // Verificar se o item expirou
    if (Date.now() > item.timestamp + item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    // A cada acesso bem-sucedido, estendemos a expiração em 25% do tempo original
    // para itens frequentemente acessados (exceto tokens)
    if (!key.includes('token')) {
      this.extendExpiry(key, item.expiry * 0.25);
    }
    
    return item.data as T;
  }

  /**
   * Armazena um item no cache
   * @param key Chave do item
   * @param data Dados a serem armazenados
   * @param expiry Tempo de expiração em milissegundos (opcional)
   */
  set<T>(key: string, data: T, expiry: number = this.DEFAULT_EXPIRY): void {
    // Determina o tempo de expiração apropriado com base no tipo de dado
    let actualExpiry = expiry;
    
    if (key.includes('token')) {
      actualExpiry = this.TOKEN_EXPIRY;
    } else if (key.includes('track_') || key.includes('video_')) {
      actualExpiry = this.TRACK_EXPIRY;
    } else if (key.includes('plays_') || key.includes('views_')) {
      actualExpiry = this.QUERY_EXPIRY;
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: actualExpiry
    });
    
    // Se o cache ficar muito grande, podemos fazer uma limpeza imediata
    if (this.cache.size > 1000) {
      this.cleanLeastUsed();
    }
  }

  /**
   * Estende o tempo de expiração de um item
   */
  private extendExpiry(key: string, additionalTime: number): void {
    const item = this.cache.get(key);
    if (item) {
      const newItem = {
        ...item,
        expiry: item.expiry + additionalTime
      };
      this.cache.set(key, newItem);
    }
  }

  /**
   * Remove um item do cache
   * @param key Chave do item a ser removido
   */
  remove(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpa todos os itens do cache
   */
  clear(): void {
    this.cache.clear();
    localStorage.removeItem('api_cache');
    console.log('Cache limpo completamente');
  }

  /**
   * Remove todos os itens expirados do cache
   */
  cleanExpired(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.expiry) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Limpeza do cache: ${removedCount} itens expirados removidos`);
    }
  }
  
  /**
   * Remove os itens menos utilizados quando o cache fica muito grande
   */
  private cleanLeastUsed(): void {
    // Podemos eliminar até 20% dos itens mais antigos
    const itemsToKeep = Math.ceil(this.cache.size * 0.8);
    
    // Ordenar por timestamp (mais antigos primeiro)
    const sortedItems = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
    // Remover os mais antigos
    for (let i = 0; i < sortedItems.length - itemsToKeep; i++) {
      this.cache.delete(sortedItems[i][0]);
    }
    
    console.log(`Limpeza do cache: ${sortedItems.length - itemsToKeep} itens antigos removidos`);
  }

  /**
   * Adiciona uma chave à fila de prefetch
   */
  addToPrefetch(key: string): void {
    if (!this.prefetchQueue.includes(key)) {
      this.prefetchQueue.push(key);
    }
    
    // Iniciar o prefetch se ainda não estiver acontecendo
    if (!this.isPrefetching) {
      this.startPrefetch();
    }
  }
  
  /**
   * Inicia o processamento da fila de prefetch
   */
  private async startPrefetch() {
    if (this.prefetchQueue.length === 0 || this.isPrefetching) {
      return;
    }
    
    this.isPrefetching = true;
    
    // Processar o próximo item na fila
    try {
      const key = this.prefetchQueue.shift();
      
      // Aqui você implementaria a lógica para pré-carregar dados
      // Por exemplo, se o key for 'spotify_track_*', buscar antecipadamente dados relacionados
      
      console.log(`Prefetch iniciado para: ${key}`);
      
      // Simular um tempo de processamento
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Erro durante prefetch:', error);
    } finally {
      this.isPrefetching = false;
      
      // Continuar com o próximo item, se houver
      if (this.prefetchQueue.length > 0) {
        this.startPrefetch();
      }
    }
  }

  /**
   * Salva o cache atual no localStorage
   */
  private saveToStorage(): void {
    try {
      // Verificar se o cache mudou desde a última vez que foi salvo
      const currentCacheSize = this.cache.size;
      const lastSavedSize = parseInt(localStorage.getItem('api_cache_size') || '0', 10);
      
      // Só salvar se o tamanho do cache mudou
      if (currentCacheSize !== lastSavedSize) {
        const cacheData: Record<string, CacheItem<any>> = {};
        
        // Converter o Map para um objeto simples
        for (const [key, value] of this.cache.entries()) {
          cacheData[key] = value;
        }
        
        localStorage.setItem('api_cache', JSON.stringify(cacheData));
        localStorage.setItem('api_cache_size', currentCacheSize.toString());
        localStorage.setItem('api_cache_last_save', Date.now().toString());
        
        console.log(`Cache salvo: ${currentCacheSize} itens`);
      }
    } catch (error) {
      console.warn('Erro ao salvar cache no localStorage:', error);
      
      // Se o erro for de quota excedida, limpar parte do cache
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('Quota do localStorage excedida, limpando itens antigos');
        this.cleanLeastUsed();
        // Tentar salvar novamente
        setTimeout(() => this.saveToStorage(), 100);
      }
    }
  }

  /**
   * Carrega o cache do localStorage
   */
  private loadFromStorage(): void {
    try {
      const cacheData = localStorage.getItem('api_cache');
      
      if (cacheData) {
        const parsedData = JSON.parse(cacheData) as Record<string, CacheItem<any>>;
        
        // Converter o objeto simples de volta para um Map
        for (const [key, value] of Object.entries(parsedData)) {
          this.cache.set(key, value);
        }
        
        // Limpar itens expirados após o carregamento
        this.cleanExpired();
        
        console.log(`Cache carregado: ${this.cache.size} itens`);
      }
    } catch (error) {
      console.warn('Erro ao carregar cache do localStorage:', error);
      
      // Se houver erro ao carregar, limpar o cache armazenado
      localStorage.removeItem('api_cache');
      localStorage.removeItem('api_cache_size');
    }
  }
}

// Exportar uma instância única do cache
export const apiCache = new ApiCache(); 