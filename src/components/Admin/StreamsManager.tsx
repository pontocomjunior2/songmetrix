import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiServices from '../../services/api';
import { toast } from 'react-toastify';
import { Loader2, Search, Plus, Edit, Trash2, X, Check, Filter, Radio, MapPin, Globe, Map, Music, Facebook, Instagram, Twitter, Youtube, Globe2, Upload, Image } from 'lucide-react';

interface Stream {
  id?: number;
  url: string;
  name: string;
  sheet: string;
  cidade: string;
  estado: string;
  pais: string;
  regiao: string;
  segmento: string;
  formato: string;
  frequencia: string;
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
  site: string;
  monitoring_url: string;
  logo_url: string;
  index: string;
}

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Adicionar um cache global para URLs com erro
const imageErrorCache: Record<string, boolean> = {};

// Função para salvar imagem base64 no localStorage
const saveBase64ToLocalStorage = (url: string, base64Data: string) => {
  try {
    // Extrair apenas o nome do arquivo da URL para usar como chave
    const fileName = url.split('/').pop() || '';
    if (fileName) {
      const cacheKey = `logo_cache_${fileName}`;
      localStorage.setItem(cacheKey, base64Data);
      console.log('Imagem base64 armazenada em cache local com chave:', cacheKey);
      return cacheKey;
    }
  } catch (error) {
    console.error('Erro ao armazenar imagem base64 em cache local:', error);
  }
  return null;
};

// Função para recuperar imagem base64 do localStorage
const getBase64FromLocalStorage = (url: string): string | null => {
  try {
    if (!url) return null;
    
    // Tentar encontrar pelo nome do arquivo
    const fileName = url.split('/').pop() || '';
    if (fileName) {
      const cacheKey = `logo_cache_${fileName}`;
      const cachedImage = localStorage.getItem(cacheKey);
      if (cachedImage) {
        console.log('Imagem base64 recuperada do cache local com chave:', cacheKey);
        return cachedImage;
      }
    }
    
    // Se não encontrou pelo nome específico, procurar em todas as chaves do localStorage
    // que começam com logo_cache_
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('logo_cache_')) {
        const cachedImage = localStorage.getItem(key);
        if (cachedImage) {
          console.log('Imagem base64 encontrada no cache local com chave:', key);
          return cachedImage;
        }
      }
    }
  } catch (error) {
    console.error('Erro ao recuperar imagem base64 do cache local:', error);
  }
  return null;
};

