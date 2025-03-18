import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
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
}

export default function StreamsManager() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [isDevEnvironment, setIsDevEnvironment] = useState(false);
  const [devModeMessage, setDevModeMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedStreams = useRef(false);

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
  };

  const [formData, setFormData] = useState<Stream>(initialFormState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Função para verificar se uma imagem está acessível
  const checkImageExists = useCallback(async (url: string): Promise<boolean> => {
    if (!url) return false;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Erro ao verificar imagem:', error);
      return false;
    }
  }, []);

  // Função para tentar diferentes variações de URLs para uma imagem
  const findAccessibleImageUrl = useCallback(async (baseUrl: string, fileName: string): Promise<string | null> => {
    if (!baseUrl) return null;
    
    // Verificar se a URL já está duplicada
    const isDuplicated = baseUrl.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/');
    
    // Corrigir URL duplicada
    let cleanBaseUrl = baseUrl;
    if (isDuplicated) {
      cleanBaseUrl = baseUrl.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
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
    console.log('Pré-carregando imagens...');
    
    const imagePromises = streamsToPreload
      .filter(stream => stream.logo_url)
      .map(async stream => {
        // Verificar se a URL está duplicada e corrigir
        let cleanUrl = stream.logo_url;
        if (stream.logo_url && stream.logo_url.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/')) {
          cleanUrl = stream.logo_url.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
          console.log('URL duplicada corrigida durante pré-carregamento:', cleanUrl);
        }
        
        // Verificar diretamente se a imagem existe
        const exists = await checkImageExists(cleanUrl);
        if (exists) {
          return cleanUrl;
        }
        
        // Se não existir, tentar encontrar uma URL acessível
        const fileName = cleanUrl.split('/').pop() || '';
        return findAccessibleImageUrl(cleanUrl, fileName);
      });
    
    // Aguardar todas as promessas de URLs acessíveis
    const accessibleUrls = await Promise.all(imagePromises);
    
    // Filtrar URLs nulas
    const validUrls = accessibleUrls.filter(url => url !== null) as string[];
    
    console.log(`Encontradas ${validUrls.length} URLs acessíveis para pré-carregamento`);
    
    // Pré-carregar as imagens válidas
    let loadedCount = 0;
    const totalImages = validUrls.length;
    
    return new Promise<void>((resolve) => {
      if (totalImages === 0) {
        console.log('Nenhuma imagem para pré-carregar');
        resolve();
        return;
      }
      
      validUrls.forEach(imageUrl => {
        const img = new Image();
        
        img.onload = () => {
          loadedCount++;
          console.log(`Pré-carregada imagem ${loadedCount}/${totalImages}: ${imageUrl}`);
          
          if (loadedCount === totalImages) {
            console.log('Pré-carregamento de imagens concluído');
            resolve();
          }
        };
        
        img.onerror = () => {
          loadedCount++;
          console.log(`Erro ao carregar imagem: ${imageUrl}`);
          
          if (loadedCount === totalImages) {
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

  // Função para buscar streams
  const fetchStreams = useCallback(async () => {
    if (loading || hasLoadedStreams.current) return;
    
    try {
      setLoading(true);
      console.log('Buscando streams...');
      
      // Verificar se o usuário está autenticado
      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }
      
      const data = await apiServices.streams.getAll();
      
      if (Array.isArray(data)) {
        setStreams(data);
        setFilteredStreams(data);
        
        // Pré-carregar imagens após obter os streams
        await preloadImages(data);
        hasLoadedStreams.current = true;
      } else {
        console.error('Dados recebidos não são um array:', data);
        setStreams([]);
        setFilteredStreams([]);
      }
    } catch (error) {
      handleApiError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, handleApiError, loading, preloadImages]);

  // Efeito para carregar streams quando o usuário estiver autenticado
  useEffect(() => {
    if (currentUser && !hasLoadedStreams.current) {
      console.log('Usuário autenticado, carregando dados...');
      fetchStreams();
    }
  }, [currentUser, fetchStreams]);

  // Verificar ambiente no carregamento do componente
  useEffect(() => {
    const checkEnvironment = () => {
      const isDev = window.location.hostname === 'localhost';
      setIsDevEnvironment(isDev);
      
      if (isDev) {
        setDevModeMessage('Você está em ambiente de desenvolvimento. O upload de imagens só funciona em produção.');
        console.log('Ambiente de desenvolvimento detectado. Upload de imagens desativado.');
      } else {
        console.log('Ambiente: produção');
      }
    };
    
    checkEnvironment();
  }, []);

  // Componente para exibir imagem com fallback
  const ImageWithFallback = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
    const [error, setError] = useState(false);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const verificationRef = useRef(false);
    const isMounted = useRef(true);
    
    useEffect(() => {
      // Resetar o estado quando a fonte muda
      setError(false);
      verificationRef.current = false;
      
      const verifyImage = async () => {
        // Se não há src ou já verificamos, não fazer nada
        if (!src || verificationRef.current || !isMounted.current) return;
        
        try {
          verificationRef.current = true;
          
          // Verificar se a URL está duplicada e corrigir
          let cleanSrc = src;
          if (src.includes('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/')) {
            cleanSrc = src.replace('https://songmetrix.com.br/uploads/logos/https://songmetrix.com.br/uploads/logos/', 'https://songmetrix.com.br/uploads/logos/');
            console.log('URL duplicada corrigida:', cleanSrc);
          }
          
          // Verificar diretamente se a imagem existe
          const exists = await checkImageExists(cleanSrc);
          
          if (!isMounted.current) return;
          
          if (exists) {
            setImgSrc(cleanSrc);
            setError(false);
          } else {
            // Se a URL direta não funcionar, tentar encontrar uma URL acessível
            const fileName = cleanSrc.split('/').pop() || '';
            const accessibleUrl = await findAccessibleImageUrl(cleanSrc, fileName);
            
            if (!isMounted.current) return;
            
            if (accessibleUrl) {
              setImgSrc(accessibleUrl);
              setError(false);
            } else {
              console.warn(`Nenhuma URL acessível encontrada para: ${cleanSrc}`);
              setError(true);
            }
          }
        } catch (err) {
          if (isMounted.current) {
            console.error('Erro ao verificar imagem:', err);
            setError(true);
          }
        }
      };
      
      verifyImage();
      
      // Limpar quando o componente for desmontado
      return () => {
        isMounted.current = false;
        verificationRef.current = false;
      };
    }, [src]);
    
    if (error || !imgSrc) {
      return (
        <div className={`bg-gray-200 flex items-center justify-center ${className || 'w-12 h-12'}`}>
          <Radio className="w-6 h-6 text-gray-400" />
        </div>
      );
    }
    
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={() => {
          if (isMounted.current) {
            setError(true);
          }
        }}
      />
    );
  };

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
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingStream(null);
              setFormData(initialFormState);
              setLogoPreview(null);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Stream
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStream ? 'Editar Stream' : 'Adicionar Stream'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (editingStream) {
                  await apiServices.streams.update(editingStream.id!, formData);
                  toast.success('Stream atualizada com sucesso!');
                } else {
                  await apiServices.streams.create(formData);
                  toast.success('Stream criada com sucesso!');
                }
                setFormData(initialFormState);
                setEditingStream(null);
                setLogoPreview(null);
                fetchStreams();
              } catch (error) {
                handleApiError(error as Error);
              }
            }}>
              <div className="grid grid-cols-2 gap-4">
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
                            const formDataFile = new FormData();
                            formDataFile.append('file', file);
                            formDataFile.append('name', formData.name);

                            const uploadResult = await apiServices.uploads.uploadLogo(formDataFile);
                            
                            if (uploadResult.url) {
                              setFormData({ ...formData, logo_url: uploadResult.url });
                              setLogoPreview(uploadResult.url);
                              toast.success('Logo carregada com sucesso!');
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
                            setEditingStream(stream);
                            setFormData(stream);
                            setLogoPreview(stream.logo_url);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (window.confirm('Tem certeza que deseja excluir esta stream?')) {
                              try {
                                await apiServices.streams.delete(stream.id!);
                                toast.success('Stream excluída com sucesso!');
                                fetchStreams();
                              } catch (error) {
                                handleApiError(error as Error);
                              }
                            }
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