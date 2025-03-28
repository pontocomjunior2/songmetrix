import React, { useState, useEffect } from 'react';
import { Check, X, Eye, ExternalLink, AlertTriangle } from 'lucide-react';
import { getRadioSuggestions, updateRadioSuggestionStatus, RadioSuggestion } from '../../services/radioSuggestionService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { AppError } from '../../utils/AppError';

function RadioSuggestionsAdmin() {
  const [suggestions, setSuggestions] = useState<RadioSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{message: string, details?: string} | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RadioSuggestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const loadSuggestions = async (status?: 'pending' | 'approved' | 'rejected') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRadioSuggestions(status);
      setSuggestions(data);
    } catch (err) {
      if (err instanceof AppError) {
        setError({
          message: err.message,
          details: err.details
        });
      } else {
        setError({message: 'Erro ao carregar sugestões'});
      }
      console.error('Erro ao carregar sugestões:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'all') {
      loadSuggestions();
    } else {
      loadSuggestions(activeTab);
    }
  }, [activeTab]);

  const handleUpdateStatus = async (id: number | undefined, status: 'pending' | 'approved' | 'rejected') => {
    if (!id) return;
    
    try {
      await updateRadioSuggestionStatus(id, status);
      // Recarregar a lista
      loadSuggestions(activeTab === 'all' ? undefined : activeTab);
    } catch (err) {
      if (err instanceof AppError) {
        setError({
          message: err.message,
          details: err.details
        });
      } else {
        setError({message: 'Erro ao atualizar status'});
      }
      console.error('Erro ao atualizar status:', err);
    }
  };

  const handleViewDetails = (suggestion: RadioSuggestion) => {
    setSelectedSuggestion(suggestion);
    setIsDialogOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovada';
      case 'rejected': return 'Rejeitada';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sugestões de Rádios</h2>
      
      {error && (
        <Alert className="mb-4 bg-red-100 text-red-800 border-red-200">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">{error.message}</h3>
              {error.details && <p className="text-sm mt-1">{error.details}</p>}
              {error.message === 'Tabela de sugestões não configurada' && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <p className="font-medium">Instruções:</p>
                  <ol className="list-decimal list-inside mt-1 pl-2 space-y-1">
                    <li>Acesse o console do Supabase</li>
                    <li>Navegue até a seção SQL Editor</li>
                    <li>Execute o script de criação da tabela radio_suggestions</li>
                    <li>O script está disponível em: supabase/migrations/radio_suggestions.sql</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </Alert>
      )}
      
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === 'pending' 
                ? 'text-blue-600 border-b-2 border-blue-600 active' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('pending')}
            >
              Pendentes
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === 'approved' 
                ? 'text-blue-600 border-b-2 border-blue-600 active' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('approved')}
            >
              Aprovadas
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === 'rejected' 
                ? 'text-blue-600 border-b-2 border-blue-600 active' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejeitadas
            </button>
          </li>
          <li>
            <button
              className={`inline-block p-4 ${activeTab === 'all' 
                ? 'text-blue-600 border-b-2 border-blue-600 active' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('all')}
            >
              Todas
            </button>
          </li>
        </ul>
      </div>
      
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando sugestões...</p>
        </div>
      ) : suggestions.length === 0 && !error ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          Nenhuma sugestão de rádio encontrada.
        </div>
      ) : error ? null : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rádio</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Localização</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Usuário</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {suggestions.map((suggestion) => (
                <tr key={suggestion.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.radio_name}</div>
                    {suggestion.stream_url && (
                      <a 
                        href={suggestion.stream_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 mt-1"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Stream
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {suggestion.city}, {suggestion.state}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {suggestion.user_email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {formatDate(suggestion.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(suggestion.status)}`}>
                      {getStatusLabel(suggestion.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleViewDetails(suggestion)}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        title="Ver detalhes"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      
                      {suggestion.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdateStatus(suggestion.id, 'approved')}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                          title="Aprovar"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      
                      {suggestion.status !== 'rejected' && (
                        <button
                          onClick={() => handleUpdateStatus(suggestion.id, 'rejected')}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Rejeitar"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal de detalhes */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Sugestão</DialogTitle>
            <DialogDescription>
              Informações completas sobre a sugestão de rádio
            </DialogDescription>
          </DialogHeader>
          
          {selectedSuggestion && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Rádio</h3>
                <p className="text-base text-gray-900 dark:text-white">{selectedSuggestion.radio_name}</p>
              </div>
              
              {selectedSuggestion.stream_url && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">URL do Stream</h3>
                  <a 
                    href={selectedSuggestion.stream_url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {selectedSuggestion.stream_url}
                  </a>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Localização</h3>
                <p className="text-base text-gray-900 dark:text-white">{selectedSuggestion.city}, {selectedSuggestion.state}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Sugerido por</h3>
                <p className="text-base text-gray-900 dark:text-white">{selectedSuggestion.user_email || 'N/A'}</p>
              </div>
              
              {selectedSuggestion.contact_email && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email de contato</h3>
                  <p className="text-base text-gray-900 dark:text-white">{selectedSuggestion.contact_email}</p>
                </div>
              )}
              
              {selectedSuggestion.additional_info && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Informações adicionais</h3>
                  <p className="text-base text-gray-900 dark:text-white whitespace-pre-line">{selectedSuggestion.additional_info}</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedSuggestion.status)}`}>
                  {getStatusLabel(selectedSuggestion.status)}
                </span>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de criação</h3>
                <p className="text-base text-gray-900 dark:text-white">{formatDate(selectedSuggestion.created_at)}</p>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                {selectedSuggestion.status !== 'approved' && (
                  <Button
                    onClick={() => {
                      handleUpdateStatus(selectedSuggestion.id, 'approved');
                      setIsDialogOpen(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Aprovar
                  </Button>
                )}
                
                {selectedSuggestion.status !== 'rejected' && (
                  <Button
                    onClick={() => {
                      handleUpdateStatus(selectedSuggestion.id, 'rejected');
                      setIsDialogOpen(false);
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Rejeitar
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RadioSuggestionsAdmin; 