import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/user-status';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast as reactToast } from 'react-toastify'; // Importing toast for notifications
import { Trash2, Clock, RefreshCw, MailCheck, Database, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { FaEdit } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import { syncUserWithSendPulse } from '../../utils/sendpulse-service';

type UserStatusType = 'ADMIN' | 'ATIVO' | 'INATIVO' | 'TRIAL';

// Definindo constantes para os valores de UserStatus
const USER_STATUS = {
  ADMIN: 'ADMIN' as UserStatusType,
  ATIVO: 'ATIVO' as UserStatusType,
  INATIVO: 'INATIVO' as UserStatusType,
  TRIAL: 'TRIAL' as UserStatusType
};

interface User {
  id: string;
  email: string | null;
  status: UserStatusType; // Alterado para usar UserStatusType diretamente
  created_at: string;
  updated_at: string;
  photoURL?: string;
  full_name?: string;
  whatsapp?: string;
  last_sign_in_at?: string;
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
  const [statusFilter, setStatusFilter] = useState<UserStatusType | 'ALL'>('ALL');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<UserStatusType>('INATIVO');
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResults, setSyncResults] = useState<any | null>(null);
  const [updatingLastLogin, setUpdatingLastLogin] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { updateUserStatus, currentUser, userStatus } = useAuth();
  const [syncingUsers, setSyncingUsers] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, statusFilter]);

  // Limpar recursos ao desmontar o componente
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const filterUsers = () => {
    const validUsers = users.filter(user => 
      [USER_STATUS.ATIVO, USER_STATUS.INATIVO, USER_STATUS.ADMIN, USER_STATUS.TRIAL].includes(user.status)
    );

    if (statusFilter === 'ALL') {
      setFilteredUsers(validUsers);
    } else {
      setFilteredUsers(validUsers.filter(user => user.status === statusFilter));
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Carregando usuários...');
      
      // Buscar usuários da tabela users
      const { data: usersData, error: fetchError } = await supabase
        .from('users')
        .select('id, email, status, created_at, updated_at, full_name, whatsapp, last_sign_in_at')
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        throw fetchError;
      }
      
      console.log('Usuários carregados:', usersData);
      // Log adicional para verificar se os campos full_name e whatsapp estão presentes
      const usersWithFullName = usersData.filter(user => user.full_name);
      const usersWithWhatsapp = usersData.filter(user => user.whatsapp);
      console.log(`Usuários com nome completo: ${usersWithFullName.length}/${usersData.length}`);
      console.log(`Usuários com WhatsApp: ${usersWithWhatsapp.length}/${usersData.length}`);
      
      if (usersWithFullName.length > 0) {
        console.log('Exemplo de usuário com nome completo:', usersWithFullName[0]);
      }
      
      if (usersWithWhatsapp.length > 0) {
        console.log('Exemplo de usuário com WhatsApp:', usersWithWhatsapp[0]);
      }
      
      // Não vamos mais alterar automaticamente o status dos usuários
      // Isso respeitará o status definido pelo administrador
      
      setUsers(usersData);
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

  const handleStatusChange = async (userId: string, newStatus: UserStatusType) => {
    try {
      // Verificar se o usuário está tentando alterar seu próprio status de ADMIN
      if (userId === currentUser?.id && userStatus === 'ADMIN' && newStatus !== 'ADMIN') {
        setError('Você não pode remover seu próprio status de administrador');
        return;
      }
  
      setLoading(true);
      setUpdatingUserId(userId); // Desabilitar o controle durante a atualização
      setError(null);
      
      // Encontrar o usuário atual para referência
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) {
        throw new Error('Usuário não encontrado na lista');
      }
      
      console.log(`Alterando status do usuário ${userId} de ${userToUpdate.status} para ${newStatus}`);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      // Se o novo status for TRIAL, vamos incluir a data atual como trial_start_date
      const additionalData = newStatus === 'TRIAL' ? { trial_start_date: new Date().toISOString() } : {};
      
      const response = await fetch('/api/users/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          userId,
          newStatus,
          ...additionalData
        })
      });
      
      // Verificar se a resposta é válida antes de tentar fazer parse do JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resposta de erro do servidor:', response.status, errorText);
        
        let errorMessage = `Erro do servidor: ${response.status}`;
        try {
          // Tentar extrair mensagem de erro do JSON, se existir
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // Se não conseguir fazer parse do JSON, usar o texto original
          errorMessage = errorText || `Erro ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Verificar se há conteúdo antes de fazer parse do JSON
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.warn('Resposta do servidor está vazia');
        throw new Error('Resposta vazia do servidor');
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Erro ao processar resposta JSON:', jsonError, 'Texto da resposta:', responseText);
        throw new Error('Erro ao processar resposta do servidor');
      }
      
      console.log('Resposta do servidor:', result);
      
      // Atualizar a lista de usuários localmente
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      setEditingUser(null);
      
      // Mostrar notificação de sucesso
      reactToast.success(`Status do usuário alterado com sucesso para ${newStatus}`);
      
      // Recarregar a lista para garantir que temos os dados mais atualizados
      await loadUsers();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      setError(`Erro ao atualizar status: ${error.message}`);
      reactToast.error(`Erro ao atualizar status: ${error.message}`);
    } finally {
      setLoading(false);
      setUpdatingUserId(null);
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
        
        // Decodificar o chunk recebido
        const chunk = new TextDecoder().decode(value);
        
        // Processar eventos SSE linha por linha
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            currentData = line.substring(6);
            
            try {
              parsedEventData = JSON.parse(currentData);
              
              // Processar diferentes tipos de eventos
              if (parsedEventData && parsedEventData.type === 'start') {
                // Início da sincronização
                setSyncProgress({
                  total: parsedEventData.totalUsers || 0,
                  processed: 0,
                  success: 0,
                  failed: 0,
                  percentage: 0
                });
              } 
              else if (parsedEventData && parsedEventData.type === 'progress') {
                // Atualização de progresso
                const total = parsedEventData.total || 0;
                const processed = parsedEventData.processed || 0;
                const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                
                setSyncProgress(prev => ({
                  total: total,
                  processed: processed,
                  success: prev ? prev.success + (parsedEventData.success ? 1 : 0) : (parsedEventData.success ? 1 : 0),
                  failed: prev ? prev.failed + (!parsedEventData.success ? 1 : 0) : (!parsedEventData.success ? 1 : 0),
                  percentage: percentage
                }));
              } 
              else if (parsedEventData && parsedEventData.type === 'complete') {
                // Final da sincronização - resultado completo
                setSyncResults(parsedEventData);
                setSyncProgress({
                  total: parsedEventData.total || 0,
                  processed: parsedEventData.total || 0,
                  success: parsedEventData.success || 0,
                  failed: parsedEventData.errors || 0,
                  percentage: 100
                });
                
                reactToast.success(`Sincronização concluída! ${parsedEventData.success || 0} usuários sincronizados com sucesso, ${parsedEventData.errors || 0} falhas.`);
              } 
              else if (parsedEventData && parsedEventData.type === 'error') {
                // Erro durante o processamento
                throw new Error(parsedEventData.message || 'Erro durante a sincronização');
              }
            } catch (parseError) {
              console.error('Erro ao processar evento SSE:', parseError, currentData);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar usuários com SendPulse:', error);
      setError(`Erro ao sincronizar usuários com SendPulse: ${error.message}`);
      reactToast.error(`Erro ao sincronizar usuários com SendPulse: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncProgress(null); // Garantir que o progresso seja limpo mesmo em caso de erro
    }
  };

  const handleSyncUserWithSendPulse = async (user: User) => {
    try {
      setSyncingUsers((prev) => [...prev, user.id]);
      
      const syncData = {
        id: user.id,
        email: user.email,
        name: user.full_name,
        status: user.status,
        whatsapp: user.whatsapp || ''
      };
      
      // Usar o método do SendPulse
      const result = await syncUserWithSendPulse(syncData);
      
      if (result.success) {
        reactToast.success(`Usuário ${user.email} sincronizado com o SendPulse com sucesso.`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        });
      } else {
        reactToast.error(`Erro ao sincronizar usuário ${user.email} com SendPulse: ${result.error || 'Erro desconhecido'}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar usuário com SendPulse:', error);
      reactToast.error(`Erro ao sincronizar usuário ${user.email} com SendPulse: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
    } finally {
      setSyncingUsers((prev) => prev.filter(id => id !== user.id));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja remover este usuário?')) {
      try {
        setError('');
        setLoading(true);
        
        // Obter a sessão atual
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          throw new Error('Sessão não encontrada');
        }
        
        // Chamar a API para remover o usuário
        const response = await fetch('/api/users/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`
          },
          body: JSON.stringify({ userId })
        });
        
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Erro ao remover usuário');
        }
        
        // Recarregar a lista de usuários
        await loadUsers();
        reactToast.success('Usuário removido com sucesso');
      } catch (error: any) {
        setError('Erro ao remover usuário: ' + error.message);
        console.error('Erro ao remover usuário:', error);
        reactToast.error('Erro ao remover usuário: ' + error.message);
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
        
        console.log(`Simulando fim do período trial para o usuário ${userId} (status atual: ${userToUpdate.status})`);
        
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
          user.id === userId ? { ...user, status: 'INATIVO' } : user
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Não disponível';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatusType | 'ALL')}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2"
            >
              <option value="ALL">Todos</option>
              <option value="ADMIN">Admin</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="TRIAL">Trial</option>
            </select>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={refreshing}
              title="Atualizar lista"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            
            {userStatus === 'ADMIN' && (
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
            Total de usuários: {filteredUsers.length}
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
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Usuário</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Último Acesso</th>
                <th scope="col" className="px-6 py-3">WhatsApp</th>
                <th scope="col" className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr 
                  key={user.id} 
                  className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
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
                  </td>
                  <td className="px-6 py-4">
                    {/* Status do usuário */}
                    {editingUser === user.id ? (
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as UserStatusType)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={loading}
                      >
                        <option value={USER_STATUS.ADMIN}>Admin</option>
                        <option value={USER_STATUS.ATIVO}>Ativo</option>
                        <option value={USER_STATUS.INATIVO}>Inativo</option>
                        <option value={USER_STATUS.TRIAL}>Trial</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded text-white font-medium ${
                        user.status === USER_STATUS.ADMIN 
                          ? 'bg-purple-600' 
                          : user.status === USER_STATUS.ATIVO 
                          ? 'bg-green-600' 
                          : user.status === USER_STATUS.INATIVO 
                          ? 'bg-red-600'
                          : 'bg-blue-600'
                      }`}>
                        {user.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.last_sign_in_at 
                      ? formatDate(user.last_sign_in_at)
                      : <span className="text-gray-400">Nunca acessou</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    {user.whatsapp || <span className="text-gray-400">Não informado</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      {editingUser === user.id && (
                        <>
                          <button
                            onClick={() => handleStatusChange(user.id, newStatus)}
                            disabled={updatingUserId === user.id}
                            className="p-1 sm:p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
                            title="Salvar status"
                          >
                            <FaEdit className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-1 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded-md"
                            title="Cancelar edição"
                          >
                            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </>
                      )}
                      
                      {editingUser !== user.id && (
                        <button
                          onClick={() => {
                            setEditingUser(user.id);
                            setNewStatus(user.status);
                          }}
                          className="p-1 sm:p-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md"
                          title="Editar status"
                        >
                          <FaEdit className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                      
                      {user.status === USER_STATUS.TRIAL && (
                        <button
                          onClick={() => handleSimulateTrialEnd(user.id)}
                          disabled={updatingUserId === user.id}
                          className="p-1 sm:p-2 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md"
                          title="Encerrar período de teste"
                        >
                          <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                      
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="p-1 sm:p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
                          title="Remover usuário"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                      
                      {/* Botão para sincronizar usuário individual com SendPulse */}
                      <button
                        onClick={() => handleSyncUserWithSendPulse(user)}
                        disabled={syncingUsers.includes(user.id)}
                        className="p-1 sm:p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
                        title="Sincronizar com SendPulse"
                      >
                        <MailCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Total de usuários: {filteredUsers.length}
        </div>
      </div>
    </div>
  );
}
