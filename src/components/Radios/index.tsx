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

  // 🔥 CARREGAR FAVORITOS SALVOS NO BANCO DE DADOS (Supabase) NA INICIALIZAÇÃO
  useEffect(() => {
    console.log('[Radios] 🔄 useEffect executado - currentUser:', !!currentUser);
    console.log('[Radios] 👤 currentUser details:', {
      id: currentUser?.id,
      email: currentUser?.email,
      hasMetadata: !!currentUser?.user_metadata,
      metadataKeys: currentUser?.user_metadata ? Object.keys(currentUser.user_metadata) : []
    });

    if (currentUser) {
      // 🔄 Função para carregar dados completos
      const loadData = async () => {
        try {
          setLoading(true);

          // 1️⃣ 🔍 CARREGAR FAVORITOS DO SUPABASE (prioritário)
          const userFavorites = Array.isArray(currentUser.user_metadata?.favorite_radios)
            ? currentUser.user_metadata.favorite_radios
            : [];
          console.log('[Radios] 📋 Favoritos carregados do Supabase (favorite_radios):', userFavorites);
          console.log('[Radios] 🔍 Metadados completos do usuário:', currentUser.user_metadata);

          // 🔥 DIAGNOSTICAR PERSISTÊNCIA APÓS REFRESH
          console.log('[Radios] 🔄 DIAGNÓSTICO DE PERSISTÊNCIA:');
          console.log('[Radios] 📊 Favorite_radios no metadata:', currentUser.user_metadata?.favorite_radios);
          console.log('[Radios] 📊 Favorite_segments no metadata:', currentUser.user_metadata?.favorite_segments);
          console.log('[Radios] 📊 Última atualização do usuário:', currentUser.updated_at);
          console.log('[Radios] 📊 Timestamp atual:', new Date().toISOString());

          // 🔥 LOG PARA DIAGNOSTICAR: Verificar segmentos selecionados no primeiro login
          const userSegments = Array.isArray(currentUser.user_metadata?.favorite_segments)
            ? currentUser.user_metadata.favorite_segments
            : [];
          console.log('[Radios] 🎯 Segmentos selecionados no primeiro login (favorite_segments):', userSegments);

          // 2️⃣ 📡 BUSCAR RÁDIOS DA API
          const headers = await getAuthHeaders();
          const response = await fetch('/api/radios/status', { headers });

          if (!response.ok) throw new Error('Failed to fetch radios');

          const radiosData = await response.json();
          console.log('[Radios] 📡 Rádios retornadas pela API:', radiosData.length);

          // 🔥 LOG PARA DIAGNOSTICAR: Mostrar formatos das rádios
          console.log('[Radios] 📊 Formatos das primeiras 5 rádios:', radiosData.slice(0, 5).map((r: any) => ({ name: r.name, formato: r.formato })));

          // 3️⃣ 🔄 SINCRONIZAR FAVORITOS COM ESTADO - VERIFICAÇÃO DETALHADA
          const radiosWithFavorites = (radiosData as any[]).map((radio: any): RadioStatus => {
            // 🔥 CORREÇÃO: Verificar tanto favoritos individuais quanto baseados em segmentos
            const isIndividualFavorite = userFavorites.includes(radio.name);
            const isExplicitlyNotFavorite = userFavorites.includes(`!${radio.name}`);
            const isSegmentFavorite = userSegments.includes(radio.formato) && !isExplicitlyNotFavorite;

            // 🔥 Lógica final: favorito se é favorito individual OU favorito por segmento (mas não explicitamente removido)
            const isFavorite = isIndividualFavorite || isSegmentFavorite;

            console.log('[Radios] 🔄 Radio:', radio.name, '- Formato:', radio.formato);
            console.log('[Radios] 📊 Favorites check - Individual:', isIndividualFavorite, '- Explicitly Not:', isExplicitlyNotFavorite, '- Segment:', isSegmentFavorite, '- Final:', isFavorite);
            console.log('[Radios] 🎯 User segments:', userSegments, '- Radio format in segments:', userSegments.includes(radio.formato));
            return {
              ...radio,
              isFavorite: isFavorite
            };
          });

          // 4️⃣ 📊 VERIFICAÇÃO FINAL DOS FAVORITOS APLICADOS
          const favoriteCount = radiosWithFavorites.filter(r => r.isFavorite).length;
          console.log('[Radios] ✅ Rádios carregadas com', favoriteCount, 'favoritas aplicadas');

          // 🔥 DETALHES DOS FAVORITOS APLICADOS
          const favoritesDetails = radiosWithFavorites.filter(r => r.isFavorite).map(r => ({
            name: r.name,
            formato: r.formato,
            isIndividual: userFavorites.includes(r.name),
            isSegment: userSegments.includes(r.formato),
            isNotExplicit: !userFavorites.includes(`!${r.name}`)
          }));
          console.log('[Radios] 📋 Detalhes dos favoritos aplicados:', favoritesDetails);

          // 🔥 VERIFICAÇÃO DE PERSISTÊNCIA APÓS REFRESH
          console.log('[Radios] 🔄 VERIFICAÇÃO DE PERSISTÊNCIA:');
          console.log('[Radios] 📊 Total de rádios carregadas:', radiosWithFavorites.length);
          console.log('[Radios] 📊 Rádios marcadas como favoritas:', favoriteCount);
          console.log('[Radios] 📊 Rádios que deveriam ser favoritas por segmento:', radiosWithFavorites.filter(r => userSegments.includes(r.formato)).length);
          console.log('[Radios] 📊 Rádios favoritadas individualmente:', userFavorites.filter(fav => !fav.startsWith('!')).length);
          console.log('[Radios] 📊 Rádios explicitamente não favoritas:', userFavorites.filter(fav => fav.startsWith('!')).length);

          // 🔥 LOG PARA DIAGNOSTICAR: Verificar se há rádios que deveriam ser favoritas pelos segmentos
          if (userSegments.length > 0) {
            const radiosMatchingSegments = radiosWithFavorites.filter((radio: any) =>
              userSegments.includes(radio.formato)
            );
            console.log('[Radios] 🎯 Rádios que deveriam ser favoritas pelos segmentos selecionados:', radiosMatchingSegments.map(r => ({ name: r.name, formato: r.formato })));
            console.log('[Radios] ⚠️ Dessas, quantas NÃO estão marcadas como favoritas:', radiosMatchingSegments.filter(r => !r.isFavorite).length);
          }

          setRadios(radiosWithFavorites);

          // 5️⃣ 💾 BACKUP NO LOCALSTORAGE (consistência)
          const savedFavoritesKey = `favorites_${currentUser.id}`;
          localStorage.setItem(savedFavoritesKey, JSON.stringify(userFavorites));
          console.log('[Radios] 💾 Backup salvo no localStorage:', savedFavoritesKey, userFavorites);

          // 🔥 VERIFICAR SE O BACKUP FOI SALVO CORRETAMENTE
          const verifyBackup = localStorage.getItem(savedFavoritesKey);
          console.log('[Radios] ✅ Verificação do backup no localStorage:', JSON.parse(verifyBackup || '[]'));

        } catch (error) {
          console.error('[Radios] ❌ Erro ao carregar dados:', error);
          setError('Erro ao carregar as rádios. Por favor, tente novamente.');
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }
  }, [currentUser]); // Re-executa quando currentUser muda

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
    console.log('[Radios] 🟡 Toggle favorite:', radioName, 'from', currentFavorite);
    console.log('[Radios] 📊 Estado antes do toggle:', {
      radioName,
      currentFavorite,
      userId: currentUser?.id,
      hasMetadata: !!currentUser?.user_metadata,
      currentFavorites: currentUser?.user_metadata?.favorite_radios
    });

    if (!currentUser) {
      console.error('[Radios] ❌ Não há usuário logado');
      return;
    }

    try {
      // 🔥 Obter lista atual de favoritos individuais
      const currentFavorites = currentUser.user_metadata?.favorite_radios || [];
      console.log('[Radios] 📋 Favoritos individuais atuais:', currentFavorites);

      // 🔥 Encontrar a rádio para verificar se é favorita por segmento
      const radio = radios.find(r => r.name === radioName);
      const userSegments = currentUser.user_metadata?.favorite_segments || [];
      const isSegmentFavorite = radio && userSegments.includes(radio.formato);

      console.log('[Radios] 🎯 Radio format:', radio?.formato, '- Is segment favorite:', isSegmentFavorite);
      console.log('[Radios] 📊 User segments:', userSegments);

      // 🔥 Calcular nova lista de favoritos
      let updatedFavorites: string[];

      if (!currentFavorite) {
        // ✅ Adicionar aos favoritos individuais
        console.log('[Radios] ➕ Adicionando aos favoritos individuais:', radioName);
        updatedFavorites = [...currentFavorites, radioName];
      } else {
        // ✅ Remover dos favoritos individuais
        console.log('[Radios] ➖ Removendo dos favoritos individuais:', radioName);
        updatedFavorites = currentFavorites.filter((name: string) => name !== radioName);

        // 🔥 Se era favorita por segmento mas usuário quer remover, adicionar aos favoritos individuais como "não favorito"
        if (isSegmentFavorite) {
          // Adicionar com prefixo negativo para indicar "não favorito apesar do segmento"
          updatedFavorites = [...updatedFavorites, `!${radioName}`];
          console.log('[Radios] ⚠️ Adicionando como "não favorito" apesar do segmento:', `!${radioName}`);
        }
      }

      console.log('[Radios] 📝 Nova lista de favoritos individuais:', updatedFavorites);

      // 🔥 SALVAR NO SUPABASE (user_metadata)
      console.log('[Radios] 📤 Enviando dados para Supabase:', {
        currentMetadata: currentUser.user_metadata,
        updatedFavorites: updatedFavorites
      });

      // 🔥 TENTATIVA ALTERNATIVA: Atualizar apenas o campo específico
      const newMetadata = {
        ...currentUser.user_metadata,
        favorite_radios: updatedFavorites
      };

      console.log('[Radios] 🔄 Tentativa alternativa - Novos metadados:', newMetadata);

      const { data, error } = await supabase.auth.updateUser({
        data: newMetadata
      });

      console.log('[Radios] 📥 Resposta do Supabase:', { data, error });
      console.log('[Radios] 🔍 Verificação detalhada:', {
        hasError: !!error,
        hasData: !!data,
        hasUser: !!(data?.user),
        userMetadata: data?.user?.user_metadata
      });

      if (error) {
        console.error('[Radios] ❌ Erro ao salvar no Supabase:', error);
        throw error;
      }

      if (!data) {
        console.error('[Radios] ❌ ERRO CRÍTICO: Resposta do Supabase é null/undefined');
        throw new Error('Resposta do Supabase é null');
      }

      if (!data.user) {
        console.error('[Radios] ❌ ERRO CRÍTICO: data.user é null/undefined');
        throw new Error('Usuário não retornado pelo Supabase');
      }

      console.log('[Radios] ✅ Verificações passaram - processando dados...');

      if (data?.user) {
        console.log('[Radios] ✅ Favoritos salvos no Supabase com sucesso');
        console.log('[Radios] 📋 Novos metadados do usuário:', data.user.user_metadata);
        console.log('[Radios] 🔍 Verificação - favorite_radios nos metadados:', data.user.user_metadata?.favorite_radios);

        // 🔥 VERIFICAÇÃO ADICIONAL: Verificar se os dados foram realmente salvos
        const savedFavorites = data.user.user_metadata?.favorite_radios || [];
        const saveSuccessful = JSON.stringify(savedFavorites.sort()) === JSON.stringify(updatedFavorites.sort());

        console.log('[Radios] ✅ Verificação de salvamento:', {
          saved: savedFavorites,
          expected: updatedFavorites,
          successful: saveSuccessful
        });

        if (!saveSuccessful) {
          console.error('[Radios] ❌ ERRO: Dados não foram salvos corretamente no Supabase!');
          console.error('[Radios] 📊 Comparação:', {
            saved: savedFavorites,
            expected: updatedFavorites,
            difference: updatedFavorites.filter(fav => !savedFavorites.includes(fav))
          });

          // 🔥 TENTATIVA DE RECUPERAÇÃO: Tentar salvar novamente com abordagem diferente
          console.log('[Radios] 🔄 Tentando abordagem de recuperação...');
          try {
            const recoveryMetadata = {
              favorite_radios: updatedFavorites
            };

            const { data: recoveryData, error: recoveryError } = await supabase.auth.updateUser({
              data: recoveryMetadata
            });

            if (recoveryError) {
              console.error('[Radios] ❌ Recuperação também falhou:', recoveryError);
            } else {
              console.log('[Radios] ✅ Recuperação bem-sucedida:', recoveryData?.user?.user_metadata?.favorite_radios);
            }
          } catch (recoveryException) {
            console.error('[Radios] 💥 Exceção na recuperação:', recoveryException);
          }
        }

        // 🔥 Atualizar estado local após confirmação do Supabase
        console.log('[Radios] 🔄 Atualizando estado visual para radio:', radioName);
        console.log('[Radios] 📊 Estado antes da atualização imediata:', {
          radioName,
          currentFavorite,
          totalRadios: radios.length,
          favoritasAtuais: radios.filter(r => r.isFavorite).length
        });

        setRadios(prevRadios => {
          const newRadios = prevRadios.map(radio =>
            radio.name === radioName
              ? { ...radio, isFavorite: !currentFavorite }
              : radio
          );

          console.log('[Radios] ✅ Atualização imediata aplicada:', {
            radioAlterada: radioName,
            novaSituacao: newRadios.find(r => r.name === radioName)?.isFavorite,
            totalFavoritas: newRadios.filter(r => r.isFavorite).length,
            expected: !currentFavorite
          });

          return newRadios;
        });

        // 🔥 ATUALIZAR O ESTADO LOCAL DIRETAMENTE SEM RECARREGAR
        console.log('[Radios] 🔄 Atualizando estado local diretamente...');

        // Em vez de recarregar tudo, vamos apenas atualizar o currentUser local
        // para que na próxima renderização os cálculos sejam feitos com dados atualizados
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            user_metadata: {
              ...currentUser.user_metadata,
              favorite_radios: updatedFavorites
            }
          };

          // Forçar re-renderização atualizando o estado radios com os novos cálculos
          setTimeout(() => {
            console.log('[Radios] 🔄 Recalculando favoritos com dados atualizados...');
            console.log('[Radios] 📊 Estado atual antes da atualização:', {
              totalRadios: radios.length,
              favoritasAtuais: radios.filter(r => r.isFavorite).length,
              radioSendoAlterada: radioName,
              situacaoAtual: radios.find(r => r.name === radioName)?.isFavorite
            });

            // Recarregar apenas os dados dos favoritos sem mostrar loading
            const updatedRadios = radios.map((radio: any) => {
              const isIndividualFavorite = updatedFavorites.includes(radio.name);
              const isExplicitlyNotFavorite = updatedFavorites.includes(`!${radio.name}`);
              const isSegmentFavorite = userSegments.includes(radio.formato) && !isExplicitlyNotFavorite;
              const isFavorite = isIndividualFavorite || isSegmentFavorite;

              console.log(`[Radios] 🔄 Recalculando ${radio.name}:`, {
                isIndividualFavorite,
                isExplicitlyNotFavorite,
                isSegmentFavorite,
                finalIsFavorite: isFavorite,
                formato: radio.formato,
                userSegments: userSegments
              });

              return {
                ...radio,
                isFavorite: isFavorite
              };
            });

            setRadios(updatedRadios);
            console.log('[Radios] ✅ Estado atualizado sem recarregamento completo');
            console.log('[Radios] 📊 Resumo dos favoritos após atualização:', {
              totalRadios: updatedRadios.length,
              favoritas: updatedRadios.filter(r => r.isFavorite).length,
              radioAlterada: radioName,
              novaSituacao: updatedRadios.find(r => r.name === radioName)?.isFavorite,
              expectedFavorite: !currentFavorite
            });

            // 🔥 VERIFICAR SE A ATUALIZAÇÃO FOI APLICADA CORRETAMENTE
            const updatedRadio = updatedRadios.find(r => r.name === radioName);
            console.log('[Radios] 🔍 Verificação da rádio atualizada:', {
              name: updatedRadio?.name,
              formato: updatedRadio?.formato,
              isFavorite: updatedRadio?.isFavorite,
              expectedFavorite: !currentFavorite,
              match: updatedRadio?.isFavorite === !currentFavorite
            });

            // 🔥 VERIFICAÇÃO DETALHADA DE TODAS AS RÁDIOS FAVORITAS
            const allFavorites = updatedRadios.filter(r => r.isFavorite);
            console.log('[Radios] 📋 Lista completa de rádios favoritas após atualização:', allFavorites.map(r => ({
              name: r.name,
              formato: r.formato,
              isIndividual: updatedFavorites.includes(r.name),
              isSegment: userSegments.includes(r.formato)
            })));
          }, 100);
        }

        // 🔥 Atualizar localStorage como backup adicional (consistência)
        try {
          const userKey = `favorites_${currentUser.id}`;
          localStorage.setItem(userKey, JSON.stringify(updatedFavorites));
          console.log('[Radios] 💾 Backup salvo no localStorage:', userKey, updatedFavorites);

          // 🔥 VERIFICAR SE O BACKUP FOI SALVO CORRETAMENTE
          const verifyStorage = localStorage.getItem(userKey);
          console.log('[Radios] ✅ Verificação do localStorage após salvamento:', JSON.parse(verifyStorage || '[]'));
        } catch (storageError) {
          console.warn('[Radios] ⚠️ Não foi possível salvar backup no localStorage:', storageError);
        }

        console.log('[Radios] 🎉 Toggle favorito concluído com sucesso');

        // 🔥 VERIFICAÇÃO FINAL DE PERSISTÊNCIA
        console.log('[Radios] 🔄 VERIFICAÇÃO FINAL APÓS TOGGLE:');
        console.log('[Radios] 📊 Dados salvos no Supabase:', data.user.user_metadata?.favorite_radios);
        console.log('[Radios] 📊 Estado local atualizado para:', updatedFavorites);
        console.log('[Radios] 📊 Comparação:', {
          supabase: data.user.user_metadata?.favorite_radios,
          local: updatedFavorites,
          match: JSON.stringify(data.user.user_metadata?.favorite_radios) === JSON.stringify(updatedFavorites)
        });

      } else {
        console.error('[Radios] ❌ Resposta do Supabase sem dados de usuário');
      }

    } catch (error) {
      console.error('[Radios] 💥 Erro geral no toggle favorito:', error);
      console.error('[Radios] 📊 Detalhes do erro:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      setError('Erro ao salvar favorito. Por favor, tente novamente.');

      // 🔥 Em caso de erro, tentar pelo menos atualizar visualmente
      setRadios(prevRadios =>
        prevRadios.map(radio =>
          radio.name === radioName
            ? { ...radio, isFavorite: !currentFavorite }
            : radio
        )
      );
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
                  console.log('Renderizando Radio:', (radio as any).name, 'Stream URL:', radio.streamUrl); // Log para verificar URL
                return (
                  <TableRow key={radio.name} className={rowClass}>
              <TableCell>
                <Star
                  className={`cursor-pointer ${radio.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}
                  onClick={() => {
                    console.log('[Radios] ⭐ CLICK DETECTED - Radio:', radio.name, 'Favorite:', radio.isFavorite, 'Format:', radio.formato);
                    console.log('[Radios] 📊 Estado atual da radio antes do click:', {
                      name: radio.name,
                      isFavorite: radio.isFavorite,
                      formato: radio.formato
                    });
                    toggleFavorite(radio.name, radio.isFavorite);
                  }}
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
                        onClick={() => {
                          console.log('[Radios] ⭐ BUTTON CLICK DETECTED - Radio:', radio.name, 'Favorite:', radio.isFavorite, 'Format:', radio.formato);
                          console.log('[Radios] 📊 Estado da radio no botão antes do click:', {
                            name: radio.name,
                            isFavorite: radio.isFavorite,
                            formato: radio.formato
                          });
                          toggleFavorite(radio.name, radio.isFavorite);
                        }}
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
