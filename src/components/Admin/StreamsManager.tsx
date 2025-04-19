import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import apiServices from '../../services/api';
import { toast } from 'react-toastify';
import { Radio, AlertCircle, Search, Plus, Edit, Trash2, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// Interface para os dados de stream
interface Stream {
  id?: number;
  url: string;
  name: string;
  sheet: string;
  cidade: string;
  estado: string;
  regiao: string;
  pais: string;
  segmento: string;
  formato: string;
  logo_url: string;
  site: string;
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  frequencia: string;
  index: string;
}

export default function StreamsManager() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [isDevEnvironment, setIsDevEnvironment] = useState(false);
  const [devModeMessage, setDevModeMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedStreams = useRef(false);
  const renderCount = useRef(0);
  const loadCount = useRef(0);

  // Estado inicial do formulário
  const initialFormState: Stream = {
    url: '',
    name: '',
    sheet: '',
    cidade: '',
    estado: '',
    regiao: '',
    pais: 'Brasil',
    segmento: '',
    formato: '',
    logo_url: '',
    site: '',
    instagram: '',
    facebook: '',
    twitter: '',
    youtube: '',
    frequencia: '',
    index: '0', // Valor padrão para o campo index
  };

  const [formData, setFormData] = useState<Stream>(initialFormState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [nextIndex, setNextIndex] = useState<number>(0);

  // Função para determinar o próximo valor de index baseado nos streams existentes
  const determineNextIndex = useCallback((streamsData: Stream[]) => {
    if (!streamsData || streamsData.length === 0) return 1;
    
    // Encontrar o maior valor de index atual
    const maxIndex = streamsData.reduce((max, stream) => {
      // Garantir que o index seja tratado como número
      const currentIndex = parseInt(stream.index || '0', 10);
      return isNaN(currentIndex) ? max : Math.max(max, currentIndex);
    }, 0);
    
    // Incrementar em 1 para o próximo
    const nextIdx = maxIndex + 1;
    console.log(`Próximo valor de index calculado: ${nextIdx} (maior atual: ${maxIndex})`);
    return nextIdx;
  }, []);

  // Função para garantir que todos os campos obrigatórios existam ao editar um stream
  const prepareStreamForEditing = (stream: Stream): Stream => {
    return {
      ...initialFormState,
      ...stream,
      url: stream.url || '',
      name: stream.name || '',
      sheet: stream.sheet || '',
      cidade: stream.cidade || '',
      estado: stream.estado || '',
      regiao: stream.regiao || '',
      pais: stream.pais || 'Brasil',
      segmento: stream.segmento || '',
      formato: stream.formato || '',
      logo_url: stream.logo_url || '',
      site: stream.site || '',
      instagram: stream.instagram || '',
      facebook: stream.facebook || '',
      twitter: stream.twitter || '',
      youtube: stream.youtube || '',
      frequencia: stream.frequencia || '',
      index: stream.index || '0',
    };
  };

  // Função para verificar se uma imagem está acessível
  const checkImageExists = useCallback(async (url: string): Promise<boolean> => {
    if (!url) return false;
    
    // Se estamos em ambiente de desenvolvimento e a URL é de produção, assumimos que a imagem existe
    // sem tentar verificar (evita erros de CORS)
    if (window.location.hostname === 'localhost' && url.includes('songmetrix.com.br')) {
      console.log('Ambiente de desenvolvimento: assumindo que a imagem existe em:', url);
      return true;
    }
    
    try {
      // Usar modo 'no-cors' para evitar erros de CORS durante o desenvolvimento
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      
      // No modo 'no-cors', não podemos acessar response.ok
      // Se não houve erro, consideramos que a imagem existe
      return true;
    } catch (error) {
      console.error('Erro ao verificar imagem:', error);
      return false;
    }
  }, []);

  // Função para tentar diferentes variações de URLs para uma imagem
  const findAccessibleImageUrl = useCallback(async (baseUrl: string, fileName: string): Promise<string | null> => {
    if (!baseUrl) return null;
    
    // Corrigir URLs múltiplas vezes duplicadas usando regex
    let cleanBaseUrl = baseUrl;
    // Padrão para detectar o prefixo duplicado
    const duplicatedPrefix = 'https://songmetrix.com.br/uploads/logos/';
    // Encontrar o último prefixo + o nome do arquivo
    const regex = new RegExp(`(${duplicatedPrefix})+(.+)$`);
    const match = baseUrl.match(regex);
    
    if (match) {
      // Manter apenas o último prefixo + nome do arquivo
      cleanBaseUrl = duplicatedPrefix + match[2];
      console.log('URL múltiplas vezes duplicada corrigida:', cleanBaseUrl);
    }
    
    // Lista de possíveis URLs para tentar
    const urlVariations = [
      // URL original limpa
      cleanBaseUrl,
      // URL com UUID (assumindo que fileName é o UUID)
      `https://songmetrix.com.br/uploads/logos/${fileName}`,
      // URL com o domínio corrigido
      cleanBaseUrl.replace(/http:\/\/localhost:\d+\/uploads\/logos\//, 'https://songmetrix.com.br/uploads/logos/'),
      // URL com HTTPS forçado
      cleanBaseUrl.replace('http://', 'https://'),
    ];
    
    // Remover duplicatas e URLs vazias
    const uniqueUrls = [...new Set(urlVariations)].filter(url => url && url.length > 0);
    
    console.log('Tentando variações de URLs:', uniqueUrls);
    
    // Tentar cada URL
    for (const url of uniqueUrls) {
      const exists = await checkImageExists(url);
      if (exists) {
        console.log('URL acessível encontrada:', url);
        return url;
      }
    }
    
    console.warn('Nenhuma variação de URL está acessível');
    return null;
  }, [checkImageExists]);

  // Função para pré-carregar imagens
  const preloadImages = useCallback(async (streamsToPreload: Stream[]) => {
    // Evitar pré-carregamento repetido
    if (hasLoadedStreams.current) {
      console.log('Imagens já pré-carregadas, pulando...');
      return;
    }
    
    console.log('Pré-carregando imagens...');
    
    const isDev = window.location.hostname === 'localhost';
    const maxImagesToPreload = 10; // Limitar o número de imagens para pré-carregar em produção
    
    // Filtrar streams com logo_url e limitar a quantidade
    const streamsWithLogos = streamsToPreload
      .filter(stream => stream.logo_url)
      .slice(0, maxImagesToPreload);
    
    console.log(`Selecionadas ${streamsWithLogos.length} imagens para pré-carregamento (limite: ${maxImagesToPreload})`);
    
    const imagePromises = streamsWithLogos.map(async stream => {
        // Verificar se a URL está duplicada e corrigir
        let cleanUrl = stream.logo_url;
        if (stream.logo_url && stream.logo_url.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/')) {
          cleanUrl = stream.logo_url.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
          console.log('URL duplicada corrigida durante pré-carregamento:', cleanUrl);
        }
        
        // Em ambiente de desenvolvimento, se a URL for de produção, assumimos que existe
        // e retornamos diretamente sem verificação (evita erros de CORS)
        if (isDev && cleanUrl.includes('songmetrix.com.br')) {
          return cleanUrl;
        }
        
        // Em ambiente de produção, verificar se a imagem existe
        if (!isDev) {
        try {
          // Verificar diretamente se a imagem existe
          const exists = await checkImageExists(cleanUrl);
          if (exists) {
            return cleanUrl;
          }
          
          // Se não existir, tentar encontrar uma URL acessível
          const fileName = cleanUrl.split('/').pop() || '';
          return findAccessibleImageUrl(cleanUrl, fileName);
        } catch (error) {
          console.error('Erro ao verificar imagem:', error);
          return null;
        }
        }
        
        // Em desenvolvimento, retornar a URL diretamente
        return cleanUrl;
      });
    
    // Aguardar todas as promessas de URLs acessíveis
    const accessibleUrls = await Promise.all(imagePromises);
    
    // Filtrar URLs nulas
    const validUrls = accessibleUrls.filter(url => url !== null) as string[];
    
    console.log(`Encontradas ${validUrls.length} URLs acessíveis para pré-carregamento`);
    
    // Pré-carregar as imagens válidas - limitado a 5 segundos no máximo
    const preloadTimeout = 5000; // 5 segundos
    
    return new Promise<void>((resolve) => {
      if (validUrls.length === 0) {
        console.log('Nenhuma imagem para pré-carregar');
        resolve();
        return;
      }
      
      // Em ambiente de desenvolvimento, não tentar pré-carregar imagens de produção
      // para evitar erros de CORS, apenas simular o carregamento
      if (isDev) {
        console.log('Ambiente de desenvolvimento: simulando pré-carregamento de imagens');
        setTimeout(() => {
          console.log('Pré-carregamento de imagens simulado concluído');
          resolve();
        }, 300); // Reduzido para 300ms
        return;
      }
      
      // Timer para garantir que o pré-carregamento não bloqueia a UI por muito tempo
      const timeout = setTimeout(() => {
        console.log('Tempo limite de pré-carregamento atingido. Continuando...');
        resolve();
      }, preloadTimeout);
      
      let loadedCount = 0;
      const totalImages = validUrls.length;
      
      validUrls.forEach(imageUrl => {
        const img = new Image();
        
        img.onload = () => {
          loadedCount++;
          
          if (loadedCount === totalImages) {
            clearTimeout(timeout);
            console.log('Pré-carregamento de imagens concluído');
            resolve();
          }
        };
        
        img.onerror = () => {
          loadedCount++;
          console.log(`Erro ao carregar imagem: ${imageUrl}`);
          
          if (loadedCount === totalImages) {
            clearTimeout(timeout);
            console.log('Pré-carregamento de imagens concluído');
            resolve();
          }
        };
        
        img.src = imageUrl;
      });
    });
  }, [checkImageExists, findAccessibleImageUrl]);

  // Função para lidar com erros da API
  const handleApiError = useCallback((error: Error) => {
    console.error('Erro na API:', error);
    
    if (error.message.includes('só é permitida em ambiente de produção')) {
      toast.warning('Esta ação só é permitida em ambiente de produção.');
      return;
    }
    
    toast.error(error.message || 'Ocorreu um erro ao processar sua solicitação');
  }, []);

  // Função para buscar streams - Usando useRef para evitar loops
  const fetchStreamsRef = useRef<(() => Promise<void>) | null>(null);
  
  // Inicializar a função fetchStreams apenas uma vez no montagem do componente
  useEffect(() => {
    console.log('Inicializando fetchStreamsRef uma única vez');
    
    // Capturar as funções necessárias no escopo do useEffect
    const handleApiErrorClosure = handleApiError;
    const preloadImagesClosure = preloadImages;
    const determineNextIndexClosure = determineNextIndex;
    
    // Definir a função fetchStreams
    fetchStreamsRef.current = async () => {
      try {
        // Evitar carregamento repetido
        if (hasLoadedStreams.current) {
          console.log('Streams já carregados, pulando fetch...');
          return;
        }
        
        loadCount.current += 1;
        // Limitar o número de tentativas para evitar loops
        if (loadCount.current > 2) {
          console.warn(`[WARN] Mais de 2 tentativas de carregamento (${loadCount.current}). Possível loop.`);
          // Se já tentamos mais de 2 vezes, vamos forçar hasLoadedStreams para true
          hasLoadedStreams.current = true;
          return;
        }
        
        console.log(`[DEBUG] Tentativa de carregamento #${loadCount.current}`);
        
      setLoading(true);
      console.log('Buscando streams...');
      
      // Verificar se o usuário está autenticado
      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }
      
      const data = await apiServices.streams.getAll();
      
      if (Array.isArray(data)) {
          // Atualizar os streams no estado
        setStreams(data);
        setFilteredStreams(data);
          
          // Calcular o próximo índice
          const nextIdx = determineNextIndexClosure(data);
          setNextIndex(nextIdx);
          console.log(`Próximo valor de index: ${nextIdx}`);
          
          // Atualizar o formData com o novo index calculado
          setFormData(prev => ({
            ...prev,
            index: nextIdx.toString()
          }));
        
        // Pré-carregar imagens após obter os streams
          await preloadImagesClosure(data);
          
          // Marcar como carregado após sucesso
        hasLoadedStreams.current = true;
          
          console.log(`${data.length} streams carregados com sucesso`);
      } else {
        console.error('Dados recebidos não são um array:', data);
        setStreams([]);
        setFilteredStreams([]);
      }
    } catch (error) {
        handleApiErrorClosure(error as Error);
        // Não alteramos o hasLoadedStreams em caso de erro
    } finally {
      setLoading(false);
    }
    };
    
    // Função de cleanup
    return () => {
      // Nada a limpar aqui
    };
  // Esta função deve ser executada apenas uma vez na montagem, sem dependências
  }, []); // array vazio

  // Efeito para carregar streams quando o usuário estiver autenticado
  useEffect(() => {
    // Função assíncrona para carregar os streams
    const loadStreams = async () => {
      if (currentUser && !hasLoadedStreams.current && fetchStreamsRef.current) {
      console.log('Usuário autenticado, carregando dados...');
        // Executar o carregamento
        await fetchStreamsRef.current();
      }
    };
    
    // Chamar a função
    loadStreams();
    
    // Limpar recursos ao desmontar o componente
    return () => {
      console.log('Componente StreamsManager desmontado.');
    };
  }, [currentUser]); // Apenas depende do currentUser

  // Verificar ambiente no carregamento do componente
  useEffect(() => {
    const checkEnvironment = () => {
      const isDev = window.location.hostname === 'localhost';
      setIsDevEnvironment(isDev);
      
      if (isDev) {
        setDevModeMessage('Você está em ambiente de desenvolvimento. O formulário funciona normalmente, mas certos recursos como upload de imagens podem ter comportamento simulado.');
        console.log('Ambiente de desenvolvimento detectado. Upload de imagens desativado.');
      } else {
        console.log('Ambiente: produção');
      }
    };
    
    checkEnvironment();
    
    // Limpar recursos ao desmontar o componente
    return () => {
      console.log('Verificação de ambiente encerrada.');
    };
  }, []); // Array vazio para executar apenas uma vez

  // Efeito para limpar o estado quando o componente é desmontado
  useEffect(() => {
    return () => {
      console.log('[DEBUG] StreamsManager está sendo desmontado');
      hasLoadedStreams.current = false;
      loadCount.current = 0;
    };
  }, []);

  // Componente para exibir imagem com fallback
  const ImageWithFallback = ({ src, alt, className }: { src: string | null, alt: string, className?: string }) => {
    const [error, setError] = useState(false);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const isMounted = useRef(true);
    const triedUrlsRef = useRef<Set<string>>(new Set());
    const attemptCountRef = useRef(0);
    const maxAttempts = 3; // Limitar o número máximo de tentativas
    const previousSrcRef = useRef<string | null>(null);
    
    // Debug info para rastrear problemas
    const debugMode = true;
    const logDebug = useCallback((message: string, ...args: any[]) => {
      if (debugMode && isMounted.current) {
        console.log(`[ImageWithFallback] ${message}`, ...args);
      }
    }, []);
    
    // Limpar quando o componente for desmontado
    useEffect(() => {
      return () => {
        isMounted.current = false;
      };
    }, []);
    
    // Função para gerar alternativas de URL - não depende de state
    const generateAlternatives = useCallback((url: string): string[] => {
      const fileName = url.split('/').pop() || '';
      if (!fileName) return [];
      
      // Criar uma lista base de alternativas
      const alternatives = [];
      
      // Tentar com diferentes variações do domínio e caminhos
      alternatives.push(
        `https://www.songmetrix.com.br/uploads/logos/${fileName}`,
        `https://songmetrix.com.br/uploads/logos/${fileName}`,
        // Adicionar timestamp para forçar recarregamento
        `https://songmetrix.com.br/uploads/logos/${fileName}?t=${Date.now()}`
      );
      
      // Se a URL original contém parâmetros de query, tentar uma versão sem eles
      if (fileName.includes('?')) {
        const cleanFileName = fileName.split('?')[0];
        alternatives.push(`https://songmetrix.com.br/uploads/logos/${cleanFileName}`);
      }
      
      // Para uploads recentes, tentar uma URL com apenas o UUID
      if (fileName.includes('-') && fileName.length > 30) {
        alternatives.push(`https://songmetrix.com.br/uploads/logos/${fileName}`);
      }
      
      // Adicionar versão normalizada do nome da rádio
      if (alt.includes('Logo ')) {
        const radioName = alt.replace('Logo ', '');
        
        const normalizedRadioName = radioName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remover acentos
          .replace(/[^\w\s-]/g, '') // Remover caracteres especiais
          .replace(/\s+/g, '_') // Substituir espaços por underscores
          .toLowerCase(); // Converter para minúsculas
        
        const fileExtension = fileName.split('.').pop() || 'png';
        const normalizedFileName = `${normalizedRadioName}.${fileExtension}`;
        
        // Adicionar URL com nome normalizado no início da lista para ter prioridade
        alternatives.unshift(`https://songmetrix.com.br/uploads/logos/${normalizedFileName}`);
        
        // Também adicionar versão com timestamp
        alternatives.unshift(`https://songmetrix.com.br/uploads/logos/${normalizedFileName}?t=${Date.now()}`);
      }
      
      // Adicionar URL estática de fallback no final como último recurso
      alternatives.push('https://songmetrix.com.br/uploads/logos/no-image.png');
      
      // Remover duplicatas
      return [...new Set(alternatives)];
    }, [alt]);
    
    // Função para limpar e preparar URLs
    const prepareImageUrl = useCallback((url: string | null): string | null => {
      if (!url) return null;
      
      // Verificar se a URL é um blob (preview local)
      if (url.startsWith('blob:')) {
        logDebug('URL é um blob (preview local):', url);
        return url;
      }
      
      // Limpar URL
      let cleanUrl = url;
      
      // Verificar e corrigir URLs com localhost
      if (cleanUrl.includes('localhost')) {
        const fileName = cleanUrl.split('/').pop() || '';
        cleanUrl = `https://songmetrix.com.br/uploads/logos/${fileName}`;
        logDebug('URL com localhost convertida para produção:', cleanUrl);
      }
      
      // Corrigir prefixos duplicados
      const duplicatedPrefix = 'https://songmetrix.com.br/uploads/logos/';
      const regex = new RegExp(`(${duplicatedPrefix})+(.+)$`);
      const match = cleanUrl.match(regex);
      
      if (match) {
        cleanUrl = duplicatedPrefix + match[2];
        logDebug('URL duplicada corrigida:', cleanUrl);
      }
      
      // Verificar se a URL tem caminho completo
      if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/') && !cleanUrl.startsWith('blob:')) {
        cleanUrl = `${duplicatedPrefix}${cleanUrl}`;
        logDebug('URL sem prefixo corrigida:', cleanUrl);
      }
      
      // Se for apenas um nome de arquivo, adicionar o caminho completo
      if (!cleanUrl.includes('/') && !cleanUrl.startsWith('blob:')) {
        cleanUrl = `${duplicatedPrefix}${cleanUrl}`;
        logDebug('Nome de arquivo convertido para URL completa:', cleanUrl);
      }
      
      // Verificar se há UUID na URL (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      if (cleanUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
        logDebug('Detectado UUID na URL. Esta URL pode ser menos confiável que URLs normalizadas.');
      }
      
      // Garantir https (não http)
      cleanUrl = cleanUrl.replace('http://', 'https://');
      
      return cleanUrl;
    }, [logDebug]);
    
    // Função para tentar a próxima alternativa quando há erro
    const tryNextAlternative = useCallback(() => {
      if (!isMounted.current) return;
      
      // Verificar se atingiu o limite de tentativas
      if (attemptCountRef.current >= maxAttempts) {
        logDebug(`Limite de ${maxAttempts} tentativas atingido. Mostrando fallback.`);
        setError(true);
            return;
      }
      
      // Incrementar número de tentativas
      attemptCountRef.current++;
      
      // Verificar se ainda temos uma URL para tentar alternativas
      if (!imgSrc) {
        logDebug('Sem URL de imagem disponível para tentar alternativas.');
        setError(true);
            return;
          }
          
      logDebug(`Tentativa #${attemptCountRef.current}: Erro ao carregar imagem: ${imgSrc}`);
      
      // Gerar alternativas para a URL atual
      const alternatives = generateAlternatives(imgSrc);
      
      // Filtrar alternativas já tentadas usando a ref
      const untried = alternatives.filter(url => !triedUrlsRef.current.has(url));
      
      if (untried.length === 0) {
        logDebug('Todas as alternativas já foram tentadas. Exibindo fallback.');
        setError(true);
        return;
      }
      
      // Escolher a próxima alternativa
      const nextUrl = untried[0];
      logDebug('Tentando URL alternativa:', nextUrl);
      
      // Registrar esta tentativa na ref
      triedUrlsRef.current.add(nextUrl);
      
      // Definir a nova URL com um pequeno delay para evitar loops muito rápidos
      setTimeout(() => {
        if (isMounted.current) {
          setImgSrc(nextUrl);
        }
      }, 200);
    }, [imgSrc, generateAlternatives, logDebug]);
    
    // Efeito para processar a URL quando a prop src muda
    useEffect(() => {
              if (!isMounted.current) return;
              
      // Se a src for igual à anterior, não fazer nada para evitar renderizações duplas
      if (src === previousSrcRef.current && imgSrc) {
        return;
      }
      
      // Atualizar a referência da src anterior
      previousSrcRef.current = src;
      
      // Log para depuração - só se houver uma URL (evitar logs desnecessários)
      if (src) {
        logDebug(`Props src atualizada: ${src}`);
      }
      
      // Resetar estado e refs quando a fonte muda significativamente
            setError(false);
      triedUrlsRef.current = new Set();
      attemptCountRef.current = 0;
      
      // Processar a URL
      const preparedUrl = prepareImageUrl(src);
      
      if (!preparedUrl) {
        // Não logar quando src é vazia ou nula por design (carregamento inicial)
        if (src) {
          logDebug('URL inválida ou nula');
        }
            setError(true);
        return;
      }
      
      // Registrar esta URL como tentada
      triedUrlsRef.current.add(preparedUrl);
      
      // Aplicar a URL preparada
      logDebug('URL preparada:', preparedUrl);
      setImgSrc(preparedUrl);
      
    }, [src, prepareImageUrl, logDebug, imgSrc]);
    
    // Exibir fallback se houver erro ou sem URL
    if (error || !imgSrc) {
      return (
        <div className={`bg-gray-200 flex items-center justify-center ${className || 'w-12 h-12'}`}>
          <Radio className="w-6 h-6 text-gray-400" />
          {error && <span className="sr-only">Erro ao carregar imagem</span>}
        </div>
      );
    }
    
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={tryNextAlternative}
        onLoad={() => {
          logDebug(`Imagem carregada com sucesso: ${imgSrc}`);
        }}
      />
    );
  };

  // Função para excluir um stream
  const handleDeleteStream = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta stream?')) {
      try {
        await apiServices.streams.delete(id);
        toast.success('Stream excluída com sucesso!');
        // Forçar nova busca de streams
        hasLoadedStreams.current = false;
        if (fetchStreamsRef.current) {
          await fetchStreamsRef.current();
        } else {
          console.warn('Função fetchStreams não está disponível');
        }
      } catch (error) {
        handleApiError(error as Error);
      }
    }
  }

  // Função para preparar URL da imagem após upload
  const prepareUploadedImageUrl = useCallback((url: string, radioName: string): string => {
    // Normalizar URL para garantir compatibilidade entre ambientes
    let normalizedUrl = url;
    
    // Verificar se a URL contém localhost (independente do ambiente)
    if (normalizedUrl.includes('localhost')) {
      console.log('URL do servidor com localhost:', normalizedUrl);
      
      // Extrair o nome do arquivo da URL
      const fileName = normalizedUrl.split('/').pop() || '';
      
      // Construir URL com domínio de produção
      normalizedUrl = `https://songmetrix.com.br/uploads/logos/${fileName}`;
      console.log('URL normalizada para produção:', normalizedUrl);
    }
    
    // Garantir que a URL não está duplicada
    if (normalizedUrl.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/')) {
      normalizedUrl = normalizedUrl.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
    }
    
    // Normalizar nome do arquivo para corresponder ao nome da rádio para facilitar cache/identificação
    if (radioName) {
      const currentFileName = normalizedUrl.split('/').pop() || '';
      const fileExtension = currentFileName.split('.').pop() || 'png';
      
      // Criar nome de arquivo normalizado baseado no nome da rádio
      const normalizedRadioName = radioName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^\w\s-]/g, '') // Remover caracteres especiais
        .replace(/\s+/g, '_') // Substituir espaços por underscores
        .toLowerCase(); // Converter para minúsculas
      
      // Substituir o nome do arquivo na URL
      const normalizedFileName = `${normalizedRadioName}.${fileExtension}`;
      const basePath = normalizedUrl.substring(0, normalizedUrl.lastIndexOf('/') + 1);
      normalizedUrl = `${basePath}${normalizedFileName}`;
      
      console.log(`Nome do arquivo normalizado: ${normalizedFileName}`);
    }
    
    console.log('URL final normalizada:', normalizedUrl);
    return normalizedUrl;
  }, []);

  // Função para pré-carregar uma única imagem
  const preloadSingleImage = useCallback((url: string): Promise<boolean> => {
    if (!url) return Promise.resolve(false);
    
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        console.log('Imagem pré-carregada com sucesso:', url);
        resolve(true);
      };
      
      img.onerror = () => {
        console.log('Erro ao pré-carregar imagem:', url);
        resolve(false);
      };
      
      // Adicionar timestamp para evitar cache
      const urlWithTimestamp = url.includes('?') 
        ? `${url}&t=${Date.now()}` 
        : `${url}?t=${Date.now()}`;
      
      img.src = urlWithTimestamp;
    });
  }, []);

  return (
    <div className={cn("container mx-auto p-4")}>
      {isDevEnvironment && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {devModeMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gerenciar Streams</h1>
        <Button onClick={() => {
          setEditingStream(null);
          // Usar o próximo index calculado para o novo stream
          setFormData({
            ...initialFormState,
            index: nextIndex.toString()
          });
          console.log(`Novo stream será criado com index: ${nextIndex}`);
          setLogoPreview(null);
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Stream
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent 
            className="max-w-3xl max-h-[90vh] overflow-y-auto" 
            aria-describedby="stream-form-description"
          >
            <DialogHeader>
              <DialogTitle>
                {editingStream ? 'Editar Stream' : 'Adicionar Stream'}
              </DialogTitle>
              <DialogDescription id="stream-form-description">
                {editingStream ? 'Edite os detalhes da stream selecionada.' : 'Preencha os detalhes para adicionar uma nova stream.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                // Garantir que todos os valores são strings antes de enviar
                const dataToSend = prepareStreamForEditing(formData);
                
                if (editingStream) {
                  // Garantir que o ID seja incluído corretamente nos dados enviados
                  const updateData = {
                    ...dataToSend,
                    id: editingStream.id // Garantir que o ID está incluído
                  };
                  console.log('Atualizando stream com ID:', editingStream.id);
                  console.log('Dados enviados para atualização:', updateData);
                  
                  await apiServices.streams.update(editingStream.id!, updateData);
                  toast.success('Stream atualizada com sucesso!');
                } else {
                  // Ao criar novo stream, garantir que o index seja o próximo disponível
                  const createData = {
                    ...dataToSend,
                    index: nextIndex.toString() // Garantir que estamos usando o próximo índice calculado
                  };
                  console.log('Criando novo stream com index:', nextIndex);
                  console.log('Dados enviados para criação:', createData);
                  
                  await apiServices.streams.create(createData);
                  toast.success('Stream criada com sucesso!');
                }
                
                // Primeiro fechar o diálogo para evitar problemas de re-renderização
                setDialogOpen(false);
                
                // Em seguida, resetar os estados
                setFormData(initialFormState);
                setEditingStream(null);
                setLogoPreview(null);
                
                // Forçar nova busca de streams
                hasLoadedStreams.current = false;
                loadCount.current = 0; // Resetar o contador de carregamento
                
                if (fetchStreamsRef.current) {
                  // Usar setTimeout para garantir que o diálogo já foi fechado
                  setTimeout(async () => {
                    if (fetchStreamsRef.current) {
                      await fetchStreamsRef.current();
                    }
                  }, 100);
                }
              } catch (error) {
                handleApiError(error as Error);
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome da Rádio</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="url">URL do Stream</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="frequencia">Frequência</Label>
                  <Input
                    id="frequencia"
                    value={formData.frequencia}
                    onChange={(e) => setFormData({ ...formData, frequencia: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="sheet">Planilha</Label>
                  <Input
                    id="sheet"
                    value={formData.sheet}
                    onChange={(e) => setFormData({ ...formData, sheet: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="index">Índice</Label>
                  <Input
                    id="index"
                    value={formData.index}
                    readOnly={true}
                    disabled={true}
                    className="bg-gray-100"
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="regiao">Região</Label>
                  <Input
                    id="regiao"
                    value={formData.regiao}
                    onChange={(e) => setFormData({ ...formData, regiao: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="pais">País</Label>
                  <Input
                    id="pais"
                    value={formData.pais}
                    onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="segmento">Segmento</Label>
                  <Input
                    id="segmento"
                    value={formData.segmento}
                    onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="formato">Formato</Label>
                  <Input
                    id="formato"
                    value={formData.formato}
                    onChange={(e) => setFormData({ ...formData, formato: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="site">Website</Label>
                  <Input
                    id="site"
                    value={formData.site}
                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="twitter">X/Twitter</Label>
                  <Input
                    id="twitter"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    value={formData.youtube}
                    onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="logo">Logo</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    {logoPreview ? (
                      <ImageWithFallback
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-24 h-24 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gray-200 flex items-center justify-center rounded-lg">
                        <Radio className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex flex-col space-y-2">
                    <input
                      type="file"
                      id="logo"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                              // Mostrar toast de carregamento
                              const loadingToastId = toast.loading('Fazendo upload da imagem...');
                              
                            const formDataFile = new FormData();
                            formDataFile.append('logo', file);
                              formDataFile.append('radioName', formData.name || 'nova-radio');
                              
                              // Garantir que o nome da rádio foi fornecido
                              if (!formData.name) {
                                toast.update(loadingToastId, { 
                                  render: 'Preencha o nome da rádio antes de fazer upload da logo', 
                                  type: 'warning',
                                  isLoading: false,
                                  autoClose: 5000
                                });
                                return;
                              }

                              console.log('Iniciando upload da logo para a rádio:', formData.name);
                            const uploadResult = await apiServices.uploads.uploadLogo(formDataFile);
                              console.log('Resultado do upload:', uploadResult);
                              
                              if (uploadResult.success && uploadResult.url) {
                                // Normalizar URL com função dedicada
                                const normalizedUrl = prepareUploadedImageUrl(uploadResult.url, formData.name);
                                
                                // Verificar se estamos em desenvolvimento e se temos uma URL de preview
                                const isDevMode = window.location.hostname === 'localhost';
                                
                                // Determinar qual URL usar para preview
                                let previewUrl;
                                if (isDevMode && uploadResult.filePreview) {
                                  // Em modo de desenvolvimento, usar o preview de blob local
                                  previewUrl = uploadResult.filePreview;
                                  console.log('Usando URL de preview local (blob):', previewUrl);
                                } else {
                                  // Em produção, usar a URL normalizada com timestamp para evitar cache
                                  const timestamp = Date.now();
                                  previewUrl = normalizedUrl.includes('?') 
                                    ? `${normalizedUrl}&t=${timestamp}`
                                    : `${normalizedUrl}?t=${timestamp}`;
                                  console.log('Usando URL normalizada com timestamp para preview:', previewUrl);
                                  
                                  // Tentar pré-carregar a imagem
                                  preloadSingleImage(previewUrl)
                                    .then(success => {
                                      console.log('Pré-carregamento da imagem:', success ? 'sucesso' : 'falha');
                                      
                                      // Se falhar no pré-carregamento, tentar alternativas
                                      if (!success) {
                                        // Tentar uma URL alternativa sem o nome normalizado
                                        const fileName = uploadResult.url.split('/').pop() || '';
                                        const fallbackUrl = `https://songmetrix.com.br/uploads/logos/${fileName}?t=${Date.now()}`;
                                        console.log('Tentando URL alternativa:', fallbackUrl);
                                        
                                        // Verificar se essa alternativa funciona
                                        preloadSingleImage(fallbackUrl).then(altSuccess => {
                                          if (altSuccess) {
                                            console.log('URL alternativa funcionou, atualizando preview');
                                            setLogoPreview(fallbackUrl);
                                            // Não alteramos o formData.logo_url, mantemos a normalizada
                                          }
                                        });
                                      }
                                    });
                                }
                                
                                // Atualizar a preview e o formData de maneira síncrona
                                setLogoPreview(previewUrl);
                                setFormData(prevState => ({
                                  ...prevState, 
                                  logo_url: normalizedUrl
                                }));
                                
                                console.log('URL da imagem definida no formData:', normalizedUrl);
                                console.log('URL para preview definida:', previewUrl);
                                
                                // Atualizar toast para sucesso
                                toast.update(loadingToastId, { 
                                  render: 'Logo carregada com sucesso!', 
                                  type: 'success',
                                  isLoading: false,
                                  autoClose: 3000
                                });
                              } else {
                                // Atualizar toast para erro
                                toast.update(loadingToastId, { 
                                  render: `Falha ao fazer upload da logo: ${uploadResult.message || 'Erro desconhecido'}`, 
                                  type: 'error',
                                  isLoading: false,
                                  autoClose: 5000
                                });
                            }
                          } catch (error) {
                            handleApiError(error as Error);
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Escolher Logo
                    </Button>
                      {logoPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setLogoPreview(null);
                            setFormData({ ...formData, logo_url: '' });
                          }}
                        >
                          Remover Logo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingStream(null);
                    setFormData(initialFormState);
                    setLogoPreview(null);
                    setDialogOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingStream ? 'Salvar Alterações' : 'Criar Stream'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar streams..."
                  className="pl-10"
                  onChange={(e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filtered = streams.filter(stream =>
                      stream.name.toLowerCase().includes(searchTerm) ||
                      stream.cidade.toLowerCase().includes(searchTerm) ||
                      stream.estado.toLowerCase().includes(searchTerm)
                    );
                    setFilteredStreams(filtered);
                  }}
                />
              </div>
            </div>
            <Button variant="outline" className="flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredStreams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    Nenhuma stream encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredStreams.map((stream) => (
                  <TableRow key={stream.id}>
                    <TableCell>
                      <ImageWithFallback
                        src={stream.logo_url}
                        alt={`Logo ${stream.name}`}
                        className="w-12 h-12 object-contain rounded-lg"
                      />
                    </TableCell>
                    <TableCell>{stream.name}</TableCell>
                    <TableCell>{stream.cidade}</TableCell>
                    <TableCell>{stream.estado}</TableCell>
                    <TableCell>{stream.regiao}</TableCell>
                    <TableCell>{stream.formato}</TableCell>
                    <TableCell>{stream.segmento}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Garantir que o stream seja definido corretamente para edição
                            const streamToEdit = {...stream};
                            
                            // Garantir que todos os campos existam e sejam strings
                            const completedStream = prepareStreamForEditing(streamToEdit);
                            
                            // Normalizar a URL da logo para evitar problemas de carregamento em produção
                            if (streamToEdit.logo_url) {
                              const normalizedLogoUrl = prepareUploadedImageUrl(
                                streamToEdit.logo_url,
                                streamToEdit.name
                              );
                              completedStream.logo_url = normalizedLogoUrl;
                              console.log('URL da logo normalizada para edição:', normalizedLogoUrl);
                            }
                            
                            setEditingStream(streamToEdit);
                            setFormData(completedStream);
                            
                            // Definir o preview da logo, mesmo em ambiente de desenvolvimento
                            const logoUrl = completedStream.logo_url || null;
                            setLogoPreview(logoUrl);
                            console.log('Preview da logo definido para edição:', logoUrl);
                            
                            // Abrir o diálogo de edição
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await handleDeleteStream(stream.id!);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}