import React, { useEffect, useState, useRef, useCallback } from 'react';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast as reactToast } from 'react-toastify'; // Importing toast for notifications
import { Trash2, Clock, RefreshCw, MailCheck, Database, Calendar, Search, Timer, TimerOff, Hourglass } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { FaEdit } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import { syncUserWithSendPulse, type UserData as SendPulseUserData } from '../../utils/sendpulse-service';
import { Input } from '../ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { ResponsiveDataTable, type ResponsiveColumn } from '@/components/ui/responsive-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

// Atualizar mapeamento de plan_id para exibição (CHAVES em MAIÚSCULAS)
const PLAN_DISPLAY_NAMES: { [key: string]: string } = {
  ADMIN: 'Admin',
  TRIAL: 'Teste',       // Chave em maiúsculas
  FREE: 'Gratuito',
  ATIVO: 'Ativo',       // Plano pago (Chave já estava em maiúsculas)
  INATIVO: 'Inativo',     // Definido pelo Admin (Chave já estava em maiúsculas)
};

// Definir os plan_ids que o admin pode selecionar manualmente (VALORES em MAIÚSCULAS)
const SELECTABLE_PLANS = ['FREE', 'TRIAL', 'ATIVO', 'INATIVO', 'ADMIN']; // Adicionado 'ADMIN'

// Atualizar interface User para remover 'status' se não for mais necessário
interface User {
  id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
  photoURL?: string;
  full_name?: string;
  whatsapp?: string;
  last_sign_in_at?: string;
  plan_id?: string | null; // Permitir null explicitamente
}

interface SyncProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  percentage: number;
}

