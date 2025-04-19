import React, { useState, useEffect } from 'react';
import { Star, Radio, Loader2, ArrowUpDown, Search } from 'lucide-react';
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

export default function Radios() {
  const { currentUser, planId } = useAuth();
  const { refresh } = useFavoriteRadios(); // Adicionando a chamada ao hook
  const isAdmin = planId === 'admin';
  const [radios, setRadios] = useState<RadioStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchRadios();
    }
  }, [currentUser]);

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
              <TableHead className="text-right">Favorito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRadios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 3} className="h-24 text-center">
                  Nenhuma rádio encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredRadios.map((radio) => {
                const { full: fullDate, relative: relativeDate } = formatLastUpdate(radio.lastUpdate);
                return (
                  <TableRow key={radio.name}>
                    <TableCell>
                      <Radio className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{radio.name}</div>
                      {isAdmin && (
                        <div className="text-sm text-muted-foreground">
                          Atualizado {relativeDate}
                        </div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              radio.status === 'ONLINE'
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              radio.status === 'ONLINE'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {radio.status}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        <span title={fullDate} className="text-sm">
                          {fullDate}
                        </span>
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
