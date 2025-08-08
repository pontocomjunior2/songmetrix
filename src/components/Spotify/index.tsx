import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Select from 'react-select';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { ResponsiveDataTable, type ResponsiveColumn } from '@/components/ui/responsive-data-table';
import { Loader2, Play, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import './styles/Spotify.css';
import {
  fetchSpotifyToken,
  fetchFeaturedPlaylists,
  fetchPlaylistTracks,
  fetchCategories,
  fetchCategoryPlaylists,
  fetchNewReleases,
  getCountries
} from './services/spotify';
import {
  SpotifyTokenData,
  SpotifyFilters,
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyCategory,
  SpotifyFeaturedPlaylists,
  SpotifyCountry
} from './types';

export default function Spotify() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [spotifyTokenData, setSpotifyTokenData] = useState<SpotifyTokenData | null>(() => {
    const storedToken = localStorage.getItem('spotifyToken');
    const storedExpiration = localStorage.getItem('spotifyTokenExpiration');
    if (storedToken && storedExpiration && Date.now() < parseInt(storedExpiration)) {
      return { token: storedToken, expiresAt: parseInt(storedExpiration) };
    }
    return null;
  });
  
  // Configure estados iniciais sem valores hard-coded
  const [filters, setFilters] = useState<SpotifyFilters>({
    timeRange: 'medium_term',
    limit: '20',
    country: 'BR',
    playlistId: ''
  });
  const [selectedCountry, setSelectedCountry] = useState<{ value: string; label: string }>({ value: 'BR', label: 'Brasil' });
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ value: string; label: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ value: string; label: string } | null>(null);
  
  const [featuredPlaylists, setFeaturedPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [categories, setCategories] = useState<SpotifyCategory[]>([]);
  const [categoryPlaylists, setCategoryPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loadingCategoryPlaylists, setLoadingCategoryPlaylists] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const countries = getCountries();
  const countryOptions = countries.map(country => ({
    value: country.code,
    label: country.name
  }));

  const playlistOptions = featuredPlaylists.map(playlist => ({
    value: playlist.id,
    label: playlist.name
  }));

  const categoryOptions = categories.map(category => ({
    value: category.id,
    label: category.name
  }));

  // Função para obter o token do Spotify
  const loadSpotifyToken = useCallback(async () => {
    try {
      if (spotifyTokenData && spotifyTokenData.expiresAt > Date.now()) {
        console.log("Usando token do Spotify existente");
        return spotifyTokenData.token;
      }

      console.log("Obtendo novo token do Spotify...");
      const newToken = await fetchSpotifyToken();
      if (newToken) {
        console.log("Novo token do Spotify obtido com sucesso");
        const expiresAt = Date.now() + 3600000; // Token expira em 1 hora
        setSpotifyTokenData({ token: newToken, expiresAt });
        localStorage.setItem('spotifyToken', newToken);
        localStorage.setItem('spotifyTokenExpiration', expiresAt.toString());
        return newToken;
      } else {
        console.error("Falha ao obter token do Spotify");
        setErrorMessage('Não foi possível obter o token do Spotify. Por favor, tente novamente mais tarde.');
        return null;
      }
    } catch (error) {
      console.error("Erro ao obter token do Spotify:", error);
      setErrorMessage('Erro ao obter token do Spotify. Por favor, tente novamente mais tarde.');
      return null;
    }
  }, [spotifyTokenData]);

  // Função para limpar o token do Spotify armazenado
  const clearStoredToken = useCallback(() => {
    console.log("Limpando token do Spotify armazenado");
    localStorage.removeItem('spotifyToken');
    localStorage.removeItem('spotifyTokenExpiration');
    setSpotifyTokenData(null);
  }, []);

  // Função para carregar playlists em destaque
  const loadFeaturedPlaylists = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    
    console.log('Carregando playlists populares...');
    
    const token = await loadSpotifyToken();
    if (!token) {
      setErrorMessage('Não foi possível obter o token do Spotify. Tente novamente mais tarde.');
      setLoading(false);
      return;
    }
    
    const featuredPlaylists = await fetchFeaturedPlaylists(token, filters.country);
    if (featuredPlaylists && featuredPlaylists.playlists.length > 0) {
      setFeaturedPlaylists(featuredPlaylists.playlists);
      
      // Se temos playlists e não há playlist selecionada, vamos carregar as faixas da primeira playlist
      const firstPlaylist = featuredPlaylists.playlists[0];
      if (!filters.playlistId) {
        console.log(`Selecionando primeira playlist: ${firstPlaylist.name} (${firstPlaylist.id})`);
        setFilters(prev => ({ ...prev, playlistId: firstPlaylist.id }));
        setSelectedPlaylist({ value: firstPlaylist.id, label: firstPlaylist.name });
        loadPlaylistTracks(firstPlaylist.id);
      }
    } else {
      setErrorMessage('Não foi possível carregar playlists. Por favor, tente outra região ou mais tarde.');
    }
    
    setLoading(false);
  }, [loadSpotifyToken, filters.country, filters.playlistId]);

  // Função para carregar categorias
  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    
    console.log('Carregando categorias...');
    
    const token = await loadSpotifyToken();
    if (!token) {
      setErrorMessage('Não foi possível obter o token do Spotify. Tente novamente mais tarde.');
      setLoading(false);
      return;
    }
    
    const categoriesData = await fetchCategories(token, filters.country);
    if (categoriesData && categoriesData.length > 0) {
      setCategories(categoriesData);
    } else {
      console.warn('Não foi possível carregar categorias');
      // Não mostrar mensagem de erro, apenas log, para não interromper a experiência do usuário
    }
    
    setLoading(false);
  }, [loadSpotifyToken, filters.country]);

  // Função para carregar playlists de uma categoria
  const loadCategoryPlaylists = useCallback(async (categoryId: string) => {
    if (!categoryId) return;
    
    setLoadingCategoryPlaylists(true);
    setErrorMessage('');
    
    console.log(`Carregando playlists da categoria ${categoryId}...`);
    
    const token = await loadSpotifyToken();
    if (!token) {
      setErrorMessage('Não foi possível obter o token do Spotify. Tente novamente mais tarde.');
      setLoadingCategoryPlaylists(false);
      return;
    }
    
    const playlists = await fetchCategoryPlaylists(token, categoryId, filters.country);
    if (playlists && playlists.length > 0) {
      setCategoryPlaylists(playlists);
      
      // Selecionar a primeira playlist da categoria automaticamente
      const firstPlaylist = playlists[0];
      setFilters(prev => ({ ...prev, playlistId: firstPlaylist.id }));
      setSelectedPlaylist({ value: firstPlaylist.id, label: firstPlaylist.name });
      loadPlaylistTracks(firstPlaylist.id);
    } else {
      setErrorMessage(`Não foi possível encontrar playlists para esta categoria. Tente outra categoria.`);
      setCategoryPlaylists([]);
    }
    
    setLoadingCategoryPlaylists(false);
  }, [loadSpotifyToken, filters.country]);

  // Função para carregar faixas de uma playlist
  const loadPlaylistTracks = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    
    setLoadingTracks(true);
    setErrorMessage('');
    
    try {
      const token = await loadSpotifyToken();
      if (!token) {
        setErrorMessage('Não foi possível obter o token do Spotify. Tente novamente mais tarde.');
        setLoadingTracks(false);
        return;
      }

      console.log(`Carregando faixas da playlist: ${playlistId}`);
      const data = await fetchPlaylistTracks(token, playlistId, parseInt(filters.limit));
      if (data && data.length > 0) {
        console.log(`Faixas carregadas com sucesso: ${data.length} faixas`);
        setTracks(data);
      } else {
        console.error('Não foi possível carregar faixas da playlist');
        setErrorMessage('Não foi possível carregar as faixas dessa playlist. Tente selecionar outra playlist.');
        setTracks([]);
      }
    } catch (error) {
      console.error('Erro ao carregar faixas da playlist:', error);
      setErrorMessage('Erro ao carregar faixas da playlist. Por favor, tente novamente.');
      setTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }, [loadSpotifyToken, filters.limit]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    if (currentUser) {
      loadFeaturedPlaylists();
      loadCategories();
    }
  }, [currentUser, loadFeaturedPlaylists, loadCategories]);

  // Efeito para carregar faixas quando o ID da playlist muda
  useEffect(() => {
    if (filters.playlistId) {
      loadPlaylistTracks(filters.playlistId);
    }
  }, [filters.playlistId, loadPlaylistTracks]);

  // Manipulador para o botão de pesquisa
  const handleSearch = () => {
    loadFeaturedPlaylists();
    loadCategories();
  };

  // Manipulador para mudança de categoria
  const handleCategoryChange = (selectedOption: any) => {
    setSelectedCategory(selectedOption);
    if (selectedOption) {
      loadCategoryPlaylists(selectedOption.value);
    } else {
      setCategoryPlaylists([]);
    }
  };

  // Manipulador para seleção de playlist
  const handlePlaylistSelect = (playlist: SpotifyPlaylist) => {
    setFilters({ ...filters, playlistId: playlist.id });
    setSelectedPlaylist({ value: playlist.id, label: playlist.name });
    loadPlaylistTracks(playlist.id);
  };

  // Função para limpar filtros
  const clearFilters = () => {
    setFilters({
      timeRange: 'medium_term',
      limit: '20',
      country: 'BR',
      playlistId: ''
    });
    setSelectedCountry({ value: 'BR', label: 'Brasil' });
    setSelectedPlaylist(null);
    setSelectedCategory(null);
    setCategoryPlaylists([]);
    
    // Recarregar dados
    loadFeaturedPlaylists();
    loadCategories();
  };

  // Função para formatar duração
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Função para tentar novamente
  const handleRetry = () => {
    clearStoredToken();
    loadFeaturedPlaylists();
    loadCategories();
  };

  return (
    <div className="spotify-container">
      <div className="spotify-header">
        <h2>Spotify Charts</h2>
        <p>Explore as músicas mais populares do Spotify, playlists e categorias.</p>
      </div>

      <div className="spotify-filters">
        <div className="spotify-filter-row">
          <div className="spotify-filter-group">
            <label htmlFor="country-select">País:</label>
            <Select
              id="country-select"
              options={countryOptions}
              value={selectedCountry}
              onChange={(newValue: any) => {
                setSelectedCountry(newValue);
                setFilters({ ...filters, country: newValue.value });
              }}
              placeholder="Selecione um país"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          <div className="spotify-filter-group">
            <label htmlFor="category-select">Categoria:</label>
            <Select
              id="category-select"
              options={categoryOptions}
              value={selectedCategory}
              onChange={handleCategoryChange}
              placeholder="Selecione uma categoria"
              isClearable
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          <div className="spotify-filter-group">
            <label htmlFor="playlist-select">Playlist:</label>
            <Select
              id="playlist-select"
              options={playlistOptions}
              value={selectedPlaylist}
              onChange={(newValue: any) => {
                if (newValue) {
                  setSelectedPlaylist(newValue);
                  setFilters({ ...filters, playlistId: newValue.value });
                }
              }}
              placeholder="Selecione uma playlist"
              className="react-select-container"
              classNamePrefix="react-select"
              isClearable
            />
          </div>

          <div className="spotify-filter-group">
            <label htmlFor="limit-select">Limite:</label>
            <select
              id="limit-select"
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: e.target.value })}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>

        <div className="spotify-filter-buttons">
          <button className="spotify-btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? "Carregando..." : "Pesquisar"}
          </button>
          <button className="spotify-btn-secondary" onClick={clearFilters}>
            Limpar Filtros
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="spotify-error">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button onClick={handleRetry}>Tentar Novamente</button>
        </div>
      )}

      {loading ? (
        <div className="spotify-loading">
          <div className="spotify-loading-spinner"></div>
          <p>Carregando...</p>
        </div>
      ) : (
        <>
          {selectedCategory && categoryPlaylists.length > 0 && (
            <div className="spotify-tracks-container">
              <div className="spotify-tracks-header">
                <h3 className="spotify-tracks-title">Playlists de {selectedCategory.label}</h3>
              </div>
              <div className="spotify-content">
                {categoryPlaylists.map((playlist) => (
                  <div key={playlist.id} className="spotify-card" onClick={() => handlePlaylistSelect(playlist)}>
                    <LazyLoadImage
                      src={playlist.images[0] || '/placeholder-playlist.png'}
                      alt={playlist.name}
                      effect="blur"
                      className="spotify-card-image"
                      placeholderSrc="/placeholder-playlist.png" 
                    />
                    <div className="spotify-card-content">
                      <h3 className="spotify-card-title">{playlist.name}</h3>
                      <p className="spotify-card-subtitle">Por {playlist.owner}</p>
                      <p className="spotify-card-description">{playlist.description}</p>
                      <div className="spotify-card-footer">
                        <span>{playlist.tracks_total} faixas</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!selectedCategory || categoryPlaylists.length === 0) && featuredPlaylists.length > 0 && (
            <div className="spotify-tracks-container">
              <div className="spotify-tracks-header">
                <h3 className="spotify-tracks-title">Playlists Populares</h3>
              </div>
              <div className="spotify-content">
                {featuredPlaylists.map((playlist) => (
                  <div key={playlist.id} className="spotify-card" onClick={() => handlePlaylistSelect(playlist)}>
                    <LazyLoadImage
                      src={playlist.images[0] || '/placeholder-playlist.png'}
                      alt={playlist.name}
                      effect="blur"
                      className="spotify-card-image"
                      placeholderSrc="/placeholder-playlist.png"
                    />
                    <div className="spotify-card-content">
                      <h3 className="spotify-card-title">{playlist.name}</h3>
                      <p className="spotify-card-subtitle">Por {playlist.owner}</p>
                      <p className="spotify-card-description">{playlist.description}</p>
                      <div className="spotify-card-footer">
                        <span>{playlist.tracks_total} faixas</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingTracks ? (
            <div className="spotify-loading">
              <div className="spotify-loading-spinner"></div>
              <p>Carregando faixas...</p>
            </div>
          ) : (
            tracks.length > 0 && selectedPlaylist && (
              <div className="spotify-tracks-container">
                <div className="spotify-tracks-header">
                  <h3 className="spotify-tracks-title">Faixas de {selectedPlaylist.label}</h3>
                </div>
                {/* Mobile: cards */}
                <div className="sm:hidden">
                  <ResponsiveDataTable<SpotifyTrack>
                    data={tracks}
                    getRowKey={(row) => row.id}
                    columns={([
                      {
                        id: 'main',
                        header: 'Faixa',
                        isPrimaryMobileField: true,
                        render: (row, ) => (
                          <div className="flex items-center gap-3">
                            <LazyLoadImage
                              src={row.albumCover || '/placeholder-album.png'}
                              alt={row.album}
                              effect="blur"
                              className="w-12 h-12 rounded object-cover"
                              placeholderSrc="/placeholder-album.png"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{row.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{row.artist}</div>
                            </div>
                          </div>
                        ),
                      },
                      { id: 'album', header: 'Álbum', accessorKey: 'album' },
                      { id: 'pop', header: 'Popularidade', render: (r) => (
                        <div className="flex items-center gap-2 text-sm">
                          <span>{r.popularity}</span>
                          <div className="flex-1 h-1 bg-gray-200 rounded">
                            <div className="h-1 bg-green-500 rounded" style={{ width: `${r.popularity}%` }} />
                          </div>
                        </div>
                      ) },
                      { id: 'dur', header: 'Duração', render: (r) => formatDuration(r.duration_ms) },
                      { id: 'actions', header: 'Ações', render: (r) => (
                        <div className="flex items-center gap-2">
                          {r.preview_url && (
                            <a href={r.preview_url} target="_blank" rel="noopener noreferrer" title="Ouvir prévia" className="text-blue-600">
                              <Play className="w-4 h-4" />
                            </a>
                          )}
                          <a href={r.external_url} target="_blank" rel="noopener noreferrer" title="Abrir no Spotify" className="text-blue-600">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ) },
                    ] as ResponsiveColumn<SpotifyTrack>[])}
                  />
                </div>

                {/* Desktop/Tablet: tabela original */}
                <table className="spotify-tracks-table hidden sm:table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Título</th>
                      <th>Álbum</th>
                      <th>Popularidade</th>
                      <th><Clock className="w-4 h-4" /></th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((track, index) => (
                      <tr key={track.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="spotify-track-info">
                            <LazyLoadImage
                              src={track.albumCover || '/placeholder-album.png'}
                              alt={track.album}
                              effect="blur"
                              className="spotify-track-image"
                              placeholderSrc="/placeholder-album.png"
                            />
                            <div className="spotify-track-details">
                              <span className="spotify-track-name">{track.name}</span>
                              <span className="spotify-track-artist">{track.artist}</span>
                            </div>
                          </div>
                        </td>
                        <td className="spotify-track-album">{track.album}</td>
                        <td>
                          <div className="spotify-track-popularity">
                            <span>{track.popularity}</span>
                            <div className="spotify-popularity-bar">
                              <div className="spotify-popularity-fill" style={{ width: `${track.popularity}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td>{formatDuration(track.duration_ms)}</td>
                        <td>
                          <div className="spotify-track-actions">
                            {track.preview_url && (
                              <a href={track.preview_url} target="_blank" rel="noopener noreferrer" className="spotify-track-action" title="Ouvir prévia">
                                <Play className="w-4 h-4" />
                              </a>
                            )}
                            <a href={track.external_url} target="_blank" rel="noopener noreferrer" className="spotify-track-action" title="Abrir no Spotify">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {!loading && !loadingTracks && tracks.length === 0 && featuredPlaylists.length === 0 && categoryPlaylists.length === 0 && (
            <div className="spotify-empty">
              <p>Nenhum dado encontrado. Por favor, tente outros filtros ou verifique sua conexão.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
} 