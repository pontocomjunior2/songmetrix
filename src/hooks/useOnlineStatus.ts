import { useState, useEffect } from 'react';

/**
 * Hook para monitorar o estado de conexão do usuário
 * @returns Um objeto com o estado de conexão e métodos para verificar a conexão
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!isOnline) {
        setWasOffline(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  /**
   * Verifica se o servidor está acessível
   * @returns true se o servidor estiver acessível, false caso contrário
   */
  const checkServerConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      return response.ok;
    } catch (error) {
      console.warn('Servidor não está acessível:', error);
      return false;
    }
  };

  /**
   * Reseta o estado de "estava offline"
   */
  const resetWasOffline = () => {
    setWasOffline(false);
  };

  return {
    isOnline,
    wasOffline,
    resetWasOffline,
    checkServerConnection,
  };
};

export default useOnlineStatus; 