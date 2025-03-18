import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiServices from '../../services/api';
import { toast } from 'react-toastify';
import { Search, Plus, Edit, Trash2, Radio, Filter, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { cn } from '../../lib/utils';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../ui/alert";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Stream {
  id?: number;
  url: string;
  name: string;
  frequencia: string;
  cidade: string;
  estado: string;
  regiao: string;
  pais: string;
  segmento: string;
  formato: string;
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  site: string;
  monitoring_url: string;
  logo_url: string;
  logo_url_full: string;
  index: string;
}

interface FilterOptions {
  cidade: string;
  estado: string;
  regiao: string;
  formato: string;
  segmento: string;
}

export default function StreamsManager() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    cidade: '',
    estado: '',
    regiao: '',
    formato: '',
    segmento: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [isDevEnvironment, setIsDevEnvironment] = useState(false);
  const [devModeMessage, setDevModeMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado inicial do formulário
  const initialFormState: Stream = {
    url: '',
    name: '',
    frequencia: '',
    cidade: '',
    estado: '',
    regiao: '',
    pais: '',
    segmento: '',
    formato: '',
    instagram: '',
    facebook: '',
    twitter: '',
    youtube: '',
    site: '',
    monitoring_url: '',
    logo_url: '',
    logo_url_full: '',
    index: ''
  };

  const [formData, setFormData] = useState<Stream>(initialFormState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Função para resetar filtros
  const resetFilters = useCallback(() => {
    setFilterOptions({
      cidade: '',
      estado: '',
      regiao: '',
      formato: '',
      segmento: ''
    });
    setSearchTerm('');
    setFilteredStreams(streams);
  }, [streams]);

  const safeFormData = useCallback(() => {
    return Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [key, value === null ? '' : value])
    );
  }, [formData]);

  useEffect(() => {
    const isDev = window.location.hostname === 'localhost';
    setIsDevEnvironment(isDev);
    if (isDev) {
      setDevModeMessage('Você está em ambiente de desenvolvimento. Edições só são permitidas em produção.');
    }
  }, []);

  // Função para normalizar URLs de imagens
  const normalizeImageUrl = useCallback((url: string) => {
    if (!url) return '';
    
    // Se já é uma URL completa
    if (url.startsWith('http')) {
      // Remover duplicação de URLs
      if (url.includes('/uploads/logos/https://')) {
        return url.replace('/uploads/logos/https://', '/');
      }
      if (url.includes('/uploads/logos/http://')) {
        return url.replace('/uploads/logos/http://', '/');
      }
      return url;
    }
    
    // Caso contrário, construir a URL completa
    return `https://songmetrix.com.br/uploads/logos/${url}`;
  }, []);

  const handleApiError = useCallback((error: Error) => {
    if (error.message.includes('só é permitida em ambiente de produção')) {
      toast({
        title: 'Ambiente de Desenvolvimento',
        description: 'Esta ação só é permitida em ambiente de produção.',
        variant: 'warning',
      });
      return;
    }

    toast({
      title: 'Erro',
      description: error.message,
      variant: 'destructive',
    });
  }, [toast]);

  const fetchStreams = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Buscando streams...');
      
      const data = await apiServices.streams.getAll();
      
      if (Array.isArray(data)) {
        setStreams(data);
        setFilteredStreams(data);
        
        // Iniciar pré-carregamento de imagens após obter os streams
        setTimeout(() => {
          preloadImages();
        }, 500);
      } else {
        console.error('Dados recebidos não são um array:', data);
        setStreams([]);
        setFilteredStreams([]);
      }
    } catch (error) {
      console.error('Erro ao carregar streams:', error);
      toast.error('Erro ao carregar os streams. Tente novamente mais tarde.');
      setStreams([]);
      setFilteredStreams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Função para pré-carregar imagens
  const preloadImages = useCallback(async () => {
    if (!streams.length) return;
    
    console.log(`Iniciando pré-carregamento de imagens para ${streams.length} streams`);
    
    const preloadPromises = streams.map(stream => {
      return new Promise<void>((resolve) => {
        if (!stream.logo_url) {
          resolve();
          return;
        }
        
        try {
          const normalizedUrl = normalizeImageUrl(stream.logo_url);
          console.log('Pré-carregando imagem:', normalizedUrl);
          
          const img = new window.Image();
          
          img.onload = () => {
            console.log('Imagem carregada com sucesso:', normalizedUrl);
            resolve();
          };
          
          img.onerror = () => {
            console.error('Erro ao carregar imagem:', normalizedUrl);
            resolve();
          };
          
          img.src = normalizedUrl;
        } catch (error) {
          console.error('Erro ao configurar pré-carregamento:', error);
          resolve();
        }
      });
    });
    
    try {
      await Promise.all(preloadPromises);
      console.log('Pré-carregamento de imagens concluído');
    } catch (error) {
      console.error('Erro durante pré-carregamento de imagens:', error);
    }
  }, [streams, normalizeImageUrl]);

  // Componente para exibir imagem com fallback
  const ImageWithFallback = useCallback(({ src, alt, className }: { src: string; alt: string; className?: string }) => {
    const [error, setError] = useState(false);
    const normalizedSrc = normalizeImageUrl(src);

    if (error) {
      return <Radio className="w-6 h-6 text-gray-400" />;
    }

    return (
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        onError={() => setError(true)}
      />
    );
  }, [normalizeImageUrl]);

  useEffect(() => {
    const isDev = window.location.hostname === 'localhost';
    setIsDevEnvironment(isDev);
    if (isDev) {
      setDevModeMessage('Você está em ambiente de desenvolvimento. Edições só são permitidas em produção.');
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      console.log('Usuário não autenticado');
      return;
    }

    console.log('Usuário autenticado, carregando dados...');
    fetchStreams();
    
    // Verificar se o token está sendo obtido corretamente
    const checkToken = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        console.log('Token de autenticação disponível:', !!token);
        
        if (token) {
          // Verificar se o token está sendo armazenado corretamente
          const storedToken = localStorage.getItem('token');
          if (!storedToken) {
            console.log('Armazenando token do Supabase no localStorage');
            localStorage.setItem('token', token);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar token:', error);
      }
    };
    
    checkToken();
  }, [currentUser, fetchStreams]);

  useEffect(() => {
    if (streams.length > 0) {
      preloadImages();
    }
  }, [streams, preloadImages]);

  // Função para aplicar filtros
  const applyFilters = useCallback(() => {
    let filtered = [...streams];

    // Aplicar filtro de busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(stream => 
        stream.name.toLowerCase().includes(searchLower) ||
        stream.cidade.toLowerCase().includes(searchLower) ||
        stream.estado.toLowerCase().includes(searchLower) ||
        stream.regiao.toLowerCase().includes(searchLower) ||
        stream.segmento.toLowerCase().includes(searchLower) ||
        stream.formato.toLowerCase().includes(searchLower)
      );
    }

    // Aplicar outros filtros
    if (filterOptions.cidade) {
      filtered = filtered.filter(stream => stream.cidade === filterOptions.cidade);
    }
    if (filterOptions.estado) {
      filtered = filtered.filter(stream => stream.estado === filterOptions.estado);
    }
    if (filterOptions.regiao) {
      filtered = filtered.filter(stream => stream.regiao === filterOptions.regiao);
    }
    if (filterOptions.formato) {
      filtered = filtered.filter(stream => stream.formato === filterOptions.formato);
    }
    if (filterOptions.segmento) {
      filtered = filtered.filter(stream => stream.segmento === filterOptions.segmento);
    }

    setFilteredStreams(filtered);
  }, [streams, searchTerm, filterOptions]);

  // Efeito para aplicar filtros quando os critérios mudam
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Função para limpar todos os filtros
  const handleResetFilters = () => {
    resetFilters();
    applyFilters();
  };

  // Função para lidar com mudanças nos campos do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Função para lidar com o clique no botão de novo stream
  const handleNewStreamClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    resetForm();
    setShowForm(true);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilterOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) {
      return;
    }

    const file = e.target.files[0];
    
    // Verificar tamanho do arquivo (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. O tamanho máximo permitido é 2MB.');
      return;
    }
    
    // Verificar tipo do arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo deve ser uma imagem.');
      return;
    }

    // Obter a extensão do arquivo original
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    
    // Criar um nome de arquivo baseado no nome da rádio
    const radioName = safeFormData().name.trim();
    const radioId = editingStream?.id;
    
    // Garantir que o nome do arquivo seja único para esta rádio
    let fileName = radioName 
      ? `${radioName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${radioId || new Date().getTime()}.${fileExtension}`
      : `radio_${radioId || new Date().getTime()}.${fileExtension}`;
    
    console.log('Nome do arquivo gerado para upload:', fileName);

    // Mostrar preview da imagem com base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target?.result as string;
      setLogoPreview(base64Image);
      
      // Armazenar temporariamente a URL da imagem em base64 para uso no formulário
      // Isso permite que o usuário veja a imagem mesmo se o upload falhar
      setFormData(prev => ({ ...prev, logo_url: base64Image }));
    };
    reader.readAsDataURL(file);

    // Verificar se estamos em ambiente de produção
    const isProduction = window.location.hostname !== 'localhost';
    
    // Se não estamos em produção, não tentar fazer upload para o servidor
    if (!isProduction) {
      console.log('Ambiente de desenvolvimento detectado. Upload de imagem será feito apenas em produção.');
      toast.info('Em ambiente de desenvolvimento, a imagem será armazenada temporariamente.');
      setLoading(false);
      return;
    }

    // Criar um objeto FormData para enviar o arquivo
    const formDataFile = new FormData();
    formDataFile.append('logo', file);
    formDataFile.append('fileName', fileName);
    formDataFile.append('radioId', String(radioId || ''));
    formDataFile.append('radioName', radioName);

    // Enviar o arquivo para o servidor
    setLoading(true);
    console.log('Iniciando upload de logo...', fileName, 'para rádio:', radioName, 'ID:', radioId);
    
    try {
      // Obter o token diretamente do Supabase para garantir que esteja atualizado
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Token de autenticação não disponível');
      }
      
      // Usar o serviço de API para upload de logo
      const data = await apiServices.uploads.uploadLogo(formDataFile);
      console.log('Resposta do servidor após upload:', data);
      
      if (data.success && data.url) {
        // Normalizar URL para garantir que esteja usando o domínio correto em produção
        let logoUrl = data.url;
        
        // Converter para HTTPS se necessário
        if (logoUrl.startsWith('http:')) {
          logoUrl = logoUrl.replace('http:', 'https:');
        }
        
        // Armazenar a URL da imagem no servidor
        setFormData(prev => ({ ...prev, logo_url: logoUrl, logo_url_full: logoUrl }));
        toast.success('Logo enviado com sucesso!');
      } else {
        throw new Error('Resposta inválida do servidor ao fazer upload da imagem');
      }
    } catch (error) {
      handleApiError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Verificar campos obrigatórios
      if (!safeFormData().name || !safeFormData().url) {
        toast.error('Nome e URL são campos obrigatórios');
        setLoading(false);
        return;
      }
      
      // Criar uma cópia limpa dos dados para enviar ao servidor
      const cleanFormData = { ...safeFormData() };
      
      // Verificar se estamos em ambiente de produção
      const isProduction = window.location.hostname !== 'localhost';
      
      // Verificar se a logo_url é uma string base64 (upload local que falhou no servidor)
      if (cleanFormData.logo_url && cleanFormData.logo_url.startsWith('data:image')) {
        // Se estamos editando um stream existente, manter a URL original da logo
        if (editingStream?.id && editingStream.logo_url) {
          console.log('Mantendo URL original da logo para o stream existente:', editingStream.logo_url);
          cleanFormData.logo_url = editingStream.logo_url;
        } else if (isProduction) {
          // Se é um novo stream em produção, remover a URL base64 para evitar problemas no servidor
          console.log('Removendo URL base64 da logo para novo stream em produção');
          cleanFormData.logo_url = '';
          toast.warning('A imagem não pôde ser enviada para o servidor. Por favor, tente novamente mais tarde.');
        } else {
          // Em ambiente de desenvolvimento, apenas informar que a imagem não será salva
          console.log('Ambiente de desenvolvimento: imagem base64 não será salva no servidor');
          cleanFormData.logo_url = '';
          toast.info('Em ambiente de desenvolvimento, a imagem não é salva permanentemente.');
        }
      }
      
      // Limpar URLs de timestamp e corrigir protocolos
      if (cleanFormData.logo_url && !cleanFormData.logo_url.startsWith('data:')) {
        // Remover parâmetros de timestamp
        if (cleanFormData.logo_url.includes('?t=')) {
          cleanFormData.logo_url = cleanFormData.logo_url.split('?t=')[0];
        } else if (cleanFormData.logo_url.includes('&t=')) {
          cleanFormData.logo_url = cleanFormData.logo_url.split('&t=')[0];
        }
        
        // Corrigir protocolos
        if (cleanFormData.logo_url.includes('localhost:3001')) {
          // Em ambiente local, usar HTTP para localhost
          cleanFormData.logo_url = cleanFormData.logo_url.replace('https://localhost:3001', 'http://localhost:3001');
        } else if (cleanFormData.logo_url.includes('songmetrix.com.br')) {
          // Em produção, usar HTTPS para o domínio de produção
          cleanFormData.logo_url = cleanFormData.logo_url.replace('http://songmetrix.com.br', 'https://songmetrix.com.br');
        }
      }
      
      console.log('Dados do formulário a serem enviados:', safeFormData());
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
      handleApiError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (stream: Stream) => {
    setEditingStream(stream);
    setFormData(stream);
    setLogoPreview(null);
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
      handleApiError(error as Error);
    }
  };

  const resetForm = () => {
    setEditingStream(null);
    setFormData(initialFormState);
    setLogoPreview(null);
    setShowForm(false);
  };

  return (
    <div className={cn("container mx-auto p-4")}>
      {isDevEnvironment && (
        <Alert variant="warning" className={cn("mb-4")}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ambiente de Desenvolvimento</AlertTitle>
          <AlertDescription>
            {devModeMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {showForm && (
        <Card className={cn("mb-6")}>
          <CardHeader>
            <CardTitle>
              {editingStream ? 'Editar Stream' : 'Novo Stream'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className={cn("space-y-6")}>
              <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6")}>
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Nome da Rádio *
                  </Label>
                  <Input
                    type="text"
                    name="name"
                    value={safeFormData().name}
                    onChange={handleInputChange}
                    required
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    URL do Stream *
                  </Label>
                  <Input
                    type="text"
                    name="url"
                    value={safeFormData().url}
                    onChange={handleInputChange}
                    required
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Frequência
                  </Label>
                  <Input
                    type="text"
                    name="frequencia"
                    value={safeFormData().frequencia}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Cidade *
                  </Label>
                  <Input
                    type="text"
                    name="cidade"
                    value={safeFormData().cidade}
                    onChange={handleInputChange}
                    required
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Estado *
                  </Label>
                  <Input
                    type="text"
                    name="estado"
                    value={safeFormData().estado}
                    onChange={handleInputChange}
                    required
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Região *
                  </Label>
                  <Input
                    type="text"
                    name="regiao"
                    value={safeFormData().regiao}
                    onChange={handleInputChange}
                    required
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    País
                  </Label>
                  <Input
                    type="text"
                    name="pais"
                    value={safeFormData().pais}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Segmento *
                  </Label>
                  <Input
                    type="text"
                    name="segmento"
                    value={safeFormData().segmento}
                    onChange={handleInputChange}
                    required
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Formato
                  </Label>
                  <Input
                    type="text"
                    name="formato"
                    value={safeFormData().formato}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Site
                  </Label>
                  <Input
                    type="text"
                    name="site"
                    value={safeFormData().site}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Instagram
                  </Label>
                  <Input
                    type="text"
                    name="instagram"
                    value={safeFormData().instagram}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Facebook
                  </Label>
                  <Input
                    type="text"
                    name="facebook"
                    value={safeFormData().facebook}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    X/Twitter
                  </Label>
                  <Input
                    type="text"
                    name="twitter"
                    value={safeFormData().twitter}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    YouTube
                  </Label>
                  <Input
                    type="text"
                    name="youtube"
                    value={safeFormData().youtube}
                    onChange={handleInputChange}
                    className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                  />
                </div>
                
                <div>
                  <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                    Logo
                  </Label>
                  <div className={cn("flex items-center space-x-4")}>
                    <Input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className={cn("hidden")}
                    />
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn("px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600")}
                    >
                      Selecionar Imagem
                    </Button>
                    {(logoPreview || safeFormData().logo_url) && (
                      <div className={cn("w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center")}>
                        <img 
                          src={logoPreview || safeFormData().logo_url}
                          alt="Logo Preview" 
                          className={cn("w-full h-full object-contain")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className={cn("pt-4")}>
                <Button
                  type="submit"
                  className={cn("px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors")}
                  disabled={loading}
                >
                  {loading ? (
                    <div className={cn("w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto")}></div>
                  ) : (
                    editingStream ? 'Atualizar Stream' : 'Criar Stream'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className={cn("flex justify-between items-center")}>
        <div className={cn("flex items-center space-x-4")}>
          <div className={cn("relative")}>
            <Input
              type="text"
              placeholder="Buscar streams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn("pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
            />
            <Search className={cn("w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2")}/>
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-navy-600 dark:hover:text-navy-400")}
          >
            <Filter className={cn("w-5 h-5")}/>
            Filtros
          </Button>
        </div>
        <Button
          onClick={handleNewStreamClick}
          className={cn("flex items-center gap-2 px-3 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors")}
        >
          <Plus className={cn("w-4 h-4")}/>
          Novo Stream
        </Button>
      </div>

      {/* Área de filtros */}
      {showFilters && (
        <Card className={cn("mt-4")}>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("grid grid-cols-1 md:grid-cols-5 gap-4")}>
              <div>
                <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                  Cidade
                </Label>
                <select
                  name="cidade"
                  value={filterOptions.cidade}
                  onChange={handleFilterChange}
                  className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                >
                  <option value="">Todas</option>
                  {Array.from(new Set(streams.map(s => s.cidade))).sort().map(cidade => (
                    <option key={cidade} value={cidade}>{cidade}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                  Estado
                </Label>
                <select
                  name="estado"
                  value={filterOptions.estado}
                  onChange={handleFilterChange}
                  className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                >
                  <option value="">Todos</option>
                  {Array.from(new Set(streams.map(s => s.estado))).sort().map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                  Região
                </Label>
                <select
                  name="regiao"
                  value={filterOptions.regiao}
                  onChange={handleFilterChange}
                  className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                >
                  <option value="">Todas</option>
                  {Array.from(new Set(streams.map(s => s.regiao))).sort().map(regiao => (
                    <option key={regiao} value={regiao}>{regiao}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                  Formato
                </Label>
                <select
                  name="formato"
                  value={filterOptions.formato}
                  onChange={handleFilterChange}
                  className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                >
                  <option value="">Todos</option>
                  {Array.from(new Set(streams.map(s => s.formato))).sort().map(formato => (
                    <option key={formato} value={formato}>{formato}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className={cn("block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1")}>
                  Segmento
                </Label>
                <select
                  name="segmento"
                  value={filterOptions.segmento}
                  onChange={handleFilterChange}
                  className={cn("w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500")}
                >
                  <option value="">Todos</option>
                  {Array.from(new Set(streams.map(s => s.segmento))).sort().map(segmento => (
                    <option key={segmento} value={segmento}>{segmento}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={cn("mt-4 flex justify-end")}>
              <Button
                onClick={handleResetFilters}
                variant="outline"
                className={cn("text-gray-600 dark:text-gray-300 hover:text-navy-600 dark:hover:text-navy-400")}
              >
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de streams */}
      <Card className={cn("mt-6")}>
        <CardHeader>
          <CardTitle>Streams</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className={cn("flex justify-center items-center p-8")}>
              <div className={cn("w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin")}></div>
            </div>
          ) : (
            <div className={cn("overflow-x-auto")}>
              <table className={cn("min-w-full divide-y divide-gray-200 dark:divide-gray-700")}>
                <thead className={cn("bg-gray-50 dark:bg-gray-800")}>
                  <tr>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Logo</th>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Nome</th>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Cidade</th>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Estado</th>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Região</th>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Formato</th>
                    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Segmento</th>
                    <th className={cn("px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider")}>Ações</th>
                  </tr>
                </thead>
                <tbody className={cn("bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700")}>
                  {filteredStreams.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={cn("px-4 py-6 text-center text-gray-500 dark:text-gray-400")}>
                        Nenhum stream encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredStreams.map((stream, index) => (
                      <tr key={stream.id || index} className={cn("hover:bg-gray-50 dark:hover:bg-gray-800")}>
                        <td className={cn("px-4 py-3 whitespace-nowrap")}>
                          <div className={cn("w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800")}>
                            <ImageWithFallback
                              src={stream.logo_url}
                              alt={`Logo ${stream.name}`}
                              className={cn("w-full h-full object-contain")}
                            />
                          </div>
                        </td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100")}>{stream.name}</td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400")}>{stream.cidade}</td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400")}>{stream.estado}</td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400")}>{stream.regiao}</td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400")}>{stream.formato}</td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400")}>{stream.segmento}</td>
                        <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-right")}>
                          <div className={cn("flex justify-end space-x-2")}>
                            <Button
                              onClick={() => handleEdit(stream)}
                              variant="ghost"
                              size="sm"
                              className={cn("text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300")}
                              title="Editar"
                            >
                              <Edit className="w-5 h-5" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(stream.id)}
                              variant="ghost"
                              size="sm"
                              className={cn("text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300")}
                              title="Excluir"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className={cn("mt-4 text-sm text-gray-500 dark:text-gray-400")}>
                Total: {filteredStreams.length} streams
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}