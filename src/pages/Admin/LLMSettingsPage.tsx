import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, Settings, Brain, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

// Serviços
import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api.ts';

// Componentes UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Switch component not available, using checkbox instead

interface LLMProvider {
  id: string;
  provider_name: string;
  api_key: string;
  api_url: string;
  model_name: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LLMProviderForm {
  provider_name: string;
  api_key: string;
  api_url: string;
  model_name: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
}

const LLMSettingsPage: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<LLMProviderForm>({
    provider_name: '',
    api_key: '',
    api_url: '',
    model_name: '',
    max_tokens: 1000,
    temperature: 0.7,
    is_active: false,
  });

  // Estados para busca de modelos
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Modelos atualizados por provedor (Janeiro 2025)
  const modelsByProvider = {
    'OpenAI': [
      // GPT-4 Models (Latest)
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4-0125-preview',
      'gpt-4-1106-preview',
      'gpt-4',
      'gpt-4-0613',
      // GPT-3.5 Models
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
      'gpt-3.5-turbo-16k',
      // O1 Models (Reasoning)
      'o1-preview',
      'o1-mini',
    ],
    'Anthropic': [
      // Claude 3.5 (Latest)
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      // Claude 3 Models
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      // Legacy Claude Models
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ],
    'Google': [
      // Gemini 2.0 (Latest)
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',
      // Gemini 1.5 Models
      'gemini-1.5-pro',
      'gemini-1.5-pro-002',
      'gemini-1.5-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-8b',
      // Gemini 1.0 Models
      'gemini-1.0-pro',
      'gemini-1.0-pro-vision',
      // Legacy Models
      'text-bison-001',
      'chat-bison-001',
    ],
    'Cohere': [
      // Command R Models (Latest)
      'command-r-plus',
      'command-r',
      'command-r-08-2024',
      // Command Models
      'command',
      'command-nightly',
      'command-light',
      'command-light-nightly',
      // Embed Models
      'embed-english-v3.0',
      'embed-multilingual-v3.0',
      'embed-english-light-v3.0',
      'embed-multilingual-light-v3.0',
    ],
    'Mistral': [
      // Mistral Large (Latest)
      'mistral-large-latest',
      'mistral-large-2407',
      'mistral-large-2402',
      // Mistral Medium/Small
      'mistral-medium-latest',
      'mistral-small-latest',
      'mistral-small-2402',
      // Codestral
      'codestral-latest',
      'codestral-2405',
      // Open Models
      'open-mistral-7b',
      'open-mixtral-8x7b',
      'open-mixtral-8x22b',
    ],
    'Perplexity': [
      // Perplexity Models
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-huge-128k-online',
      'llama-3.1-sonar-small-128k-chat',
      'llama-3.1-sonar-large-128k-chat',
      'llama-3.1-8b-instruct',
      'llama-3.1-70b-instruct',
    ]
  };

  // Carregar provedores na montagem do componente
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet('/api/admin/llm-settings');
      
