// Utility functions for handling radio streams safely
import { useState, useCallback } from 'react';

/**
 * Sanitiza uma URL de stream para garantir que seja HTTP/HTTPS
 * Remove protocolos inválidos como stm://
 */
export const sanitizeStreamUrl = (url: string): string => {
  if (!url) return '';

  // Remove protocolo stm:// se existir
  if (url.startsWith('stm://')) {
    // Extrair apenas a parte do host e caminho
    const stmUrl = url.replace('stm://', '');
    // Converter para HTTP
    return `http://${stmUrl}`;
  }

  // Garantir que seja HTTP ou HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `http://${url}`;
  }

  return url;
};

/**
 * Verifica se uma URL de stream está acessível
 */
export const checkStreamAvailability = async (url: string): Promise<boolean> => {
  if (!url) return false;

  try {
    const sanitizedUrl = sanitizeStreamUrl(url);
    const response = await fetch(sanitizedUrl, {
      method: 'HEAD',
      mode: 'no-cors', // Evita problemas de CORS
      signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
    });
    return true; // Se não lançou erro, considera disponível
  } catch (error) {
    console.warn(`Stream ${url} não está acessível:`, error);
    return false;
  }
};

/**
 * Processa uma lista de streams, sanitizando URLs e verificando disponibilidade
 */
export const processStreams = async (streams: any[]): Promise<any[]> => {
  const processedStreams = await Promise.all(
    streams.map(async (stream) => {
      const sanitizedUrl = sanitizeStreamUrl(stream.url);
      const isAvailable = await checkStreamAvailability(sanitizedUrl);

      return {
        ...stream,
        url: sanitizedUrl,
        available: isAvailable
      };
    })
  );

  return processedStreams;
};

/**
 * Hook personalizado para gerenciar streams de rádio
 */
export const useStreamManager = () => {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStreams = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/radio-streams');
      if (!response.ok) {
        throw new Error('Erro ao carregar streams');
      }

      const rawStreams = await response.json();
      const processedStreams = await processStreams(rawStreams);
      setStreams(processedStreams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao carregar streams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const playStream = useCallback((stream: any) => {
    if (!stream.available) {
      console.warn(`Stream ${stream.name} não está disponível`);
      return;
    }

    try {
      // Aqui você pode integrar com um player de áudio
      // Por exemplo: audioPlayer.play(stream.url);
      console.log(`Reproduzindo stream: ${stream.name} - ${stream.url}`);
    } catch (err) {
      console.error('Erro ao reproduzir stream:', err);
    }
  }, []);

  return {
    streams,
    loading,
    error,
    loadStreams,
    playStream
  };
};