// Adicionar interface para o tipo de evento
interface SyncEventData {
  type: string;
  processed?: number;
  total?: number;
  success?: boolean;
  email?: string;
  message?: string;
  percentage?: number;
  errors?: number;
  totalUsers?: number;
  errorDetails?: Array<{user: string, error: string}>;
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<string | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResults, setSyncResults] = useState<any | null>(null);
  const [updatingLastLogin, setUpdatingLastLogin] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { currentUser, loading: authLoading, isInitialized } = useAuth();
  const [syncingUsers, setSyncingUsers] = useState<string[]>([]);
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkPlanId, setBulkPlanId] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState<boolean>(false);

  // Combinar estado de loading local com o do Auth
  const isLoading = loading || authLoading || !isInitialized;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Carregando usuários...');
      
      const { data: usersData, error: fetchError } = await supabase
        .from('users')
        .select('id, email, created_at, updated_at, full_name, whatsapp, last_sign_in_at, plan_id')
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        throw fetchError;
      }
      
      console.log('Usuários carregados:', usersData);
      
      console.log('[loadUsers] Usuários recebidos da API:', usersData); // Log antes de processar
      
      const processedUsers = usersData.map(user => ({ ...user, plan_id: user.plan_id || null }));
      console.log('[loadUsers] Usuários processados para o estado:', processedUsers.find(u => u.email === 'pontocomjunior10@gmail.com')); // Log específico
      setUsers(processedUsers);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      let errorMessage = 'Erro ao carregar usuários';
      
      if (error.message.includes('permission denied')) {
        errorMessage = 'Acesso negado. Apenas administradores podem visualizar usuários.';
      } else {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Apenas buscar usuários se a autenticação estiver inicializada
    if (isInitialized) {
        fetchUsers();
    }
  }, [fetchUsers, isInitialized]);

  useEffect(() => {
    filterUsers();
  }, [users, planFilter, searchTerm]);

  // Limpar recursos ao desmontar o componente
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const filterUsers = () => {
    let tempUsers = users;

    // 1. Filtrar por plano
    if (planFilter !== 'ALL') {
      tempUsers = tempUsers.filter(user => user.plan_id === planFilter);
    }

    // 2. Filtrar por termo de busca (nome ou email)
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      tempUsers = tempUsers.filter(user => 
        (user.full_name && user.full_name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.email && user.email.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    setFilteredUsers(tempUsers);
  };

  const handleToggleSelectUser = useCallback((userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }, []);

  const handleToggleSelectAllVisible = useCallback(() => {
    setSelectedUserIds(prev => {
      const allVisibleIds = filteredUsers.map(u => u.id);
      const areAllSelected = allVisibleIds.every(id => prev.has(id));
      if (areAllSelected) {
        // Desmarca todos os visíveis
        const next = new Set(prev);
        for (const id of allVisibleIds) next.delete(id);
        return next;
      }
      // Marca todos os visíveis
      const next = new Set(prev);
      for (const id of allVisibleIds) next.add(id);
      return next;
    });
  }, [filteredUsers]);

  const handleClearSelection = useCallback(() => {
    setSelectedUserIds(new Set());
    setBulkPlanId('');
  }, []);

  const handleApplyBulkPlanChange = useCallback(async () => {
    if (!bulkPlanId) {
      reactToast.warn('Selecione um status/plano para aplicar.');
      return;
    }
    if (selectedUserIds.size === 0) {
      reactToast.warn('Selecione ao menos um usuário.');
      return;
    }

    // Obter token uma única vez
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      setError('Token de autenticação não encontrado. Faça login novamente.');
      return;
    }
    const token = sessionData.session.access_token;

    setIsBulkUpdating(true);

    // Mapear planos anteriores para possível rollback
    const previousPlans = new Map<string, string | null>();
    users.forEach(u => { if (selectedUserIds.has(u.id)) previousPlans.set(u.id, u.plan_id ?? null); });

    // Otimista
    setUsers(prev => prev.map(u => selectedUserIds.has(u.id) ? { ...u, plan_id: bulkPlanId } : u));

    try {
      const requests = Array.from(selectedUserIds).map(userId => (
        fetch(`/api/admin/users/${userId}/plan`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ planId: bulkPlanId })
        })
          .then(async (res) => ({ ok: res.ok, id: userId, body: await res.json().catch(() => ({})) }))
          .catch(() => ({ ok: false, id: userId, body: { error: 'Network error' } }))
      ));

      const results = await Promise.all(requests);
      const failed = results.filter(r => !r.ok);
      const succeeded = results.filter(r => r.ok);

      if (failed.length > 0) {
        // Rollback nos que falharam
        setUsers(prev => prev.map(u => {
          const fail = failed.find(f => f.id === u.id);
          if (fail) {
            const prevPlan = previousPlans.get(u.id) ?? null;
            return { ...u, plan_id: prevPlan ?? undefined } as User;
          }
          return u;
        }));
        reactToast.error(`Falha ao atualizar ${failed.length} de ${results.length} usuários.`);
      }
      if (succeeded.length > 0) {
        reactToast.success(`${succeeded.length} usuário(s) atualizado(s) para ${PLAN_DISPLAY_NAMES[bulkPlanId] || bulkPlanId}.`);
      }

      // Atualizar sessão do Supabase para refletir metadados (não bloqueante)
      supabase.auth.refreshSession().catch(() => {});

    } finally {
      setIsBulkUpdating(false);
      handleClearSelection();
    }
  }, [bulkPlanId, selectedUserIds, supabase, users, handleClearSelection]);

  const handlePlanChange = useCallback(async (userId: string, newPlanId: string) => {
    console.log(`Attempting to change plan for user ${userId} to ${newPlanId}`);

    // Obter o token da sessão atual do supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      console.error('Erro ao obter token de autenticação:', sessionError);
      setError('Token de autenticação não encontrado ou inválido. Faça login novamente.');
      return;
    }
    const token = sessionData.session.access_token;

    setUpdatingPlanId(userId);
    const previousPlan = users.find(u => u.id === userId)?.plan_id ?? null;
    // Otimista: atualiza imediatamente o plano na UI
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, plan_id: newPlanId } : u)));
    try {
      const response = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // Usar o token obtido
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: newPlanId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Falha ao atualizar plano');
      }

      const updatedUserResponse = await response.json(); // API retorna { success: true, user: { id, plan_id } } ou similar
      console.log('Plano atualizado com sucesso (API Response):', updatedUserResponse);
      // Atualiza sessão em segundo plano (não bloqueante)
      supabase.auth.refreshSession().then(() => {
        console.log('Sessão do Supabase atualizada no frontend.');
      }).catch(() => {});

      // Encontrar email para a mensagem (opcional, apenas para UX)
      const userEmail = users.find(u => u.id === userId)?.email || userId;
      reactToast.success(`Plano do usuário ${userEmail} atualizado para ${PLAN_DISPLAY_NAMES[newPlanId] || newPlanId}.`);

    } catch (err: any) {
      console.error('Erro ao atualizar plano do usuário:', err);
      setError(`Erro ao atualizar plano: ${err.message}`);
      // Rollback otimista em caso de erro
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, plan_id: previousPlan ?? undefined } : u)));
    } finally {
      setUpdatingPlanId(null);
    }
  }, [users]); // Adicionar users como dependência por causa da busca de email no toast

  const handleSyncAllUsers = async () => {
    try {
      setSyncing(true);
      setSyncProgress(null);
      setSyncResults(null);
      setError(null);
      
      // Usar o novo endpoint do SendPulse
      const response = await fetch('/api/sendpulse/sync-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': localStorage.getItem('userId') || '',
          'X-User-Role': localStorage.getItem('userRole') || ''
        }
      });
      
      if (!response.ok && response.headers.get('Content-Type') !== 'text/event-stream') {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      // Stream de resposta - processar as atualizações de progresso
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Leitor de resposta não disponível');
      }
      
      let parsedEventData: SyncEventData | null = null;
      let currentData = '';
      
      // Ler o stream de resposta e processar as atualizações
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            currentData = line.substring(6);
            parsedEventData = null; // Resetar antes de tentar parsear
            try {
              parsedEventData = JSON.parse(currentData);
              
              // Adicionar verificação de nulidade para parsedEventData
              if (parsedEventData) { 
                if (parsedEventData.type === 'start') {
                  setSyncProgress({
                    total: parsedEventData.totalUsers || 0,
                    processed: 0,
                    success: 0,
                    failed: 0,
                    percentage: 0
                  });
                } 
                else if (parsedEventData.type === 'progress') {
                  const total = parsedEventData.total || 0;
                  const processed = parsedEventData.processed || 0;
                  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                  
                  // Converter boolean para number explicitamente
                  const successIncrement = parsedEventData.success !== undefined ? Number(parsedEventData.success) : 0;
                  const failedIncrement = parsedEventData.success !== undefined ? Number(!parsedEventData.success) : 0;

                  setSyncProgress(prev => ({
                    total: total,
                    processed: processed,
                    success: prev ? prev.success + successIncrement : successIncrement,
                    failed: prev ? prev.failed + failedIncrement : failedIncrement,
                    percentage: percentage
                  }));
                } 
                else if (parsedEventData.type === 'end') {
                  // Finalizar e definir resultados
                  setSyncResults({
                    success: syncProgress?.success || 0,
                    failed: syncProgress?.failed || 0,
                    errorDetails: parsedEventData.errorDetails || []
                  });
                  break; // Sair do loop interno após o fim
                }
              } // Fim do if (parsedEventData)

            } catch (e) {
              console.error('Erro ao parsear evento SSE:', currentData, e);
              // Continuar processando outras linhas se possível
            }
          } // Fim do if (line.startsWith)
        } // Fim do for (line of lines)
        if (parsedEventData?.type === 'end') break; // Sair do loop while após o fim
      } // Fim do while (true)

      reader.releaseLock(); // Liberar o leitor
      
    } catch (error: any) {
      console.error("Erro ao sincronizar usuários com SendPulse:", error);
      setError(error.message || "Falha na sincronização com SendPulse.");
      reactToast.error("Falha na sincronização com SendPulse.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncUserWithSendPulse = async (user: User) => {
    if (!user.email) {
      reactToast.warn("Usuário sem email não pode ser sincronizado.");
      return; 
    }

    setSyncingUsers(prev => [...prev, user.id]);
    try {
      const userStatusForSync = user.plan_id ? user.plan_id : 'sem_plano'; 

      const syncData: SendPulseUserData = {
        id: user.id,
        email: user.email, 
        name: user.full_name,
        status: userStatusForSync,
        whatsapp: user.whatsapp || undefined
      };
      
      const result = await syncUserWithSendPulse(syncData);
      
      if (result.success) {
        reactToast.success(`Usuário ${user.email} sincronizado com SendPulse.`);
      } else {
        reactToast.error(`Falha ao sincronizar ${user.email}: ${result.error}`);
      }
    } catch (error: any) { 
      reactToast.error(`Erro ao sincronizar ${user.email}: ${error.message}`);
    } finally {
      setSyncingUsers(prev => prev.filter(id => id !== user.id));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja remover este usuário?')) {
      try {
        setError('');
        setLoading(true);

        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          throw new Error('Sessão não encontrada');
        }

        const response = await fetch('/api/users/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`
          },
          body: JSON.stringify({ userId })
        });

        const result = await response.json(); // Ler o JSON independentemente do status ok

        if (!response.ok) {
          // Usar a mensagem de erro específica da API, se disponível
          const errorMessage = result.details || result.error || 'Erro desconhecido ao remover usuário';
          console.error('API Error:', result); // Logar o erro completo da API
          throw new Error(errorMessage);
        }

        await fetchUsers();
        reactToast.success('Usuário removido com sucesso');

      } catch (error: any) {
        // Exibir a mensagem de erro capturada
        const displayMessage = error.message || 'Erro ao remover usuário';
        setError('Erro ao remover usuário: ' + displayMessage);
        console.error('Erro ao remover usuário (Frontend Catch):', error); // Logar o erro no frontend
        reactToast.error('Erro ao remover usuário: ' + displayMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSimulateTrialEnd = useCallback(async (userId: string, userName: string | null) => {
    if (window.confirm(`Tem certeza que deseja simular o fim do período de teste para ${userName || userId}? Isso irá alterar o status para Gratuito (FREE).`)) {
      try {
        await handlePlanChange(userId, 'FREE');
        reactToast.success(`Período de teste encerrado, usuário movido para Gratuito (FREE)`);
      } catch (error: any) {
        console.error('Erro ao simular fim do período de teste:', error);
        setError('Erro ao simular fim do período de teste: ' + error.message);
        reactToast.error('Erro ao simular fim do período de teste: ' + error.message);
      }
    }
  }, [handlePlanChange]);

  const handleEndTrialNow = useCallback(async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (window.confirm(`Tem certeza que deseja encerrar manualmente o período de teste para ${user.email || userId}? O status será alterado para Gratuito (FREE).`)) {
      try {
        await handlePlanChange(userId, 'FREE');
        reactToast.success(`Período de teste encerrado manualmente para ${user.email || userId}. Status alterado para Gratuito.`);
      } catch (error) {
        console.error('Falha ao tentar encerrar o trial manualmente via handlePlanChange', error);
      }
    }
  }, [users, handlePlanChange]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchUsers();
      reactToast.success('Lista de usuários atualizada com sucesso');
    } catch (error) {
      reactToast.error('Erro ao atualizar lista de usuários');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateLastSignIn = async () => {
    console.log('[handleUpdateLastSignIn] Função iniciada.'); // Log 1: Início da função
    try {
      setUpdatingLastLogin(true);
      setError(null);
      
      console.log('[handleUpdateLastSignIn] Obtendo sessão...'); // Log 2: Antes de getSession
      // Obter a sessão
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      // Logar resultado de getSession
      if (sessionError) {
        console.error('[handleUpdateLastSignIn] Erro ao obter sessão:', sessionError);
        throw new Error(`Erro ao obter sessão: ${sessionError.message}`);
      }
      if (!sessionData.session) {
        console.error('[handleUpdateLastSignIn] Sessão não encontrada nos dados.');
        throw new Error('Sessão não encontrada');
      }
      console.log('[handleUpdateLastSignIn] Sessão obtida:', sessionData.session.access_token.substring(0, 10) + '...'); // Log 3: Sessão OK (log truncado)

      console.log('[handleUpdateLastSignIn] Chamando API /api/users/update-last-sign-in...'); // Log 4: Antes do fetch
      // Chamar API para atualizar dados de último acesso
      const response = await fetch('/api/users/update-last-sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });
      
      console.log('[handleUpdateLastSignIn] Resposta da API recebida, status:', response.status); // Log 5: Após fetch
      const result = await response.json();
      console.log('[handleUpdateLastSignIn] Corpo da resposta da API:', result); // Log 6: Corpo da resposta
      
      if (!response.ok) {
        console.error('[handleUpdateLastSignIn] API retornou erro:', result);
        throw new Error(result.error || 'Erro ao atualizar dados de último acesso');
      }
      
      console.log('[handleUpdateLastSignIn] API OK. Exibindo toast...'); // Log 7: API OK
      reactToast.success(`Dados de último acesso atualizados com sucesso. ${result.count || 'Vários'} usuários atualizados.`);
      
      // Recarregar a lista para exibir os novos dados
      console.log('[handleUpdateLastSignIn] Chamando loadUsers...'); // Log 8 Ajustado
      await fetchUsers();
    } catch (error: any) {
      console.error('[handleUpdateLastSignIn] Erro no bloco catch:', error); // Log 10: Erro geral
      setError(`Erro ao atualizar dados de último acesso: ${error.message}`);
      reactToast.error(`Erro ao atualizar dados de último acesso: ${error.message}`);
    } finally {
      console.log('[handleUpdateLastSignIn] Bloco finally executado.'); // Log 11: Finally
      setUpdatingLastLogin(false);
    }
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch (e) {
      return 'Data inválida';
    }
  };
  
  const formatDateTime = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return 'Data inválida';
    }
  };
  
  // Função para renderizar informações do usuário em um tooltip
  const renderUserInfoTooltip = (user: User) => {
    return (
      <div className="p-2 max-w-xs">
        <div className="mb-2">
          <span className="font-semibold">Criado em:</span> {formatDate(user.created_at)}
        </div>
        <div>
          <span className="font-semibold">Atualizado em:</span> {formatDate(user.updated_at)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <Loading size="large" message="Carregando usuários..." />;
  }
  
  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
            >
              <option value="ALL">Todos Status</option>
              {SELECTABLE_PLANS.concat(['ADMIN']).filter((v, i, a) => a.indexOf(v) === i).map(planId => (
                <option key={planId} value={planId}>{PLAN_DISPLAY_NAMES[planId] || planId}</option>
              ))}
            </select>
            <div className="relative">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input 
                 type="search"
                 placeholder="Buscar por nome ou email..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-8 pr-2 py-2 text-sm h-9 w-full sm:w-64"
               />
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={refreshing}
              title="Atualizar lista"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {/* Botão para Atualizar Último Login */}
            <button
              onClick={handleUpdateLastSignIn}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${ 
                updatingLastLogin
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
              }`}
              disabled={updatingLastLogin}
              title="Atualizar Último Login de Todos"
            >
              <Timer className={`w-4 h-4 ${updatingLastLogin ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Atualizar Logins</span>
            </button>
            
            {currentUser?.role === 'ADMIN' && (
              <>
                <button
                  onClick={handleSyncAllUsers}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    syncing 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800' 
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                  }`}
                  title={syncing ? "Cancelar sincronização" : "Sincronizar usuários com SendPulse"}
                >
                  {syncing ? (
                    <>
                      <Database className="w-5 h-5 animate-pulse" />
                      <span>Cancelar Sincronização</span>
                    </>
                  ) : (
                    <>
                      <MailCheck className="w-5 h-5" />
                      <span>Sincronizar com SendPulse</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Usuários exibidos: {filteredUsers.length}
          </div>
        </div>

        {/* Ações em Lote */}
        {selectedUserIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Selecionados: {selectedUserIds.size}
            </span>
            <Select value={bulkPlanId || undefined} onValueChange={setBulkPlanId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Escolher novo status/plano" />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_PLANS.map((planValue) => (
                  <SelectItem key={planValue} value={planValue}>
                    {PLAN_DISPLAY_NAMES[planValue] || planValue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setIsBulkDialogOpen(true)} disabled={isBulkUpdating || !bulkPlanId}>
              {isBulkUpdating ? 'Aplicando…' : 'Aplicar em Lote'}
            </Button>
            <Button variant="outline" onClick={handleClearSelection} disabled={isBulkUpdating}>
              Limpar seleção
            </Button>
            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar alteração em lote</DialogTitle>
                  <DialogDescription>
                    Você está prestes a aplicar o status/plano "{PLAN_DISPLAY_NAMES[bulkPlanId] || bulkPlanId}" a {selectedUserIds.size} usuário(s). Deseja continuar?
                  </DialogDescription>
                </DialogHeader>
                {/* Pré-visualização de até 5 usuários selecionados */}
                <div className="mt-2 max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                  {Array.from(selectedUserIds)
                    .slice(0, 5)
                    .map((id) => {
                      const user = users.find(u => u.id === id);
                      return (
                        <div key={id} className="px-3 py-2 text-sm flex items-center justify-between border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                          <span className="truncate max-w-[70%]">{user?.full_name || user?.email || id}</span>
                          <span className="text-xs text-gray-500">{user?.email}</span>
                        </div>
                      );
                    })}
                  {selectedUserIds.size > 5 && (
                    <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">... e mais {selectedUserIds.size - 5} usuário(s)</div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      setIsBulkDialogOpen(false);
                      await handleApplyBulkPlanChange();
                    }}
                    disabled={isBulkUpdating}
                  >
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        
        {/* Barra de progresso para sincronização com SendPulse */}
        {syncProgress && (
          <div className="w-full mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between mb-2 text-sm">
              <span>Sincronizando usuários com SendPulse...</span>
              <span>{syncProgress.percentage}% ({syncProgress.processed}/{syncProgress.total})</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-500 rounded-full"
                style={{ width: `${syncProgress.percentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{syncProgress.success} sucessos</span>
              <span>{syncProgress.failed} falhas</span>
            </div>
          </div>
        )}
        
        {/* Resultados da sincronização */}
        {syncResults && !syncProgress && (
          <div className="w-full mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-green-800 dark:text-green-400 font-medium mb-2">Sincronização concluída</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-white dark:bg-gray-800 rounded p-2 flex items-center gap-2">
                <span className="font-medium">Total:</span> {syncResults.total} usuários
              </div>
              <div className="bg-green-100 dark:bg-green-800/50 text-green-800 dark:text-green-300 rounded p-2 flex items-center gap-2">
                <span className="font-medium">Sucesso:</span> {syncResults.success}
              </div>
              <div className={`rounded p-2 flex items-center gap-2 ${
                syncResults.failed > 0 
                  ? 'bg-red-100 dark:bg-red-800/50 text-red-800 dark:text-red-300' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
              }`}>
                <span className="font-medium">Falhas:</span> {syncResults.failed}
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <ErrorAlert message={error} onClose={() => setError('')} />
        )}
        
        {/* Lista responsiva (Mobile) */}
        <div className="sm:hidden mt-6 space-y-2">
          {filteredUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Selecionar todos"
                checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))}
                onChange={handleToggleSelectAllVisible}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
            </div>
          )}
          <ResponsiveDataTable<User>
            data={filteredUsers}
            getRowKey={(row) => row.id}
            emptyState={<div className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum usuário encontrado</div>}
            columns={([
              {
                id: 'user',
                header: 'Usuário',
                isPrimaryMobileField: true,
                render: (row) => (
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${row.email || row.full_name || row.id}`}
                      checked={selectedUserIds.has(row.id)}
                      onChange={() => handleToggleSelectUser(row.id)}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <UserAvatar email={row.email || ''} photoURL={row.photoURL} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{row.full_name || row.email || 'Usuário'}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{row.email}</div>
                    </div>
                  </div>
                ),
              },
              {
                id: 'plan',
                header: 'Status/Plano',
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <Select
                      value={row.plan_id || 'TRIAL'}
                      onValueChange={(newPlan) => handlePlanChange(row.id, newPlan)}
                      disabled={!currentUser || updatingPlanId === row.id}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Alterar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_PLANS.map((planValue) => (
                          <SelectItem key={planValue} value={planValue}>
                            {PLAN_DISPLAY_NAMES[planValue] || planValue}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {updatingPlanId === row.id && <Loader2 className="animate-spin h-4 w-4" />}
                  </div>
                ),
              },
              { id: 'created', header: 'Data Criação', render: (row) => formatDate(row.created_at) },
              { id: 'last_login', header: 'Último Login', render: (row) => formatDateTime(row.last_sign_in_at) },
              { id: 'whats', header: 'WhatsApp', render: (row) => row.whatsapp || <span className="text-gray-400">Não informado</span> },
              {
                id: 'actions',
                header: 'Ações',
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleSyncUserWithSendPulse(row)}
                      disabled={syncingUsers.includes(row.id) || !row.email}
                      title={!row.email ? "Usuário sem email" : "Sincronizar com SendPulse"}
                      className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncingUsers.includes(row.id) ? <RefreshCw className="w-4 h-4 animate-spin"/> : <MailCheck className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => handleRemoveUser(row.id)} 
                      disabled={!currentUser || updatingPlanId === row.id}
                      title="Remover Usuário"
                      className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSimulateTrialEnd(row.id, row.full_name || row.email)}
                      disabled={!currentUser || updatingPlanId === row.id}
                      className="p-1 text-yellow-600 hover:text-yellow-800 disabled:opacity-50"
                      title="Simular Fim do Período de Teste (Muda para Gratuito)"
                    >
                      <Hourglass className="w-4 h-4" />
                    </button>
                    {row.plan_id?.toUpperCase() === 'TRIAL' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEndTrialNow(row.id)}
                        disabled={!currentUser || updatingPlanId === row.id}
                        className="h-6 w-6 text-red-600 hover:text-red-800"
                        title="Encerrar período de teste imediatamente (Muda para Gratuito)"
                      >
                        <TimerOff className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ] as ResponsiveColumn<User>[])}
          />
        </div>

        {/* Tabela (Desktop/Tablet) */}
        <div className="hidden sm:block mt-6 relative overflow-x-auto shadow-md sm:rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))}
                    onChange={handleToggleSelectAllVisible}
                    className="h-4 w-4 accent-blue-600"
                  />
                </TableHead>
                <TableHead className="w-1/5">Usuário</TableHead>
                <TableHead className="w-1/5">Status/Plano</TableHead>
                <TableHead className="w-1/5">Data Criação</TableHead>
                <TableHead className="w-1/5">Último Login</TableHead>
                <TableHead className="w-1/5">WhatsApp</TableHead>
                <TableHead className="w-1/5">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${user.email || user.full_name || user.id}`}
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => handleToggleSelectUser(user.id)}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <UserAvatar 
                        email={user.email || ''} 
                        photoURL={user.photoURL}
                        size="sm" 
                      />
                      <div className="ml-2">
                        <div 
                          className="flex items-center"
                          data-tooltip-id={`user-info-${user.id}`}
                        >
                          <span className="font-medium">
                            {user.full_name || user.email || 'Usuário'}
                          </span>
                          <span className="ml-1 text-gray-500 cursor-help">
                            <RefreshCw size={16} />
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{user.email}</div>
                        <Tooltip 
                          id={`user-info-${user.id}`}
                          place="right"
                          className="z-50 max-w-xs bg-gray-800 text-white p-2 rounded shadow-lg"
                        >
                          {renderUserInfoTooltip(user)}
                        </Tooltip>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.plan_id || 'TRIAL'}
                      onValueChange={(newPlan) => handlePlanChange(user.id, newPlan)}
                      disabled={!currentUser || updatingPlanId === user.id}
                    >
                      <SelectTrigger className="w-full md:w-[150px] text-xs h-8">
                        <SelectValue placeholder="Alterar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_PLANS.map((planValue) => (
                           <SelectItem key={planValue} value={planValue}>
                             {PLAN_DISPLAY_NAMES[planValue] || planValue}
                           </SelectItem>
                         ))}
                      </SelectContent>
                    </Select>
                    {updatingPlanId === user.id && <Loader2 className="animate-spin h-4 w-4 ml-2 inline-block" />}
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>{formatDateTime(user.last_sign_in_at)}</TableCell>
                  <TableCell>
                    {user.whatsapp || <span className="text-gray-400">Não informado</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleSyncUserWithSendPulse(user)}
                        disabled={syncingUsers.includes(user.id) || !user.email}
                        title={!user.email ? "Usuário sem email" : "Sincronizar com SendPulse"}
                        className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncingUsers.includes(user.id) ? <RefreshCw className="w-4 h-4 animate-spin"/> : <MailCheck className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleRemoveUser(user.id)} 
                        disabled={!currentUser || updatingPlanId === user.id}
                        title="Remover Usuário"
                        className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSimulateTrialEnd(user.id, user.full_name || user.email)}
                        disabled={!currentUser || updatingPlanId === user.id}
                        className="p-1 text-yellow-600 hover:text-yellow-800 disabled:opacity-50"
                        title="Simular Fim do Período de Teste (Muda para Gratuito)"
                      >
                        <Hourglass className="w-4 h-4" />
                      </button>
                      {user.plan_id?.toUpperCase() === 'TRIAL' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEndTrialNow(user.id)}
                          disabled={!currentUser || updatingPlanId === user.id}
                          className="ml-1 text-red-600 hover:text-red-800 h-6 w-6"
                          title="Encerrar período de teste imediatamente (Muda para Gratuito)"
                        >
                          <TimerOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Total de usuários: {filteredUsers.length}
        </div>
      </div>
    </div>
  );
}