      // Garantir que data é um array
      if (Array.isArray(data)) {
        setProviders(data);
      } else if (data && Array.isArray(data.providers)) {
        setProviders(data.providers);
      } else if (data && data.settings) {
        // API retornou configurações em vez de provedores
        // Por enquanto, mostrar array vazio até corrigir as rotas do servidor
        console.warn('API retornou configurações em vez de provedores. Rotas do servidor precisam ser corrigidas.');
        setProviders([]);
      } else {
        console.warn('Dados recebidos não são um array:', data);
        setProviders([]);
      }
    } catch (error) {
      console.error('Erro ao carregar provedores:', error);
      toast.error('Não foi possível carregar os provedores de IA');
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Função para buscar modelos disponíveis do provedor
  const fetchAvailableModels = async () => {
    if (!formData.provider_name) {
      toast.error('Selecione um provedor primeiro');
      return;
    }

    setIsLoadingModels(true);
    setModelsError(null);

    try {
      // Se temos API key, tentar buscar modelos em tempo real
      if (formData.api_key) {
        try {
          const response = await apiPost('/api/admin/llm-settings/test-connection', {
            provider_name: formData.provider_name,
            api_key: formData.api_key,
            api_url: formData.api_url
          });

          if (response.models && Array.isArray(response.models)) {
            setAvailableModels(response.models);
            toast.success(`${response.models.length} modelos encontrados via API`);
            return;
          }
        } catch (apiError) {
          console.warn('Erro ao buscar modelos via API, usando modelos padrão:', apiError);
        }
      }

      // Fallback para modelos padrão
      const models = modelsByProvider[formData.provider_name as keyof typeof modelsByProvider] || [];
      
      if (models.length === 0) {
        setModelsError(`Nenhum modelo encontrado para ${formData.provider_name}`);
        toast.warning(`Nenhum modelo pré-configurado para ${formData.provider_name}. Digite manualmente.`);
      } else {
        setAvailableModels(models);
        toast.success(`${models.length} modelos padrão carregados para ${formData.provider_name}`);
      }
    } catch (error) {
      setModelsError('Erro ao buscar modelos');
      toast.error('Erro ao buscar modelos disponíveis');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Função para obter modelos padrão quando o provedor muda
  const getDefaultModelsForProvider = (providerName: string) => {
    const models = modelsByProvider[providerName as keyof typeof modelsByProvider] || [];
    setAvailableModels(models);
    
    // Se há modelos disponíveis e nenhum modelo está selecionado, selecionar o primeiro
    if (models.length > 0 && !formData.model_name) {
      setFormData(prev => ({ ...prev, model_name: models[0] }));
    }
  };

  // Atualizar modelos quando o provedor muda
  const handleProviderChange = (providerName: string) => {
    setFormData(prev => ({ 
      ...prev, 
      provider_name: providerName,
      model_name: '', // Limpar modelo selecionado
      api_url: getDefaultApiUrl(providerName) // Definir URL padrão
    }));
    
    // Carregar modelos automaticamente
    if (providerName) {
      getDefaultModelsForProvider(providerName);
    } else {
      setAvailableModels([]);
    }
    
    // Limpar erros anteriores
    setModelsError(null);
  };

  // Função para obter URL padrão da API baseada no provedor
  const getDefaultApiUrl = (providerName: string): string => {
    const defaultUrls = {
      'OpenAI': 'https://api.openai.com/v1/chat/completions',
      'Anthropic': 'https://api.anthropic.com/v1/messages',
      'Google': 'https://generativelanguage.googleapis.com/v1beta/models',
      'Cohere': 'https://api.cohere.ai/v1/generate',
      'Mistral': 'https://api.mistral.ai/v1/chat/completions',
      'Perplexity': 'https://api.perplexity.ai/chat/completions'
    };
    
    return defaultUrls[providerName as keyof typeof defaultUrls] || '';
  };

  const handleSave = async (settings: LLMProviderForm) => {
    try {
      setIsSaving(true);

      if (editingProvider) {
        await apiPut(`/api/admin/llm-settings/${editingProvider.id}`, settings);
        toast.success('Provedor atualizado com sucesso');
      } else {
        await apiPost('/api/admin/llm-settings', settings);
        toast.success('Provedor criado com sucesso');
      }

      // Recarregar lista
      await loadProviders();
      handleCloseModal();
    } catch (error) {
      toast.error('Não foi possível salvar as configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (provider: LLMProvider) => {
    try {
      const updatedProvider = { ...provider, is_active: !provider.is_active };
      
      await apiPut(`/api/admin/llm-settings/${provider.id}`, updatedProvider);

      toast.success(`Provedor ${updatedProvider.is_active ? 'ativado' : 'desativado'} com sucesso`);

      // Recarregar lista
      await loadProviders();
    } catch (error) {
      toast.error('Não foi possível atualizar o status do provedor');
    }
  };

  const handleDelete = async (provider: LLMProvider) => {
    if (!confirm(`Tem certeza que deseja excluir o provedor "${provider.provider_name}"?`)) {
      return;
    }

    try {
      await apiDelete(`/api/admin/llm-settings/${provider.id}`);
      toast.success('Provedor excluído com sucesso');

      // Recarregar lista
      await loadProviders();
    } catch (error) {
      toast.error('Não foi possível excluir o provedor');
    }
  };

  const handleOpenModal = (provider?: LLMProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        provider_name: provider.provider_name,
        api_key: provider.api_key,
        api_url: provider.api_url,
        model_name: provider.model_name,
        max_tokens: provider.max_tokens,
        temperature: provider.temperature,
        is_active: provider.is_active,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        provider_name: '',
        api_key: '',
        api_url: '',
        model_name: '',
        max_tokens: 1000,
        temperature: 0.7,
        is_active: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingProvider(null);
    setFormData({
      provider_name: '',
      api_key: '',
      api_url: '',
      model_name: '',
      max_tokens: 1000,
      temperature: 0.7,
      is_active: false,
    });
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(formData);
  };

  const maskApiKey = (apiKey: string) => {
    if (!apiKey || apiKey.length < 8) return apiKey;
    return `${apiKey.substring(0, 4)}****...${apiKey.substring(apiKey.length - 4)}`;
  };

  const getProviderIcon = (providerName: string) => {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🧠';
      case 'google':
        return '🔍';
      default:
        return '⚡';
    }
  };









  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'default' : 'secondary'}>
        {isActive ? 'Ativo' : 'Inativo'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configurações dos Provedores de IA</h1>
            <p className="text-muted-foreground">
              Gerencie os provedores de IA para geração de insights
            </p>
          </div>
        </div>
        
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Novo Provedor
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante!</strong> Apenas um provedor pode estar ativo por vez. 
          Ao ativar um provedor, todos os outros serão automaticamente desativados.
        </AlertDescription>
      </Alert>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Provedores Configurados
          </CardTitle>
          <CardDescription>
            Lista de provedores de IA disponíveis para geração de insights
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum provedor configurado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione um provedor de IA para começar a gerar insights.
              </p>
              <Button onClick={() => handleOpenModal()} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeiro Provedor
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Chave de API</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>URL da API</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(providers) && providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getProviderIcon(provider.provider_name)}</span>
                          <span className="font-medium">{provider.provider_name}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <code className="text-sm text-muted-foreground">
                          {maskApiKey(provider.api_key)}
                        </code>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline">
                          {provider.model_name}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {provider.api_url}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={provider.is_active}
                            onChange={() => handleToggleActive(provider)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          {getStatusBadge(provider.is_active)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenModal(provider)}
                            className="gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            Editar
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(provider)}
                            className="gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para Adicionar/Editar Provedor */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Editar Provedor' : 'Adicionar Novo Provedor'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações do provedor de IA
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider_name">Nome do Provedor *</Label>
                <select
                  id="provider_name"
                  value={formData.provider_name}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione um provedor</option>
                  <option value="OpenAI">OpenAI</option>
                  <option value="Anthropic">Anthropic</option>
                  <option value="Google">Google</option>
                  <option value="Cohere">Cohere</option>
                  <option value="Mistral">Mistral</option>
                  <option value="Perplexity">Perplexity</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="model_name">Nome do Modelo *</Label>
                  {formData.provider_name && formData.api_key && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchAvailableModels}
                      disabled={isLoadingModels}
                      className="gap-2"
                    >
                      {isLoadingModels ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        '🔄'
                      )}
                      {isLoadingModels ? 'Buscando...' : 'Buscar Modelos'}
                    </Button>
                  )}
                </div>
                
                {availableModels.length > 0 ? (
                  <select
                    id="model_name"
                    value={formData.model_name}
                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione um modelo</option>
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <select
                      id="model_name"
                      value={formData.model_name}
                      onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione um modelo</option>
                      {formData.provider_name && (modelsByProvider[formData.provider_name as keyof typeof modelsByProvider] || []).map((model) => (
                        <option key={model} value={model}>
                          {model} (padrão)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      💡 Modelos padrão mostrados. Use "Buscar Modelos" para ver modelos disponíveis em tempo real.
                    </p>
                  </div>
                )}
                
                {modelsError && (
                  <p className="text-xs text-red-600">
                    ⚠️ {modelsError}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key">Chave de API *</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="sk-..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_url">URL da API *</Label>
              <Input
                id="api_url"
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 1000 })}
                  min={100}
                  max={4000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 0.7 })}
                  min={0}
                  max={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Ativar este provedor</Label>
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingProvider ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LLMSettingsPage;