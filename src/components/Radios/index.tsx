import React, { useState, useEffect, useRef } from 'react';
import { Star, Radio, Loader2, ArrowUpDown, Search, MapPin, Music3 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { RadioStatus } from '../../types/components';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFavoriteRadios } from '../../hooks/useFavoriteRadios'; // Importando o hook
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { AudioPlayer } from './AudioPlayer'; // Importar o AudioPlayer

export default function Radios() {
  const { currentUser, planId } = useAuth();
  const { refresh } = useFavoriteRadios(); // Adicionando a chamada ao hook
  const isAdmin = planId === 'ADMIN';
  console.log({ isAdmin }); // Log para verificar status de admin
  const [radios, setRadios] = useState<RadioStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para controlar o player
  const [currentlyPlayingUrl, setCurrentlyPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null); // Ref para o elemento audio

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
    }
  }, [currentUser]);

  // Lógica para controlar o elemento <audio> único
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleAudioError = (e: Event) => {
        console.error("Erro no elemento de áudio:", e);
        // Tenta resetar se houver erro ao tocar (ex: URL inválida)
        setCurrentlyPlayingUrl(null);
    };

    // Adiciona listener de erro
    audioElement.addEventListener('error', handleAudioError);

    if (currentlyPlayingUrl) {
      console.log(`[Audio Control] Tocando: ${currentlyPlayingUrl}`);
      if (audioElement.src !== currentlyPlayingUrl) {
        audioElement.src = currentlyPlayingUrl;
        audioElement.load(); // Necessário após mudar src
      }
      // Tenta tocar e captura erros potenciais
      audioElement.play().catch(error => {
        console.error("[Audio Control] Erro ao tentar tocar:", error);
        setCurrentlyPlayingUrl(null); // Reseta se o play falhar
      });
    } else {
      console.log("[Audio Control] Parando áudio.");
      audioElement.pause();
      // Define src como vazio para parar o download/buffering
      // Verificar se isso não causa problemas com a remoção do atributo
      if (audioElement.hasAttribute('src')) {
          audioElement.removeAttribute('src'); // Mais seguro para parar completamente
          audioElement.load(); // Garante que o estado de 'sem src' seja aplicado
      }
    }

    // Cleanup: remove listener de erro ao desmontar ou antes de re-executar
    return () => {
        if (audioElement) {
            audioElement.removeEventListener('error', handleAudioError);
        }
    };
  }, [currentlyPlayingUrl]); // Re-executa quando a URL para tocar muda

  // Função chamada pelo botão do AudioPlayer
  const handlePlayToggle = (url: string | null) => {
    console.log(`[handlePlayToggle] Solicitado para tocar/parar: ${url}`);
    // Se a URL clicada é a mesma que está tocando, para (passa null).
    // Se for diferente ou nenhuma estiver tocando, define a nova URL.
    setCurrentlyPlayingUrl(prevUrl => (prevUrl === url ? null : url));
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchRadios = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/status', { headers });
      
      if (!response.ok) throw new Error('Failed to fetch radios');
      
      const data = await response.json();
      setRadios(data);
    } catch (error) {
      console.error('Error fetching radios:', error);
      setError('Erro ao carregar as rádios. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (radioName: string, currentFavorite: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/radios/favorite', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          radioName,
          favorite: !currentFavorite
        })
      });

      if (!response.ok) throw new Error('Failed to update favorite status');

      // Força uma atualização do token
      await supabase.auth.refreshSession();
      
      // Update local state and refresh favorite radios
      setRadios(prevRadios => 
        prevRadios.map(radio => 
          radio.name === radioName 
            ? { ...radio, isFavorite: !currentFavorite }
            : radio
        )
      );
      
      // Aguarda um momento para garantir que o token foi atualizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await refresh(); // Refresh favorite radios
    } catch (error) {
      console.error('Error updating favorite status:', error);
      setError('Erro ao atualizar favoritos. Por favor, tente novamente.');
    }
  };

  const formatLastUpdate = (lastUpdate: string) => {
    try {
      const date = new Date(lastUpdate);
      return {
        full: format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        relative: formatDistanceToNow(date, { locale: ptBR, addSuffix: true })
      };
    } catch (error) {
      return {
        full: 'Data indisponível',
        relative: 'Data indisponível'
      };
    }
  };

  // Estados para o novo design de tabela
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<'name' | 'status' | 'lastUpdate'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Carregando rádios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-lg">
        {error}
      </div>
    );
  }

  // Função para ordenar as rádios
  const sortedRadios = [...radios].sort((a, b) => {
    if (sortColumn === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortColumn === 'status' && isAdmin) {
      return sortDirection === 'asc'
        ? a.status.localeCompare(b.status)
        : b.status.localeCompare(a.status);
    } else {
      const dateA = new Date(a.lastUpdate).getTime();
      const dateB = new Date(b.lastUpdate).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

  // Função para filtrar as rádios pelo termo de busca
  const filteredRadios = sortedRadios.filter(radio => 
    radio.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Função para alternar a direção da ordenação
  const toggleSort = (column: 'name' | 'status' | 'lastUpdate') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Elemento de áudio único e oculto */}
      {/* Adicionamos 'controls' temporariamente para debug visual se necessário */}
      <audio ref={audioRef} preload="none" className="hidden"></audio>

      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div></div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar rádio..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-800 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => toggleSort('name')}
                  className="flex items-center gap-1 font-medium"
                >
                  Nome
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              {isAdmin && (
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => toggleSort('status')}
                    className="flex items-center gap-1 font-medium"
                  >
                    Status
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {isAdmin && (
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => toggleSort('lastUpdate')}
                    className="flex items-center gap-1 font-medium"
                  >
                    Última Transmissão
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              <TableHead>
                <span className="flex items-center gap-1 font-medium pl-2">
                  <MapPin className="h-4 w-4" />
                  Localização
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1 font-medium pl-2">
                  <Music3 className="h-4 w-4" />
                  Formato
                </span>
              </TableHead>
              {isAdmin && (
                <TableHead className="w-[160px]">
                   <span className="flex items-center gap-1 font-medium pl-2">
                     Ouvir
                   </span>
                </TableHead>
              )}
              <TableHead className="text-right">Favorito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRadios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 5} className="h-24 text-center">
                  Nenhuma rádio encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredRadios.map((radio) => {
                const isPlaying = radio.streamUrl === currentlyPlayingUrl && radio.streamUrl !== undefined; // Verifica se esta rádio está tocando e tem URL
                const { full: fullDate, relative: relativeDate } = formatLastUpdate(radio.lastUpdate);
                const rowClass = radio.isFavorite ? 'bg-blue-50 dark:bg-blue-900/20' : '';
                console.log('Renderizando Radio:', radio.name, 'Stream URL:', radio.streamUrl); // Log para verificar URL
                return (
                  <TableRow key={radio.name} className={rowClass}>
                    <TableCell>
                      <Star 
                        className={`cursor-pointer ${radio.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}
                        onClick={() => toggleFavorite(radio.name, radio.isFavorite)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{radio.name}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${radio.status === 'ONLINE' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}`}>
                          {radio.status}
                        </span>
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        <div title={fullDate}>{relativeDate}</div>
                      </TableCell>
                    )}
                    <TableCell>{radio.city || '-'} / {radio.state || '-'}</TableCell>
                    <TableCell>{radio.formato || '-'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <AudioPlayer
                          streamUrl={radio.streamUrl}
                          isPlaying={isPlaying} // Passa se esta rádio está tocando
                          onPlayToggle={handlePlayToggle} // Passa a função de controle
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <button
                        onClick={() => toggleFavorite(radio.name, radio.isFavorite)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            radio.isFavorite
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
