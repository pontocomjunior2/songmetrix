import React, { useState, useEffect, useCallback } from 'react';
import { Wand2, Eye, Check, Send, Loader2, AlertCircle, Mail, User, Calendar } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Serviços
import { apiGet, apiPost } from '@/services/api.ts';

// Interfaces
interface User {
  email: string;
  full_name?: string;
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

  // Carregar dados na montagem do componente
  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

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

      {/* Card principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Rascunhos para Revisão
          </CardTitle>
          <CardDescription>
            Lista de insights gerados aguardando aprovação e envio
          </CardDescription>
        </CardHeader>
        
        <CardContent>
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

          {/* Tabela de rascunhos */}
          {!isLoading && !error && drafts.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Usuário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead className="w-[150px]">Criado Em</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[200px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((draft) => (
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
                        <Badge variant="outline">
                          {draft.insight_type.replace('_', ' ')}
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
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(selectedDraft.content)
                      }}
                      className="prose prose-sm max-w-none"
                    />
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