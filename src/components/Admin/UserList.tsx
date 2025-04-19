import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast as reactToast } from 'react-toastify'; // Importing toast for notifications
import { Trash2, Clock, RefreshCw, MailCheck, Database, Calendar, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { FaEdit } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import { syncUserWithSendPulse, type UserData as SendPulseUserData } from '../../utils/sendpulse-service';
import { Input } from '../ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

// Adicionar mapeamento de plan_id para exibição
const PLAN_DISPLAY_NAMES: { [key: string]: string } = {
  ADMIN: 'Admin',
  TRIAL: 'Trial',
  expired_trial: 'Trial Expirado',
  ATIVO: 'Ativo',
  // Adicionar outros planos aqui conforme necessário (ex: 'premium': 'Premium')
};

// Definir os plan_ids que o admin pode selecionar
const SELECTABLE_PLANS = ['TRIAL', 'expired_trial', 'ATIVO', 'ADMIN'];

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
  const { currentUser } = useAuth();
  const [syncingUsers, setSyncingUsers] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

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

  const loadUsers = async () => {
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
      
      const processedUsers = usersData.map(user => ({ ...user, plan_id: user.plan_id || null }));
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
  };

  const handlePlanChange = async (userId: string, newPlanId: string) => {
    setUpdatingUserId(userId);
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ plan_id: newPlanId })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      await loadUsers();
      reactToast.success(`Plano do usuário atualizado para ${PLAN_DISPLAY_NAMES[newPlanId] || newPlanId}`);

    } catch (error: any) {
      console.error("Erro ao atualizar plano do usuário:", error);
      setError("Falha ao atualizar plano do usuário: " + error.message);
      reactToast.error("Falha ao atualizar plano do usuário: " + error.message);
    } finally {
      setUpdatingUserId(null);
      setLoading(false);
    }
  };

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

        await loadUsers();
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

  const handleSimulateTrialEnd = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja simular o fim do período de teste para este usuário? Isso irá alterar o status para INATIVO.')) {
      try {
        setError('');
        setUpdatingUserId(userId);
        
        // Encontrar o usuário atual para referência
        const userToUpdate = users.find(u => u.id === userId);
        if (!userToUpdate) {
          throw new Error('Usuário não encontrado na lista');
        }
        
        console.log(`Simulando fim do período trial para o usuário ${userId} (status atual: ${userToUpdate.plan_id})`);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Sessão não encontrada');
        }
        
        const response = await fetch('/api/simulate-trial-end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ userId })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao simular fim do período de teste');
        }
        
        console.log('Resposta do servidor:', result);
        
        // Atualizar a lista de usuários localmente
        setUsers(users.map(user => 
          user.id === userId ? { ...user, plan_id: 'INATIVO' } : user
        ));
        
        reactToast.success('Período de teste encerrado com sucesso');
        
        // Recarregar a lista para garantir que temos os dados mais atualizados
        await loadUsers();
      } catch (error: any) {
        console.error('Erro ao simular fim do período de teste:', error);
        setError('Erro ao simular fim do período de teste: ' + error.message);
        reactToast.error('Erro ao simular fim do período de teste: ' + error.message);
      } finally {
        setUpdatingUserId(null);
      }
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadUsers();
      reactToast.success('Lista de usuários atualizada com sucesso');
    } catch (error) {
      reactToast.error('Erro ao atualizar lista de usuários');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateLastSignIn = async () => {
    try {
      setUpdatingLastLogin(true);
      setError(null);
      
      // Obter a sessão
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      // Chamar API para atualizar dados de último acesso
      const response = await fetch('/api/users/update-last-sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar dados de último acesso');
      }
      
      reactToast.success(`Dados de último acesso atualizados com sucesso. ${result.count || 'Vários'} usuários atualizados.`);
      
      // Recarregar a lista para exibir os novos dados
      await loadUsers();
    } catch (error: any) {
      console.error('Erro ao atualizar dados de último acesso:', error);
      setError(`Erro ao atualizar dados de último acesso: ${error.message}`);
      reactToast.error(`Erro ao atualizar dados de último acesso: ${error.message}`);
    } finally {
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

  if (loading) {
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
              {Object.entries(PLAN_DISPLAY_NAMES).map(([planId, displayName]) => (
                <option key={planId} value={planId}>{displayName}</option>
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
                
                <button
                  onClick={handleUpdateLastSignIn}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    updatingLastLogin 
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800'
                  }`}
                  disabled={updatingLastLogin}
                  title="Atualizar dados de último acesso para todos os usuários"
                >
                  {updatingLastLogin ? (
                    <>
                      <Calendar className="w-5 h-5 animate-pulse" />
                      <span>Atualizando...</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5" />
                      <span>Atualizar Último Acesso</span>
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
        
        {/* Barra de progresso para sincronização com SendPulse */}
        {syncProgress && (
          <div className="w-full mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between mb-2 text-sm">
              <span>Sincronizando usuários com SendPulse...</span>
              <span>{syncProgress.percentage}% ({syncProgress.processed}/{syncProgress.total})</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
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
        
        {/* Renderizar a tabela de usuários */}
        <div className="mt-6 relative overflow-x-auto shadow-md sm:rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={user.id}>
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
                    {updatingUserId === user.id ? (
                      <Loading size="small" />
                    ) : (
                      <select
                        value={user.plan_id || ''}
                        onChange={(e) => handlePlanChange(user.id, e.target.value)}
                        disabled={updatingUserId === user.id}
                        className="p-1 border rounded bg-transparent"
                      >
                        {SELECTABLE_PLANS.map(planId => (
                           <option key={planId} value={planId}>
                             {PLAN_DISPLAY_NAMES[planId] || planId} 
                           </option>
                        ))}
                      </select>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>{formatDateTime(user.last_sign_in_at)}</TableCell>
                  <TableCell>
                    {user.whatsapp || <span className="text-gray-400">Não informado</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleSyncUserWithSendPulse(user)}
                        disabled={syncingUsers.includes(user.id) || !user.email} // Desabilitar se não tiver email
                        title={!user.email ? "Usuário sem email" : "Sincronizar com SendPulse"}
                        className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncingUsers.includes(user.id) ? <RefreshCw className="w-4 h-4 animate-spin"/> : <MailCheck className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleRemoveUser(user.id)} 
                        disabled={updatingUserId === user.id} // Exemplo: desabilitar se estiver atualizando plano
                        title="Remover Usuário"
                        className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
