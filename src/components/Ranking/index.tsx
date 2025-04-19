import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Select from 'react-select';
import moment from 'moment';
import { supabase } from '../../lib/supabase-client';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './styles/Ranking.css';
import { fetchSpotifyToken, fetchArtistImageFromSpotify } from './services/spotify';
import { RankingItem, SpotifyTokenData, ArtistImages, RankingFilters, RadioStatus } from './types';
import { MultiValue } from 'react-select';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Search } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

export default function Ranking() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [selectedRadios, setSelectedRadios] = useState<SelectOption[]>([]);
  const [radiosOptions, setRadiosOptions] = useState<SelectOption[]>([]);
  const [filters, setFilters] = useState<RankingFilters>({
    rankingSize: '10',
    startDate: moment().subtract(10, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
    hourStart: '',
    hourEnd: '',
    selectedRadios: []
  });
  const [artistImages, setArtistImages] = useState<ArtistImages>(() => {
    const cached = localStorage.getItem('artistImages');
    return cached ? JSON.parse(cached) : {};
  });
  const [spotifyTokenData, setSpotifyTokenData] = useState<SpotifyTokenData | null>(() => {
    const storedToken = localStorage.getItem('spotifyToken');
    const storedExpiration = localStorage.getItem('spotifyTokenExpiration');
    if (storedToken && storedExpiration && Date.now() < parseInt(storedExpiration)) {
      return { token: storedToken, expiresAt: parseInt(storedExpiration) };
    }
    return null;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const multiSelectRadioOptions = useMemo(() => 
    radiosOptions.filter(option => option.value !== 'Todas as Rádios'), 
    [radiosOptions]
  );

  const loadSpotifyToken = useCallback(async () => {
    if (spotifyTokenData && spotifyTokenData.expiresAt > Date.now()) {
      return spotifyTokenData.token;
    }

    console.log("Obtendo novo token do Spotify...");
    const newToken = await fetchSpotifyToken();
    if (newToken) {
      const expiresAt = Date.now() + 3600000; // Token expira em 1 hora
      setSpotifyTokenData({ token: newToken, expiresAt });
      localStorage.setItem('spotifyToken', newToken);
      localStorage.setItem('spotifyTokenExpiration', expiresAt.toString());
      return newToken;
    }
    return null;
  }, [spotifyTokenData]);

  const loadArtistImages = useCallback(async (data: RankingItem[]) => {
    const token = await loadSpotifyToken();
    if (!token) {
      console.error("Token Spotify não disponível. Imagens não podem ser carregadas.");
      return;
    }

    const newImages: ArtistImages = {};
    // Usar Promise.all para buscar imagens em paralelo
    const imagePromises = data.map(async (item) => {
      // Só busca se ainda não tiver a imagem (usando chave original)
      if (!artistImages[item.artist]) { 
        try {
          // Substituir " & " por " e " no nome do artista ANTES de buscar
          const artistNameToSearch = item.artist.includes(' & ') 
            ? item.artist.replace(' & ', ' e ') 
            : item.artist;
            
          const spotifyImageUrl = await fetchArtistImageFromSpotify(artistNameToSearch, token);
          
          if (spotifyImageUrl) {
            // Armazenar usando o nome ORIGINAL do artista como chave
            newImages[item.artist] = spotifyImageUrl; 
          }
        } catch (error) {
          console.error(`Erro ao carregar a imagem para ${item.artist}:`, error);
        }
      }
    });
    
    await Promise.all(imagePromises);

    // Atualizar estado apenas se novas imagens foram encontradas
    if (Object.keys(newImages).length > 0) {
        const updatedImages = { ...artistImages, ...newImages };
        setArtistImages(updatedImages); 
        // O useEffect separado cuida de salvar no localStorage
    }
  }, [artistImages, loadSpotifyToken]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchRadios = async () => {
    const isDevelopment = import.meta.env.MODE === 'development';
    console.log('Ambiente em Ranking:', import.meta.env.MODE);
    
    try {
      // Tentar obter do cache primeiro
      const cachedOptions = localStorage.getItem('ranking_radios_cache');
      const cacheTime = localStorage.getItem('ranking_radios_cache_time');
      
      if (cachedOptions && cacheTime) {
        const cacheDuration = Date.now() - parseInt(cacheTime);
        if (cacheDuration < 30 * 60 * 1000) { // 30 minutos
          console.log('Usando cache para rádios em Ranking');
          setRadiosOptions(JSON.parse(cachedOptions));
          // Buscar em segundo plano para atualizar o cache
          fetchAndUpdateCache().catch(error => {
            console.warn('Erro ao atualizar cache em segundo plano:', error);
          });
          return;
        }
      }
      
      // Se não há cache ou está expirado, fazer a requisição normalmente
      await fetchAndUpdateCache();
    } catch (error) {
      console.error('Erro ao buscar rádios para Ranking:', error);
      
      // Fornecer dados de fallback
      provideFallbackData();
    }
  };
  
  // Função para buscar dados e atualizar o cache
  const fetchAndUpdateCache = async () => {
    try {
      const headers = await getAuthHeaders();
      
      // Adicionar timeout para a requisição
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout
      
      const response = await fetch('/api/radios/status', { 
        headers, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Falha ao buscar rádios: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Se a resposta estiver vazia, usar fallback
      if (!data || data.length === 0) {
        console.warn('API retornou array vazio para rádios em Ranking');
        provideFallbackData();
        return;
      }
      
      // Mapear dados para o formato esperado pelo componente
      const radioOptions = data.map((radio: { name: string }) => ({
        value: radio.name,
        label: radio.name,
      }));
      
      // Adicionar "Todas as Rádios" como primeira opção
      radioOptions.unshift({ value: 'Todas as Rádios', label: 'Todas as Rádios' });
      
      // Atualizar estado e cache
      setRadiosOptions(radioOptions);
      localStorage.setItem('ranking_radios_cache', JSON.stringify(radioOptions));
      localStorage.setItem('ranking_radios_cache_time', Date.now().toString());
    } catch (error) {
      console.error('Erro em fetchAndUpdateCache para Ranking:', error);
      throw error; // Propagar o erro para ser tratado na função principal
    }
  };
  
  // Função para fornecer dados de fallback
  const provideFallbackData = () => {
    console.log('Fornecendo dados de fallback para Ranking');
    
    // Tentar usar cache antigo primeiro
    const oldCache = localStorage.getItem('ranking_radios_cache');
    if (oldCache) {
      console.log('Usando cache antigo para Ranking');
      setRadiosOptions(JSON.parse(oldCache));
      return;
    }
    
    // Se não há cache, criar opções fictícias
    const mockOptions = [
      { value: 'Todas as Rádios', label: 'Todas as Rádios' },
      { value: 'Rádio 1', label: 'Rádio 1' },
      { value: 'Rádio 2', label: 'Rádio 2' },
      { value: 'Rádio 3', label: 'Rádio 3' },
      { value: 'Rádio 4', label: 'Rádio 4' },
      { value: 'Rádio 5', label: 'Rádio 5' }
    ];
    
    // Em desenvolvimento, adicionar mais opções
    if (import.meta.env.MODE === 'development') {
      mockOptions.push(
        { value: 'Rádio Dev 1', label: 'Rádio Dev 1' },
        { value: 'Rádio Dev 2', label: 'Rádio Dev 2' }
      );
    }
    
    setRadiosOptions(mockOptions);
  };

  const fetchRanking = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      
      console.log('Rádios selecionadas:', selectedRadios);
      console.log('Parâmetro radio:', selectedRadios.length > 0 ? selectedRadios.map(r => r.value).join('||') : 'nenhuma');
      
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        rankingSize: filters.rankingSize,
        startTime: filters.hourStart,
        endTime: filters.hourEnd,
        ...(selectedRadios.length > 0 && { 
          radio: selectedRadios.map(r => r.value).join('||') 
        })
      });

      const response = await fetch(`/api/ranking?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch ranking');
      const data = await response.json();
      console.log('Dados recebidos do servidor:', data);
      
      // Verificar se os dados têm a estrutura esperada
      if (Array.isArray(data) && data.length > 0) {
        console.log('Exemplo do primeiro item:', data[0]);
        console.log('song_title está presente?', data[0].hasOwnProperty('song_title'));
        
        // Garantir que todos os campos necessários estejam presentes
        const processedData = data.map(item => ({
          ...item,
          song_title: item.song_title || item.song || 'Título não disponível'
        }));
        
        setRankingData(processedData);
      } else {
        setRankingData([]);
      }
      await loadArtistImages(data);
    } catch (error) {
      console.error('Error fetching ranking:', error);
      setErrorMessage('Erro ao carregar o ranking. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
      fetchRanking();
    }
  }, [currentUser]);

  const handleSearch = () => {
    fetchRanking();
  };

  const clearFilters = () => {
    setFilters({
      rankingSize: '10',
      startDate: moment().subtract(10, 'days').format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      hourStart: '',
      hourEnd: '',
      selectedRadios: []
    });
    setSelectedRadios([]);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rádios</label>
          <Select<SelectOption, true>
            options={multiSelectRadioOptions}
            isMulti
            value={selectedRadios}
            onChange={(newValue: MultiValue<SelectOption>) => setSelectedRadios(newValue as SelectOption[])}
            placeholder="Selecione as rádios..."
            className="react-select-container"
            classNamePrefix="react-select"
            isDisabled={radiosOptions.length <= 1}
            styles={{
              control: (base, state) => ({
                ...base,
                backgroundColor: isDarkMode ? '#374151' : base.backgroundColor,
                borderColor: state.isFocused ? '#2563eb' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                borderRadius: '0.375rem',
                boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : base.boxShadow,
                minHeight: '38px',
                height: 'auto',
                boxSizing: 'border-box',
                transition: base.transition,
                '&:hover': {
                    borderColor: state.isFocused ? '#2563eb' : (isDarkMode ? '#6B7280' : '#9CA3AF'),
                }
              }),
              valueContainer: (base) => ({
                  ...base,
                  padding: '2px 0.6rem',
              }),
              input: (base) => ({
                ...base,
                color: isDarkMode ? '#D1D5DB' : base.color,
                margin: '0px',
                paddingTop: '0px',
                paddingBottom: '0px',
              }),
              placeholder: (base) => ({
                ...base,
                color: isDarkMode ? '#6B7280' : '#9CA3AF',
              }),
              multiValue: (base) => ({
                  ...base,
                  backgroundColor: isDarkMode ? '#4B5563' : '#E5E7EB',
              }),
              multiValueLabel: (base) => ({ 
                  ...base,
                  color: isDarkMode ? '#D1D5DB' : '#374151',
              }),
              multiValueRemove: (base) => ({
                  ...base,
                  color: isDarkMode ? '#9CA3AF' : '#6B7280',
                  ':hover': {
                      backgroundColor: isDarkMode ? '#EF4444' : '#EF4444',
                      color: 'white',
                  },
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: isDarkMode ? '#374151' : base.backgroundColor,
                zIndex: 9999,
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected ? (isDarkMode ? '#2563eb' : '#2563eb') : state.isFocused ? (isDarkMode ? '#4B5563' : '#E5E7EB') : (isDarkMode ? '#374151' : base.backgroundColor),
                color: state.isSelected ? '#FFFFFF' : (isDarkMode ? '#D1D5DB' : base.color),
                ':active': {
                  ...base[':active'],
                  backgroundColor: !state.isDisabled ? (state.isSelected ? base.backgroundColor : (isDarkMode ? '#5A6679' : base[':active']?.backgroundColor)) : undefined,
                },
              }),
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tamanho</label>
          <Select<SelectOption>
             options={[
               { value: '10', label: 'Top 10' },
               { value: '20', label: 'Top 20' },
               { value: '50', label: 'Top 50' },
               { value: '100', label: 'Top 100' },
             ]}
             value={{ value: filters.rankingSize, label: `Top ${filters.rankingSize}` }}
             onChange={(option) => setFilters({ ...filters, rankingSize: option!.value })}
             className="react-select-container"
             classNamePrefix="react-select"
             styles={{
                control: (base, state) => ({
                    ...base,
                    backgroundColor: isDarkMode ? '#374151' : base.backgroundColor,
                    borderColor: state.isFocused ? '#2563eb' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                    borderRadius: '0.375rem',
                    boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : base.boxShadow,
                    minHeight: '38px',
                    height: '38px',
                    boxSizing: 'border-box',
                    transition: base.transition,
                    '&:hover': {
                        borderColor: state.isFocused ? '#2563eb' : (isDarkMode ? '#6B7280' : '#9CA3AF'),
                    }
                }),
                valueContainer: (base) => ({ ...base, padding: '2px 0.6rem' }),
                input: (base) => ({ ...base, color: isDarkMode ? '#D1D5DB' : base.color, margin: '0px', paddingTop: '0px', paddingBottom: '0px' }),
                placeholder: (base) => ({ ...base, color: isDarkMode ? '#6B7280' : '#9CA3AF' }),
                singleValue: (base) => ({ ...base, color: isDarkMode ? '#D1D5DB' : base.color, position: 'relative', top: '50%', transform: 'translateY(-50%)' }),
                menu: (base) => ({ ...base, backgroundColor: isDarkMode ? '#374151' : base.backgroundColor, zIndex: 9999 }),
                option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? (isDarkMode ? '#2563eb' : '#2563eb') : state.isFocused ? (isDarkMode ? '#4B5563' : '#E5E7EB') : (isDarkMode ? '#374151' : base.backgroundColor),
                    color: state.isSelected ? '#FFFFFF' : (isDarkMode ? '#D1D5DB' : base.color),
                    ':active': { ...base[':active'], backgroundColor: !state.isDisabled ? (state.isSelected ? base.backgroundColor : (isDarkMode ? '#5A6679' : base[':active']?.backgroundColor)) : undefined },
                }),
             }}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Início</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fim</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora Início</label>
          <input
            type="time"
            value={filters.hourStart}
            onChange={(e) => setFilters({ ...filters, hourStart: e.target.value })}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora Fim</label>
          <input
            type="time"
            value={filters.hourEnd}
            onChange={(e) => setFilters({ ...filters, hourEnd: e.target.value })}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div className="col-span-1 md:col-span-2 flex justify-end items-center gap-4 mt-2">
          <button 
            type="button" 
            onClick={clearFilters} 
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800 transition-colors duration-150 ease-in-out"
          >
            Limpar Filtros
          </button>
          <button 
            type="submit" 
            onClick={handleSearch}
            className="inline-flex items-center justify-center gap-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 
            Buscar
          </button>
        </div>
      </div>

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <div className="ranking-table-container">
        {loading ? (
          <div className="loading-indicator">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p>Carregando...</p>
          </div>
        ) : (
          <table className="ranking-table">
            <thead>
              <tr>
                <th className="rank-column">Rank</th>
                <th className="image-column"></th>
                <th className="artist-column">Artista</th>
                <th className="title-column">Título</th>
                <th className="genre-column">Gênero</th>
                <th className="executions-column">Execuções</th>
              </tr>
            </thead>
            <tbody>
              {rankingData.map((item, index) => (
                <tr key={item.id}>
                  <td className="rank-column">{index + 1}º</td>
                  <td className="image-column">
                    <LazyLoadImage
                      alt={`${item.artist} cover`}
                      src={artistImages[item.artist] || '/placeholder-image.webp'}
                      effect="blur"
                      placeholderSrc="/placeholder-image-small.webp"
                      wrapperClassName="w-[50px] h-[50px] rounded-full overflow-hidden inline-block align-middle"
                      className="w-full h-full object-cover"
                    />
                  </td>
                  <td className="artist-column">{item.artist}</td>
                  <td className="title-column">{item.song_title}</td>
                  <td className="genre-column">{item.genre}</td>
                  <td className="executions-column">{item.executions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && rankingData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum registro encontrado
          </div>
        )}
      </div>
    </div>
  );
}