// Adicionar um componente reutilizável para exibição de imagens com tratamento de erro
const ImageWithFallback = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
  const [imageError, setImageError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  
  useEffect(() => {
    // Verificar se temos uma versão em cache no localStorage
    const cachedBase64 = getBase64FromLocalStorage(src);
    if (cachedBase64) {
      console.log('Usando versão base64 do localStorage para:', src);
      setImgSrc(cachedBase64);
      return;
    }
    
    // Verificar se a URL já está no cache de erros
    if (src && imageErrorCache[src]) {
      console.log('Imagem com erro no cache, exibindo fallback direto:', src);
      setImageError(true);
      return;
    }
    
    // Se a URL for vazia ou null, definir erro
    if (!src) {
      setImageError(true);
      return;
    }
    
    // Se for base64, usar diretamente
    if (src.startsWith('data:')) {
      setImgSrc(src);
      return;
    }
    
    // Tentar normalizar a URL
    try {
      const normalizedUrl = normalizeUrl(src);
      setImgSrc(normalizedUrl);
    } catch (e) {
      console.error('Erro ao normalizar URL:', e);
      setImageError(true);
    }
  }, [src]);
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Erro ao carregar imagem:', src);
    
    // Adicionar ao cache de erros
    if (src) {
      imageErrorCache[src] = true;
    }
    
    setImageError(true);
    
    // Evitar loops de erro
    const img = e.currentTarget;
    img.onerror = null;
    
    // Definir fallback SVG inline
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>';
  };

  // Verificar se a URL é válida
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Verificar se a URL é de outro domínio
  const isCrossOrigin = (url: string) => {
    if (!isValidUrl(url)) return false;
    try {
      const urlObj = new URL(url);
      const currentOrigin = window.location.origin;
      // Comparar apenas o hostname (domínio) e não a porta ou protocolo
      return urlObj.hostname !== window.location.hostname;
    } catch (e) {
      return false;
    }
  };

  // Verificar compatibilidade com CORS
  const isCrossOriginSupported = () => {
    try {
      // Testar se o navegador suporta CORS
      return typeof window !== 'undefined' &&
             typeof window.URL === 'function' &&
             typeof document.createElement === 'function';
    } catch (e) {
      return false;
    }
  };

  // Converter para URL absoluta com o domínio atual
  const getAbsoluteUrl = (path: string) => {
    try {
      // Converter url relativa para absoluta
      return new URL(path, window.location.origin).href;
    } catch (e) {
      // Fallback para navegadores antigos
      return path;
    }
  };

  // Converter URLs para o domínio atual
  const normalizeUrl = (url: string) => {
    // Verificar primeiro se o browser suporta as APIs necessárias
    if (!isCrossOriginSupported()) {
      return url; // Retornar URL original em browsers antigos
    }
    
    // Se já estamos com erro ou a URL não é válida, retornar como está
    if (imageError || !url || !isValidUrl(url)) return url;
    
    // Se a URL é de outro domínio, tentar converter
    if (isCrossOrigin(url)) {
      try {
        const urlObj = new URL(url);
        const pathOnly = urlObj.pathname;
        // Usar apenas o caminho com o domínio atual
        const normalizedUrl = getAbsoluteUrl(pathOnly);
        console.log(`Convertendo URL cross-origin: ${url} → ${normalizedUrl}`);
        return normalizedUrl;
      } catch (e) {
        console.error('Erro ao normalizar URL:', e);
        return url;
      }
    }
    
    return url;
  };

  // Se a imagem já tem erro, mostrar fallback
  if (imageError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <Radio className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  // Se não temos URL de imagem ainda, mostrar loader
  if (!imgSrc && !imageError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <div className="animate-pulse w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600"></div>
      </div>
    );
  }

  // Exibir a imagem com tratamento de erro
  return (
    <img 
      src={imgSrc || ''} 
      alt={alt} 
      className={className}
      onError={handleImageError}
    />
  );
};

const StreamsManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [formData, setFormData] = useState<Stream>({
    url: '',
    name: '',
    sheet: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    regiao: '',
    segmento: '',
    formato: '',
    frequencia: '',
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: '',
    site: '',
    monitoring_url: '',
    logo_url: '',
    index: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    regiao: '',
    estado: '',
    cidade: '',
    segmento: '',
    formato: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueCities, setUniqueCities] = useState<string[]>([]);
  const [uniqueSegments, setUniqueSegments] = useState<string[]>([]);
  const [uniqueFormats, setUniqueFormats] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Função auxiliar para normalizar URLs entre domínios
  const normalizeLogoUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('data:')) return url; // Já é base64
    
    try {
      const urlObj = new URL(url);
      // Se estamos em produção e a URL tem localhost, ou vice-versa
      if (window.location.hostname !== urlObj.hostname) {
        // Extrair apenas o caminho (/uploads/logos/xxx.png)
        return `${window.location.origin}${urlObj.pathname}`;
      }
      return url;
    } catch (e) {
      console.error('Erro ao normalizar URL:', e);
      return url;
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchStreams();
    }
  }, [currentUser]);

  useEffect(() => {
    if (streams.length > 0) {
      // Extrair cidades e segmentos únicos para os filtros
      const cities = [...new Set(streams.map(stream => stream.cidade))].sort();
      setUniqueCities(cities);

      const segments = [...new Set(
        streams.flatMap(stream => 
          stream.segmento.split(',').map(s => s.trim())
        )
      )].sort();
      setUniqueSegments(segments);

      const formats = [...new Set(
        streams.flatMap(stream => 
          (stream.formato || stream.segmento).split(',').map(f => f.trim())
        )
      )].sort();
      setUniqueFormats(formats);

      applyFilters();
    }
  }, [streams, searchTerm, filterOptions]);

  // Efeito para lidar com a exibição correta da imagem ao editar
  useEffect(() => {
    if (showForm && editingStream?.logo_url) {
      let logoUrl = editingStream.logo_url;
      
      // Normalizar URL para produção se necessário
      if (window.location.hostname !== 'localhost' && logoUrl.includes('localhost')) {
        logoUrl = logoUrl.replace(
          /http:\/\/localhost:[0-9]+/,
          window.location.origin
        );
        console.log('URL da logo normalizada para produção:', logoUrl);
      }
      
      // Adicionar timestamp à URL da imagem para evitar cache
      const timeStamp = new Date().getTime();
      const logoUrlWithTimestamp = logoUrl.includes('?') 
        ? `${logoUrl}&t=${timeStamp}` 
        : `${logoUrl}?t=${timeStamp}`;
      
      console.log('Atualizando URL da logo com timestamp para evitar cache:', logoUrlWithTimestamp);
      
      // Atualizar o formData com a nova URL
      setFormData(prev => ({ 
        ...prev, 
        logo_url: logoUrlWithTimestamp 
      }));
    }
  }, [showForm, editingStream]);

  // Efeito para pré-carregar todas as imagens das rádios no cache
  useEffect(() => {
    if (streams.length > 0) {
      console.log('Iniciando pré-carregamento de imagens para', streams.length, 'streams');
      // Pré-carregar logos para evitar problemas de CORS
      streams.forEach(stream => {
        if (stream.logo_url) {
          // Verificar primeiro se já temos uma versão em cache
          const cachedBase64 = getBase64FromLocalStorage(stream.logo_url);
          if (cachedBase64) {
            console.log('Imagem já disponível em cache para:', stream.logo_url);
            return; // Já temos a imagem em cache
          }

          // Verificar se a URL já está no cache de erros
          if (imageErrorCache[stream.logo_url]) {
            console.log('Imagem já marcada como erro no cache:', stream.logo_url);
            return; // Já sabemos que esta imagem falha
          }

          // Tentar carregar a imagem e salvá-la em base64 no localStorage
          console.log('Pré-carregando imagem:', stream.logo_url);
          
          // Criar um elemento de imagem para pré-carregar
          const img = document.createElement('img');
          img.crossOrigin = 'anonymous'; // Importante para permitir que convertamos para base64
          
          img.onload = () => {
            try {
              // Imagem carregada com sucesso, converter para base64
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const base64Image = canvas.toDataURL('image/png');
                
                // Salvar a imagem convertida no localStorage
                saveBase64ToLocalStorage(stream.logo_url, base64Image);
                console.log('Imagem pré-carregada e convertida para base64 com sucesso:', stream.logo_url);
              }
            } catch (e) {
              console.error('Erro ao converter imagem para base64:', stream.logo_url, e);
            }
          };
          
          img.onerror = () => {
            // Adicionar ao cache de erros para evitar novas tentativas
            console.error('Erro ao pré-carregar imagem:', stream.logo_url);
            imageErrorCache[stream.logo_url] = true;
          };
          
          // Tentar normalizar a URL antes de pré-carregar
          try {
            const normalizedUrl = normalizeLogoUrl(stream.logo_url);
            img.src = normalizedUrl || stream.logo_url;
          } catch (e) {
            console.error('URL inválida para pré-carregamento:', stream.logo_url, e);
            imageErrorCache[stream.logo_url] = true;
          }
        }
      });
    }
  }, [streams]);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const data = await apiServices.streams.getAll();
      setStreams(data);
      setFilteredStreams(data);
    } catch (error) {
      console.error('Erro ao carregar streams:', error);
      toast.error('Erro ao carregar lista de streams');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...streams];

    // Aplicar filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(stream => 
        stream.name.toLowerCase().includes(term) || 
        stream.cidade.toLowerCase().includes(term) ||
        (stream.formato || '').toLowerCase().includes(term) ||
        stream.segmento.toLowerCase().includes(term) ||
        (stream.frequencia || '').toLowerCase().includes(term)
      );
    }

    // Aplicar filtros de seleção
    if (filterOptions.regiao) {
      result = result.filter(stream => stream.regiao === filterOptions.regiao);
    }
    
    if (filterOptions.estado) {
      result = result.filter(stream => stream.estado === filterOptions.estado);
    }
    
    if (filterOptions.cidade) {
      result = result.filter(stream => stream.cidade === filterOptions.cidade);
    }
    
    if (filterOptions.segmento) {
      result = result.filter(stream => 
        stream.segmento.split(',').map(s => s.trim()).includes(filterOptions.segmento)
      );
    }

    if (filterOptions.formato) {
      result = result.filter(stream => 
        (stream.formato || stream.segmento).split(',').map(f => f.trim()).includes(filterOptions.formato)
      );
    }

    setFilteredStreams(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar o tipo do arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    // Verificar o tamanho do arquivo (limite de 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('O tamanho da imagem não pode exceder 2MB');
      return;
    }

    // Criar um objeto FormData para enviar o arquivo
    const formDataFile = new FormData();
    formDataFile.append('logo', file);

    // Mostrar preview da imagem com base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target?.result as string;
      setLogoPreview(base64Image);
      setLogoBase64(base64Image); // Armazenar a versão base64 para uso futuro
      
      // Armazenar no localStorage para persistir entre sessões
      try {
        // Usar um ID único com base no timestamp
        const timestamp = new Date().getTime();
        const cacheKey = `logo_cache_${timestamp}`;
        localStorage.setItem(cacheKey, base64Image);
        console.log('Imagem base64 armazenada em cache local com chave:', cacheKey);
      } catch (error) {
        console.error('Erro ao armazenar imagem base64 em cache local:', error);
      }
    };
    reader.readAsDataURL(file);

    // Enviar o arquivo para o servidor
    setLoading(true);
    console.log('Iniciando upload de logo...', file.name);
    apiServices.uploads.uploadLogo(formDataFile)
      .then(response => {
        console.log('Resposta do servidor após upload:', response);
        
        if (response.success && response.url) {
          // Normalizar URL para garantir que esteja usando o domínio correto em produção
          let logoUrl = response.url;
          
          // Se estamos em produção ou em ambiente que não seja localhost
          if (window.location.hostname !== 'localhost' && logoUrl.includes('localhost')) {
            // Substituir localhost pela URL de produção
            logoUrl = logoUrl.replace(
              /http:\/\/localhost:[0-9]+/,
              window.location.origin
            );
            console.log('URL convertida para produção:', logoUrl);
          }
          
          // Salvar a versão base64 no localStorage com a URL do servidor
          if (logoBase64) {
            saveBase64ToLocalStorage(logoUrl, logoBase64);
          }
          
          // Armazenar a URL da imagem no servidor, mas continuar usando o preview base64 para exibição
          setFormData(prev => ({ ...prev, logo_url: logoUrl }));
          toast.success('Logo enviado com sucesso!');
        } else {
          throw new Error('Resposta inválida do servidor ao fazer upload da imagem');
        }
      })
      .catch(error => {
        console.error('Erro ao enviar logo:', error);
        toast.error('Erro ao enviar logo: ' + (error.message || 'Erro desconhecido'));
        // Se houve erro no upload, manter o preview local mas não definir a URL
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilterOptions(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilterOptions({
      regiao: '',
      estado: '',
      cidade: '',
      segmento: '',
      formato: ''
    });
    setSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('Dados do formulário a serem enviados:', formData);
      
      // Preparar os dados para salvar no servidor
      const cleanFormData = { ...formData };
      
      // 1. Remover parâmetros de timestamp da URL da logo antes de salvar
      if (cleanFormData.logo_url) {
        if (cleanFormData.logo_url.includes('?t=')) {
          cleanFormData.logo_url = cleanFormData.logo_url.split('?t=')[0];
        } else if (cleanFormData.logo_url.includes('&t=')) {
          cleanFormData.logo_url = cleanFormData.logo_url.split('&t=')[0];
        }
        
        // 2. Normalizar a URL para servidor de produção se necessário
        // Isso garante que o caminho do arquivo seja consistente em todos os ambientes
        // Remover a porta do localhost para maior compatibilidade com produção
        if (cleanFormData.logo_url.includes('localhost')) {
          const urlObj = new URL(cleanFormData.logo_url);
          const pathWithFilename = urlObj.pathname; // Pega apenas o caminho /uploads/logos/arquivo.png
          
          // Em produção, usar o domínio atual
          if (window.location.hostname !== 'localhost') {
            cleanFormData.logo_url = `${window.location.origin}${pathWithFilename}`;
            console.log('URL da logo normalizada para produção antes de salvar:', cleanFormData.logo_url);
          }
        }
      }
      
      console.log('Dados limpos a serem enviados:', cleanFormData);
      
      if (editingStream?.id) {
        // Atualizar stream existente
        console.log('Atualizando stream existente com ID:', editingStream.id);
        const response = await apiServices.streams.update(editingStream.id, cleanFormData);
        console.log('Resposta da atualização:', response);
        toast.success('Stream atualizado com sucesso!');
      } else {
        // Criar novo stream
        console.log('Criando novo stream');
        const response = await apiServices.streams.create(cleanFormData);
        console.log('Resposta da criação:', response);
        toast.success('Stream criado com sucesso!');
      }
      
      // Recarregar a lista e resetar o formulário
      fetchStreams();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar stream:', error);
      toast.error('Erro ao salvar stream');
    }
  };

  const handleEdit = (stream: Stream) => {
    setEditingStream(stream);
    setFormData(stream);
    setLogoPreview(null);
    setLogoBase64(null); // Limpar o base64 ao editar
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    
    if (!window.confirm('Tem certeza que deseja excluir este stream?')) {
      return;
    }
    
    try {
      await apiServices.streams.delete(id);
      toast.success('Stream excluído com sucesso!');
      fetchStreams();
    } catch (error) {
      console.error('Erro ao excluir stream:', error);
      toast.error('Erro ao excluir stream');
    }
  };

  const resetForm = () => {
    setEditingStream(null);
    setFormData({
      url: '',
      name: '',
      sheet: '',
      cidade: '',
      estado: '',
      pais: 'Brasil',
      regiao: '',
      segmento: '',
      formato: '',
      frequencia: '',
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: '',
      site: '',
      monitoring_url: '',
      logo_url: '',
      index: ''
    });
    setLogoPreview(null);
    setLogoBase64(null); // Limpar também o base64
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciamento de Streams</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Novo Stream'}
          </button>
        </div>
      </div>

      {/* Formulário de criação/edição */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <Radio className="w-5 h-5 mr-2 text-navy-600" />
            {editingStream ? 'Editar Stream' : 'Novo Stream'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seção de Informações Básicas */}
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-medium mb-4 text-gray-700 dark:text-gray-300">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome da Rádio
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Radio className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequência
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Radio className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="frequencia"
                      value={formData.frequencia}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="104,5 ou 104.5 ou Web"
                      required
                    />
                  </div>
                </div>
                
                {/* Campo de upload de logotipo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Logotipo da Rádio
                  </label>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-24 h-24 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      {(logoPreview || logoBase64 || formData.logo_url) ? (
                        (() => {
                          // Priorizar a versão base64 para evitar problemas de CORS
                          const imageSrc = logoPreview || logoBase64 || normalizeLogoUrl(formData.logo_url);
                          console.log('Exibindo imagem:', 
                            logoPreview ? 'Preview local' : 
                            logoBase64 ? 'Base64 armazenado' : 
                            'URL da logo normalizada', 
                            imageSrc);
                          return (
                            <ImageWithFallback 
                              src={imageSrc || ''} 
                              alt="Logo preview" 
                              className="w-full h-full object-contain"
                            />
                          );
                        })()
                      ) : (
                        <Radio className="w-12 h-12 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <div className="relative">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Selecionar Imagem
                        </button>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 2MB.
                        </p>
                        {formData.logo_url && (
                          <div className="mt-2 flex items-center">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, logo_url: '' }));
                                setLogoPreview(null);
                                setLogoBase64(null); // Limpar também o base64
                              }}
                              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Remover imagem
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL do Stream
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      name="url"
                      value={formData.url}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      required
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL de Monitoramento de Ouvintes
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      name="monitoring_url"
                      value={formData.monitoring_url}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="https://monitoramento.exemplo.com/stats"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome na Planilha
                  </label>
                  <input
                    type="text"
                    name="sheet"
                    value={formData.sheet}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Índice
                  </label>
                  <input
                    type="text"
                    name="index"
                    value={formData.index}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Seção de Localização */}
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-medium mb-4 text-gray-700 dark:text-gray-300 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-navy-600" />
                Localização
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado
                  </label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    required
                  >
                    <option value="">Selecione um estado</option>
                    {ESTADOS.map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    País
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe2 className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="pais"
                      value={formData.pais}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Região
                  </label>
                  <select
                    name="regiao"
                    value={formData.regiao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    required
                  >
                    <option value="">Selecione uma região</option>
                    {REGIOES.map(regiao => (
                      <option key={regiao} value={regiao}>{regiao}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção de Formato */}
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-medium mb-4 text-gray-700 dark:text-gray-300 flex items-center">
                <Music className="w-4 h-4 mr-2 text-navy-600" />
                Formato e Segmento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Formato
                  </label>
                  <textarea
                    name="formato"
                    value={formData.formato}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    rows={2}
                    required
                    placeholder="Ex: Jovem, Pop, Rock"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Segmento (Legado)
                  </label>
                  <textarea
                    name="segmento"
                    value={formData.segmento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                    rows={2}
                    required
                    placeholder="Ex: Jovem, Pop, Rock"
                  />
                </div>
              </div>
            </div>

            {/* Seção de Redes Sociais */}
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-md font-medium mb-4 text-gray-700 dark:text-gray-300">Redes Sociais e Site</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Facebook
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Facebook className="h-4 w-4 text-blue-600" />
                    </div>
                    <input
                      type="url"
                      name="facebook"
                      value={formData.facebook}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Instagram
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Instagram className="h-4 w-4 text-pink-600" />
                    </div>
                    <input
                      type="url"
                      name="instagram"
                      value={formData.instagram}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    X (Twitter)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Twitter className="h-4 w-4 text-gray-700" />
                    </div>
                    <input
                      type="url"
                      name="twitter"
                      value={formData.twitter}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="https://x.com/..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    YouTube
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Youtube className="h-4 w-4 text-red-600" />
                    </div>
                    <input
                      type="url"
                      name="youtube"
                      value={formData.youtube}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Site
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-4 w-4 text-green-600" />
                    </div>
                    <input
                      type="url"
                      name="site"
                      value={formData.site}
                      onChange={handleInputChange}
                      className="pl-10 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors flex items-center"
              >
                <Check className="w-4 h-4 mr-2" />
                {editingStream ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filtros</h2>
            <button
              onClick={resetFilters}
              className="text-sm text-navy-600 hover:text-navy-800 dark:text-navy-400 dark:hover:text-navy-300"
            >
              Limpar filtros
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Região
              </label>
              <select
                name="regiao"
                value={filterOptions.regiao}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todas as regiões</option>
                {REGIOES.map(regiao => (
                  <option key={regiao} value={regiao}>{regiao}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                name="estado"
                value={filterOptions.estado}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todos os estados</option>
                {ESTADOS.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cidade
              </label>
              <select
                name="cidade"
                value={filterOptions.cidade}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todas as cidades</option>
                {uniqueCities.map(cidade => (
                  <option key={cidade} value={cidade}>{cidade}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Formato
              </label>
              <select
                name="formato"
                value={filterOptions.formato}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todos os formatos</option>
                {uniqueFormats.map(formato => (
                  <option key={formato} value={formato}>{formato}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Segmento (Legado)
              </label>
              <select
                name="segmento"
                value={filterOptions.segmento}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todos os segmentos</option>
                {uniqueSegments.map(segmento => (
                  <option key={segmento} value={segmento}>{segmento}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Barra de pesquisa */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nome, frequência, cidade, formato ou segmento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
        />
      </div>

      {/* Tabela de streams */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-navy-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Frequência</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Cidade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Região</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Formato</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-200">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStreams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      Nenhum stream encontrado
                    </td>
                  </tr>
                ) : (
                  filteredStreams.map((stream) => (
                    <tr key={stream.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-10 h-10 mr-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            {stream.logo_url ? (
                              <ImageWithFallback 
                                src={stream.logo_url}
                                alt={`Logo ${stream.name}`} 
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Radio className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{stream.name}</span>
                            {stream.site && (
                              <a 
                                href={stream.site} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-navy-600 hover:underline flex items-center mt-1"
                              >
                                <Globe className="w-3 h-3 mr-1" />
                                Site
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        {stream.frequencia || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.cidade}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.estado}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.regiao}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        <div className="max-w-xs truncate">{stream.formato || stream.segmento}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(stream)}
                            className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(stream.id)}
                            className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 text-sm text-gray-500 dark:text-gray-400">
          Total: {filteredStreams.length} streams
        </div>
      </div>
    </div>
  );
};

export default StreamsManager; 