import React, { useState, useEffect, useCallback } from 'react';
import { Wand2, Eye, Check, Send, Loader2, AlertCircle, Mail, User, Calendar, Search, Users, Edit3, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'dompurify';

// Componentes UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

// Serviços
import { apiGet, apiPost } from '@/services/api.ts';

// Interfaces
interface User {
  id: string;
  email: string;
  full_name?: string;
  status?: string;
}

interface InsightData {
  userId: string;
  insightType: string;
  songTitle: string;
  artist: string;
  currentWeekPlays: number;
  previousWeekPlays: number;
  growthRate: string;
}

interface Draft {
  id: string;
  user_id: string;
  subject: string;
  content: string;
  insight_type: string;
  insight_data: InsightData;
  deep_link: string;
  status: 'draft' | 'approved' | 'sent' | 'failed';
  created_at: string;
  users: User;
}

interface CustomInsightForm {
  targetType: 'user' | 'group';
  selectedUserId?: string;
  selectedGroup?: string;
  subject: string;
  customPrompt: string;
  variables: string[];
}

// Variáveis disponíveis para o sistema
const AVAILABLE_VARIABLES = [
  { key: 'user_name', description: 'Nome do usuário', example: '{user_name}' },
  { key: 'user_email', description: 'E-mail do usuário', example: '{user_email}' },
  { key: 'top_song', description: 'Música mais tocada', example: '{top_song}' },
  { key: 'top_artist', description: 'Artista mais tocado', example: '{top_artist}' },
  { key: 'total_plays', description: 'Total de execuções', example: '{total_plays}' },
  { key: 'weekly_plays', description: 'Execuções da semana', example: '{weekly_plays}' },
  { key: 'monthly_plays', description: 'Execuções do mês', example: '{monthly_plays}' },
  { key: 'growth_rate', description: 'Taxa de crescimento', example: '{growth_rate}' },
  { key: 'favorite_genre', description: 'Gênero favorito', example: '{favorite_genre}' },
  { key: 'listening_hours', description: 'Horas de escuta', example: '{listening_hours}' },
  { key: 'discovery_count', description: 'Novas descobertas', example: '{discovery_count}' },
  { key: 'peak_hour', description: 'Horário de pico', example: '{peak_hour}' },
  { key: 'weekend_vs_weekday', description: 'Comparação fim de semana vs dias úteis', example: '{weekend_vs_weekday}' },
  { key: 'mood_analysis', description: 'Análise de humor musical', example: '{mood_analysis}' }
];

const USER_GROUPS = [
  { value: 'all', label: 'Todos os usuários' },
  { value: 'admin', label: 'Administradores' },
  { value: 'ativo', label: 'Usuários ativos' },
  { value: 'trial', label: 'Usuários em trial' },
  { value: 'free', label: 'Usuários gratuitos' },
  { value: 'premium', label: 'Usuários premium' },
  { value: 'inactive', label: 'Usuários inativos' }
];

const InsightDashboardPage: React.FC = () => {
  // Estados principais
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Estados do modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Estados para insight customizado
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState<boolean>(false);
  
  // Estados para busca/filtro na tabela de rascunhos
  const [draftsSearch, setDraftsSearch] = useState<string>('');
  const [draftsFilter, setDraftsFilter] = useState<string>('all');
  const [filteredDrafts, setFilteredDrafts] = useState<Draft[]>([]);
  
  const [customForm, setCustomForm] = useState<CustomInsightForm>({
    targetType: 'user',
    selectedUserId: '',
    selectedGroup: '',
    subject: '',
    customPrompt: '',
    variables: []
  });

  // Função para buscar rascunhos
  const fetchDrafts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiGet('/api/admin/insights/drafts');
      setDrafts(response.drafts || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao buscar rascunhos de insights';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Função para buscar usuários
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await apiGet('/api/admin/users?limit=1000');
      setUsers(response.users || []);
      setFilteredUsers(response.users || []);
    } catch (err: any) {
      toast.error('Erro ao buscar usuários');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Filtrar usuários baseado na busca
  useEffect(() => {
    if (!userSearch.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(userSearch.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [userSearch, users]);

  // Filtrar rascunhos baseado na busca e filtro
  useEffect(() => {
    let filtered = [...drafts];

    // Aplicar filtro por tipo
    if (draftsFilter !== 'all') {
      filtered = filtered.filter(draft => {
        switch (draftsFilter) {
          case 'custom':
            return draft.insight_type === 'custom_insight';
          case 'auto':
            return draft.insight_type !== 'custom_insight';
          case 'draft':
            return draft.status === 'draft';
          case 'approved':
            return draft.status === 'approved';
          default:
            return true;
        }
      });
    }

    // Aplicar busca por texto
    if (draftsSearch.trim()) {
      const searchTerm = draftsSearch.toLowerCase();
      filtered = filtered.filter(draft => 
        draft.subject?.toLowerCase().includes(searchTerm) ||
        draft.email_subject?.toLowerCase().includes(searchTerm) ||
        draft.users?.email?.toLowerCase().includes(searchTerm) ||
        draft.users?.full_name?.toLowerCase().includes(searchTerm) ||
        draft.insight_type?.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredDrafts(filtered);
  }, [drafts, draftsSearch, draftsFilter]);

  // Carregar dados na montagem do componente
  useEffect(() => {
    fetchDrafts();
    fetchUsers();
  }, [fetchDrafts, fetchUsers]);

  // Função para iniciar geração de insights
  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    
    try {
      const response = await apiPost('/api/admin/insights/generate', {});
      
      if (response.status === 'accepted') {
        toast.info('Processo de geração iniciado! Os rascunhos estarão disponíveis para revisão em breve.', {
          autoClose: 5000
        });
        
        // Recarregar rascunhos após 30 segundos
        setTimeout(() => {
          fetchDrafts();
        }, 30000);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao iniciar geração de insights';
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Função para aprovar um insight
  const handleApprove = async (draftId: string) => {
    setIsApproving(true);
    
    try {
      await apiPost(`/api/admin/insights/${draftId}/approve`, {});
      toast.success('Insight aprovado com sucesso!');
      
      // Recarregar lista de rascunhos
      await fetchDrafts();
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao aprovar insight';
      toast.error(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  // Função para enviar um insight
  const handleSend = async (draftId: string) => {
    setIsSending(true);
    
    try {
      const response = await apiPost(`/api/admin/insights/${draftId}/send`, {});
      toast.success(`E-mail enviado com sucesso para ${response.recipient}!`);
      
      // Recarregar lista de rascunhos
      await fetchDrafts();
      
      // Fechar modal se estiver aberto
      setIsModalOpen(false);
      setSelectedDraft(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao enviar insight';
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Função para aprovar e enviar
  const handleApproveAndSend = async (draftId: string) => {
    try {
      // Primeiro aprovar
      await handleApprove(draftId);
      
      // Aguardar um pouco e depois enviar
      setTimeout(async () => {
        await handleSend(draftId);
      }, 1000);
    } catch (err: any) {
      toast.error('Erro no processo de aprovação e envio');
    }
  };

  // Função para abrir modal de revisão
  const handleReview = (draft: Draft) => {
    setSelectedDraft(draft);
    setIsModalOpen(true);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  // Função para gerar insight customizado
  const handleGenerateCustomInsight = async () => {
    if (!customForm.subject.trim() || !customForm.customPrompt.trim()) {
      toast.error('Assunto e prompt são obrigatórios');
      return;
    }

    if (customForm.targetType === 'user' && !customForm.selectedUserId) {
      toast.error('Selecione um usuário');
      return;
    }

    if (customForm.targetType === 'group' && !customForm.selectedGroup) {
      toast.error('Selecione um grupo');
      return;
    }

    setIsGeneratingCustom(true);

    try {
      const payload = {
        targetType: customForm.targetType,
        targetId: customForm.targetType === 'user' ? customForm.selectedUserId : customForm.selectedGroup,
        subject: customForm.subject,
        customPrompt: customForm.customPrompt,
        variables: extractVariablesFromPrompt(customForm.customPrompt)
      };

      const response = await apiPost('/api/admin/insights/generate-custom', payload);
      
      if (response.status === 'success') {
        toast.success(`Insight personalizado iniciado! Processando ${response.targetUsers} usuário(s). O rascunho aparecerá na tabela abaixo em alguns segundos.`, {
          autoClose: 8000
        });
        setIsCustomModalOpen(false);
        resetCustomForm();
        
        // Recarregar lista imediatamente
        fetchDrafts();
        
        // Recarregar novamente após 10 segundos para pegar os rascunhos processados
        setTimeout(() => {
          fetchDrafts();
          toast.info('Lista de rascunhos atualizada! Verifique se seu insight personalizado apareceu na tabela.', {
            autoClose: 5000
          });
        }, 10000);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao gerar insight customizado';
      toast.error(errorMessage);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  // Função para extrair variáveis do prompt
  const extractVariablesFromPrompt = (prompt: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(prompt)) !== null) {
      matches.push(match[1]);
    }
    
    return [...new Set(matches)]; // Remove duplicatas
  };

  // Função para resetar formulário customizado
  const resetCustomForm = () => {
    setCustomForm({
      targetType: 'user',
      selectedUserId: '',
      selectedGroup: '',
      subject: '',
      customPrompt: '',
      variables: []
    });
    setUserSearch('');
  };

  // Função para inserir variável no prompt
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('customPrompt') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = customForm.customPrompt;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + `{${variable}}` + after;
      
      setCustomForm(prev => ({ ...prev, customPrompt: newText }));
      
      // Restaurar posição do cursor
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
      }, 0);
    }
  };

  // Função para obter badge de status
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Rascunho', variant: 'secondary' as const },
      approved: { label: 'Aprovado', variant: 'default' as const },
      sent: { label: 'Enviado', variant: 'default' as const },
      failed: { label: 'Falhou', variant: 'destructive' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Insights de IA</h1>
          <p className="text-muted-foreground">
            Gerencie e revise insights musicais gerados automaticamente
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsCustomModalOpen(true)}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Insight Personalizado
          </Button>
          
          <Button 
            onClick={handleGenerateInsights}
            disabled={isGenerating}
            size="lg"
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isGenerating ? 'Gerando...' : 'Gerar Novos Insights'}
          </Button>
        </div>
      </div>

      {/* Card principal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Rascunhos para Revisão
              </CardTitle>
              <CardDescription>
                Lista de insights gerados aguardando aprovação e envio
              </CardDescription>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDrafts}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '🔄'
              )}
              Atualizar Lista
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Busca e Filtros */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Campo de busca */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por usuário, assunto ou tipo..."
                    value={draftsSearch}
                    onChange={(e) => setDraftsSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {/* Filtro por tipo */}
              <div className="w-full sm:w-48">
                <Select value={draftsFilter} onValueChange={setDraftsFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📋 Todos os insights</SelectItem>
                    <SelectItem value="custom">✨ Personalizados</SelectItem>
                    <SelectItem value="auto">🤖 Automáticos</SelectItem>
                    <SelectItem value="draft">📝 Rascunhos</SelectItem>
                    <SelectItem value="approved">✅ Aprovados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Contador de resultados */}
            {(draftsSearch || draftsFilter !== 'all') && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  {filteredDrafts.length} de {drafts.length} insights encontrados
                  {draftsSearch && (
                    <span> para "{draftsSearch}"</span>
                  )}
                </div>
                {(draftsSearch || draftsFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraftsSearch('');
                      setDraftsFilter('all');
                    }}
                    className="h-auto p-1 text-xs"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Estados de carregamento e erro */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Carregando rascunhos...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Lista vazia */}
          {!isLoading && !error && drafts.length === 0 && (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum rascunho para revisar</h3>
              <p className="text-muted-foreground mb-4">
                Não há insights pendentes no momento.
              </p>
              <Button onClick={handleGenerateInsights} variant="outline" className="gap-2">
                <Wand2 className="h-4 w-4" />
                Gerar Novos Insights
              </Button>
            </div>
          )}

          {/* Nenhum resultado encontrado */}
          {!isLoading && !error && drafts.length > 0 && filteredDrafts.length === 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum insight encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Não há insights que correspondam aos critérios de busca.
              </p>
              <Button 
                onClick={() => {
                  setDraftsSearch('');
                  setDraftsFilter('all');
                }} 
                variant="outline" 
                className="gap-2"
              >
                Limpar Filtros
              </Button>
            </div>
          )}

          {/* Tabela de rascunhos */}
          {!isLoading && !error && filteredDrafts.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      Usuário
                      {draftsSearch && (
                        <Search className="inline h-3 w-3 ml-1 text-muted-foreground" />
                      )}
                    </TableHead>
                    <TableHead>
                      Assunto
                      {draftsSearch && (
                        <Search className="inline h-3 w-3 ml-1 text-muted-foreground" />
                      )}
                    </TableHead>
                    <TableHead className="w-[120px]">
                      Tipo
                      {draftsFilter !== 'all' && (
                        <span className="inline-block w-2 h-2 bg-primary rounded-full ml-1"></span>
                      )}
                    </TableHead>
                    <TableHead className="w-[150px]">Criado Em</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[200px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrafts.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {draft.users.full_name || 'Nome não informado'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {draft.users.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="max-w-[300px] truncate" title={draft.subject}>
                          {draft.subject}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          variant={draft.insight_type === 'custom_insight' ? 'default' : 'secondary'}
                          className={draft.insight_type === 'custom_insight' ? 'bg-purple-100 text-purple-800 border-purple-200' : ''}
                        >
                          {draft.insight_type === 'custom_insight' ? '✨ Personalizado' : '🤖 Automático'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(draft.created_at)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getStatusBadge(draft.status)}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(draft)}
                            className="gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Revisar
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(draft.id)}
                            disabled={isApproving || draft.status !== 'draft'}
                            className="gap-1"
                          >
                            {isApproving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Aprovar
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={true}
                            className="gap-1"
                          >
                            <Send className="h-3 w-3" />
                            Enviar
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

      {/* Modal de Insight Personalizado */}
      <Dialog open={isCustomModalOpen} onOpenChange={setIsCustomModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Gerar Insight Personalizado
            </DialogTitle>
            <DialogDescription>
              Crie insights personalizados usando prompts livres com variáveis dinâmicas
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário Principal */}
            <div className="lg:col-span-2 space-y-6">
              <Tabs value={customForm.targetType} onValueChange={(value) => 
                setCustomForm(prev => ({ ...prev, targetType: value as 'user' | 'group' }))
              }>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="user" className="gap-2">
                    <User className="h-4 w-4" />
                    Usuário Específico
                  </TabsTrigger>
                  <TabsTrigger value="group" className="gap-2">
                    <Users className="h-4 w-4" />
                    Grupo de Usuários
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="user" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userSearch">Buscar Usuário</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="userSearch"
                        placeholder="Digite nome ou e-mail do usuário..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {userSearch && (
                      <div className="text-xs text-muted-foreground">
                        {filteredUsers.length} usuário(s) encontrado(s)
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Selecionar Usuário {customForm.selectedUserId && '✓'}</Label>
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Carregando usuários...
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {userSearch ? (
                            <div>
                              <div>❌ Nenhum usuário encontrado para "{userSearch}"</div>
                              <div className="text-xs mt-1">Tente buscar por nome ou e-mail</div>
                            </div>
                          ) : (
                            <div>
                              <div>📭 Nenhum usuário disponível</div>
                              <div className="text-xs mt-1">Verifique se há usuários cadastrados</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredUsers.slice(0, 50).map((user) => (
                            <div
                              key={user.id}
                              className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                                customForm.selectedUserId === user.id ? 'bg-primary/10 border-l-4 border-primary' : ''
                              }`}
                              onClick={() => setCustomForm(prev => ({ ...prev, selectedUserId: user.id }))}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {user.full_name || 'Nome não informado'}
                                    {customForm.selectedUserId === user.id && ' ✓'}
                                  </div>
                                  <div className="text-sm text-muted-foreground truncate">
                                    {user.email}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {user.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {user.status}
                                    </Badge>
                                  )}
                                  {customForm.selectedUserId === user.id && (
                                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredUsers.length > 50 && (
                            <div className="p-3 text-center text-muted-foreground text-xs">
                              Mostrando primeiros 50 usuários. Use a busca para refinar.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="group" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupSelect">Selecionar Grupo</Label>
                    <Select
                      value={customForm.selectedGroup}
                      onValueChange={(value) => setCustomForm(prev => ({ ...prev, selectedGroup: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um grupo de usuários" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_GROUPS.map((group) => (
                          <SelectItem key={group.value} value={group.value}>
                            {group.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="subject">Assunto do E-mail</Label>
                <Input
                  id="subject"
                  placeholder="Ex: Suas descobertas musicais desta semana"
                  value={customForm.subject}
                  onChange={(e) => setCustomForm(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customPrompt">Prompt Personalizado</Label>
                <Textarea
                  id="customPrompt"
                  placeholder="Escreva seu prompt aqui. Use variáveis como {user_name}, {top_song}, etc."
                  value={customForm.customPrompt}
                  onChange={(e) => setCustomForm(prev => ({ ...prev, customPrompt: e.target.value }))}
                  rows={8}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground">
                  💡 Use variáveis entre chaves {} para inserir dados dinâmicos do banco de dados
                </div>
              </div>

              {/* Preview das variáveis detectadas */}
              {customForm.customPrompt && (
                <div className="space-y-2">
                  <Label>Variáveis Detectadas no Prompt</Label>
                  <div className="flex flex-wrap gap-2">
                    {extractVariablesFromPrompt(customForm.customPrompt).map((variable) => (
                      <Badge key={variable} variant="secondary" className="text-xs">
                        {`{${variable}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Painel de Variáveis Disponíveis */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Variáveis Disponíveis</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <Card key={variable.key} className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div 
                        onClick={() => insertVariable(variable.key)}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {variable.example}
                          </code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            +
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {variable.description}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Como usar:</strong><br />
                  Clique nas variáveis para inseri-las no prompt. O sistema buscará automaticamente os dados correspondentes no banco de dados.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCustomModalOpen(false);
                resetCustomForm();
              }}
            >
              Cancelar
            </Button>
            
            <Button
              onClick={() => {
                console.log('🔍 Debug - Estado do formulário:', {
                  isGeneratingCustom,
                  subject: customForm.subject,
                  customPrompt: customForm.customPrompt,
                  targetType: customForm.targetType,
                  selectedUserId: customForm.selectedUserId,
                  selectedGroup: customForm.selectedGroup
                });
                handleGenerateCustomInsight();
              }}
              disabled={
                isGeneratingCustom || 
                !customForm.subject.trim() || 
                !customForm.customPrompt.trim() ||
                (customForm.targetType === 'user' && !customForm.selectedUserId) ||
                (customForm.targetType === 'group' && !customForm.selectedGroup)
              }
              className="gap-2"
            >
              {isGeneratingCustom ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGeneratingCustom ? 'Gerando...' : 'Gerar Insight'}
            </Button>
          </DialogFooter>
          
          {/* Indicador de campos obrigatórios */}
          {(!customForm.subject.trim() || 
            !customForm.customPrompt.trim() ||
            (customForm.targetType === 'user' && !customForm.selectedUserId) ||
            (customForm.targetType === 'group' && !customForm.selectedGroup)) && (
            <div className="mt-2 text-xs text-muted-foreground text-center">
              💡 Preencha todos os campos obrigatórios para habilitar o botão "Gerar Insight"
              <div className="mt-1">
                {!customForm.subject.trim() && <span className="text-red-500">• Assunto do e-mail </span>}
                {!customForm.customPrompt.trim() && <span className="text-red-500">• Prompt personalizado </span>}
                {customForm.targetType === 'user' && !customForm.selectedUserId && <span className="text-red-500">• Usuário selecionado </span>}
                {customForm.targetType === 'group' && !customForm.selectedGroup && <span className="text-red-500">• Grupo selecionado </span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Revisão */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {selectedDraft?.subject}
            </DialogTitle>
            <DialogDescription>
              Revise o conteúdo do insight antes de aprovar e enviar
            </DialogDescription>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4">
              {/* Informações do destinatário */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Informações do Destinatário</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Nome:</span>{' '}
                      {selectedDraft.users.full_name || 'Não informado'}
                    </div>
                    <div>
                      <span className="font-medium">E-mail:</span>{' '}
                      {selectedDraft.users.email}
                    </div>
                    <div>
                      <span className="font-medium">Tipo:</span>{' '}
                      {selectedDraft.insight_type.replace('_', ' ')}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      {getStatusBadge(selectedDraft.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados do insight */}
              {selectedDraft.insight_data && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Dados do Insight</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Música:</span>{' '}
                        {selectedDraft.insight_data.songTitle}
                      </div>
                      <div>
                        <span className="font-medium">Artista:</span>{' '}
                        {selectedDraft.insight_data.artist}
                      </div>
                      <div>
                        <span className="font-medium">Execuções (semana atual):</span>{' '}
                        {selectedDraft.insight_data.currentWeekPlays}
                      </div>
                      <div>
                        <span className="font-medium">Execuções (semana anterior):</span>{' '}
                        {selectedDraft.insight_data.previousWeekPlays}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Taxa de crescimento:</span>{' '}
                        <Badge variant="secondary">
                          {selectedDraft.insight_data.growthRate}x
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Preview do conteúdo HTML */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Preview do E-mail</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="border rounded-lg p-4 bg-muted/50 max-h-96 overflow-y-auto">
                    {(() => {
                      // Tentar diferentes campos onde o conteúdo pode estar
                      const content = selectedDraft.email_content || 
                                    selectedDraft.content || 
                                    selectedDraft.body_html || 
                                    '';
                      
                      if (!content.trim()) {
                        return (
                          <div className="text-center text-muted-foreground py-8">
                            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <div className="text-lg font-medium mb-2">Conteúdo não disponível</div>
                            <div className="text-sm">
                              O conteúdo do e-mail não foi gerado ou está vazio.
                              <br />
                              Isso pode acontecer se houve erro na geração via IA.
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(content)
                          }}
                          className="prose prose-sm max-w-none"
                        />
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Fechar
            </Button>
            
            {selectedDraft?.status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => selectedDraft && handleApprove(selectedDraft.id)}
                  disabled={isApproving}
                  className="gap-2"
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Apenas Aprovar
                </Button>
                
                <Button
                  onClick={() => selectedDraft && handleApproveAndSend(selectedDraft.id)}
                  disabled={isApproving || isSending}
                  className="gap-2"
                >
                  {isApproving || isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Aprovar e Enviar
                </Button>
              </>
            )}
            
            {selectedDraft?.status === 'approved' && (
              <Button
                onClick={() => selectedDraft && handleSend(selectedDraft.id)}
                disabled={isSending}
                className="gap-2"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar E-mail
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InsightDashboardPage;