import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase-client';

interface DashboardFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  loading?: boolean;
}

interface FilterState {
  genres: string[];
  regions: string[];
  radioStations: string[];
  dateRange: string;
}

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({ onFiltersChange, loading = false }) => {
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    regions: [],
    radioStations: [],
    dateRange: '7d'
  });

  const [availableOptions, setAvailableOptions] = useState({
    genres: [] as FilterOption[],
    regions: [] as FilterOption[],
    radioStations: [] as FilterOption[]
  });

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const dateRangeOptions = [
    { value: '1d', label: 'Último dia' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' }
  ];

  // Carregar opções de filtro disponíveis
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setOptionsLoading(true);
        
        // Função para fazer requisição com retry em caso de token inválido
        const fetchWithAuth = async (url: string, retryCount = 0): Promise<Response> => {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          
          if (!token) {
            throw new Error('Token de autenticação não encontrado');
          }

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          // Se receber 401 e ainda não tentou refresh, tenta uma vez
          if (response.status === 401 && retryCount === 0) {
            console.log('Token inválido, tentando refresh...');
            await supabase.auth.refreshSession();
            return fetchWithAuth(url, retryCount + 1);
          }

          return response;
        };

        // Buscar todas as opções de filtro
        const [genresResponse, regionsResponse, radiosResponse] = await Promise.all([
          fetchWithAuth('/api/dashboard/filter-options/genres'),
          fetchWithAuth('/api/dashboard/filter-options/regions'),
          fetchWithAuth('/api/dashboard/filter-options/radios')
        ]);

        if (genresResponse.ok) {
          const genresData = await genresResponse.json();
          setAvailableOptions(prev => ({ ...prev, genres: genresData }));
        } else {
          console.error('Erro ao carregar gêneros:', genresResponse.status, genresResponse.statusText);
        }

        if (regionsResponse.ok) {
          const regionsData = await regionsResponse.json();
          setAvailableOptions(prev => ({ ...prev, regions: regionsData }));
        } else {
          console.error('Erro ao carregar regiões:', regionsResponse.status, regionsResponse.statusText);
        }

        if (radiosResponse.ok) {
          const radiosData = await radiosResponse.json();
          setAvailableOptions(prev => ({ ...prev, radioStations: radiosData }));
        } else {
          console.error('Erro ao carregar rádios:', radiosResponse.status, radiosResponse.statusText);
        }

      } catch (error) {
        console.error('Erro ao carregar opções de filtro:', error);
      } finally {
        setOptionsLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  // Notificar mudanças de filtro (pular primeiro render)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onFiltersChange(filters);
  }, [filters]);

  const handleFilterToggle = (filterType: keyof FilterState, value: string) => {
    if (filterType === 'dateRange') {
      setFilters(prev => ({ ...prev, dateRange: value }));
      return;
    }

    setFilters(prev => {
      const currentValues = prev[filterType] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return { ...prev, [filterType]: newValues };
    });
  };

  const clearAllFilters = () => {
    setFilters({
      genres: [],
      regions: [],
      radioStations: [],
      dateRange: '7d'
    });
  };

  const removeFilter = (filterType: keyof FilterState, value: string) => {
    if (filterType === 'dateRange') return;
    
    setFilters(prev => ({
      ...prev,
      [filterType]: (prev[filterType] as string[]).filter(v => v !== value)
    }));
  };

  const getTotalActiveFilters = () => {
    return filters.genres.length + filters.regions.length + filters.radioStations.length;
  };

  const renderFilterDropdown = (title: string, filterType: keyof FilterState, options: FilterOption[]) => {
    const activeValues = filters[filterType] as string[];
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="justify-between min-w-[140px]"
            disabled={loading || optionsLoading}
          >
            <span className="flex items-center gap-2">
              {title}
              {activeValues.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeValues.length}
                </Badge>
              )}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <DropdownMenuItem disabled>
              {optionsLoading ? 'Carregando...' : 'Nenhuma opção disponível'}
            </DropdownMenuItem>
          ) : (
            options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleFilterToggle(filterType, option.value)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activeValues.includes(option.value)}
                    onChange={() => {}}
                    className="rounded"
                  />
                  <span>{option.label}</span>
                </div>
                {option.count && (
                  <span className="text-xs text-gray-500">({option.count})</span>
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
      {/* Header dos Filtros */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">Filtros do Dashboard</h3>
          {getTotalActiveFilters() > 0 && (
            <Badge variant="outline" className="text-xs">
              {getTotalActiveFilters()} ativo{getTotalActiveFilters() > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {getTotalActiveFilters() > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-xs"
            >
              Limpar Todos
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            {isFiltersOpen ? 'Ocultar' : 'Mostrar'} Filtros
          </Button>
        </div>
      </div>

      {/* Filtros Expandidos */}
      {isFiltersOpen && (
        <div className="space-y-4">
          {/* Linha 1: Período e Gênero */}
          <div className="flex flex-wrap gap-3">
            {/* Filtro de Período */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between min-w-[140px]">
                  <span>Período</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {dateRangeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleFilterToggle('dateRange', option.value)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      checked={filters.dateRange === option.value}
                      onChange={() => {}}
                      className="rounded"
                    />
                    <span>{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filtro de Gênero */}
            {renderFilterDropdown('Gênero', 'genres', availableOptions.genres)}
          </div>

          {/* Linha 2: Região e Estação de Rádio */}
          <div className="flex flex-wrap gap-3">
            {/* Filtro de Região */}
            {renderFilterDropdown('Região', 'regions', availableOptions.regions)}
            
            {/* Filtro de Estação de Rádio */}
            {renderFilterDropdown('Estação de Rádio', 'radioStations', availableOptions.radioStations)}
          </div>

          {/* Filtros Ativos */}
          {getTotalActiveFilters() > 0 && (
            <div className="pt-3 border-t">
              <div className="flex flex-wrap gap-2">
                {filters.genres.map(genre => (
                  <Badge key={`genre-${genre}`} variant="secondary" className="flex items-center gap-1">
                    Gênero: {genre}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeFilter('genres', genre)}
                    />
                  </Badge>
                ))}
                {filters.regions.map(region => (
                  <Badge key={`region-${region}`} variant="secondary" className="flex items-center gap-1">
                    Região: {region}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeFilter('regions', region)}
                    />
                  </Badge>
                ))}
                {filters.radioStations.map(radio => (
                  <Badge key={`radio-${radio}`} variant="secondary" className="flex items-center gap-1">
                    Rádio: {radio}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeFilter('radioStations', radio)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;
export type { FilterState, DashboardFiltersProps };