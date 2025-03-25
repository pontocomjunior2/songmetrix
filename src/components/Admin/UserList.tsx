import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/user-status';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast as reactToast } from 'react-toastify'; // Importing toast for notifications
import { Trash2, Clock, RefreshCw, MailCheck, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { FaEdit } from 'react-icons/fa';
import { Progress } from '../../components/ui/progress';

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
}

interface SyncProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  percentage: number;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const { updateUserStatus, currentUser, userStatus } = useAuth();

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
        .select('id, email, status, created_at, updated_at, full_name, whatsapp')
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
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar status');
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
  
  const handleSyncBrevo = async () => {
    if (syncing) {
      // Cancelar sincronização atual
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSyncing(false);
      setSyncProgress(null);
      reactToast.info('Sincronização cancelada');
      return;
    }
    
    try {
      setSyncing(true);
      setSyncProgress(null);
      setSyncResults(null);
      setError(null);
      
      // Criar um AbortController para permitir cancelar a requisição
      abortControllerRef.current = new AbortController();
      
      // Obter a sessão
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      // Iniciar a requisição
      const response = await fetch('/api/brevo/sync-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        signal: abortControllerRef.current.signal
      });
      
      // Stream de resposta - processar as atualizações de progresso
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Leitor de resposta não disponível');
      }
      
      let finalResult = null;
      
      // Ler o stream de resposta e processar as atualizações
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decodificar o chunk recebido
        const chunk = new TextDecoder().decode(value);
        
        // Um chunk pode conter múltiplas linhas JSON
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            // Verificar o tipo de atualização
            if (data.progress) {
              // Atualização de progresso
              setSyncProgress(data.progress);
            } else if (data.final) {
              // Resultado final
              finalResult = data;
              setSyncResults(data);
              setSyncProgress(null); // Limpar o progresso quando receber o resultado final
            } else if (data.error) {
              // Erro durante o processamento
              throw new Error(data.message || 'Erro durante a sincronização');
            }
          } catch (parseError) {
            console.error('Erro ao analisar resposta:', parseError, line);
          }
        }
      }
      
      if (finalResult) {
        reactToast.success(`Sincronização concluída! ${finalResult.success} usuários sincronizados com sucesso, ${finalResult.failed} falhas.`);
      } else {
        reactToast.warning('Sincronização concluída, mas sem resultados detalhados');
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar com Brevo:', error);
      setError(`Erro ao sincronizar com Brevo: ${error.message}`);
      reactToast.error(`Erro ao sincronizar com Brevo: ${error.message}`);
    } finally {
      setSyncing(false);
      abortControllerRef.current = null;
      setSyncProgress(null); // Garantir que o progresso seja limpo mesmo em caso de erro
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            
            <button
              onClick={handleSyncBrevo}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                syncing 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
              }`}
              title={syncing ? "Cancelar sincronização" : "Sincronizar usuários com Brevo"}
            >
              {syncing ? (
                <>
                  <Database className="w-5 h-5 animate-pulse" />
                  <span>Cancelar Sincronização</span>
                </>
              ) : (
                <>
                  <MailCheck className="w-5 h-5" />
                  <span>Sincronizar com Brevo</span>
                </>
              )}
            </button>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total de usuários: {filteredUsers.length}
          </div>
        </div>
        
        {/* Barra de progresso para sincronização com Brevo */}
        {syncProgress && (
          <div className="w-full mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between mb-2 text-sm">
              <span>Sincronizando usuários com Brevo...</span>
              <span>{syncProgress.percentage}% ({syncProgress.processed}/{syncProgress.total})</span>
            </div>
            <Progress value={syncProgress.percentage} className="h-2" />
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
        
        {/* Tabela responsiva */}
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="min-w-full bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="hidden md:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nome Completo
                </th>
                <th className="hidden lg:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  WhatsApp
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data de Criação
                </th>
                <th className="hidden md:table-cell px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Atualização
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <UserAvatar
                        email={user.email || ''}
                        photoURL={user.photoURL}
                        size="sm"
                        className="mr-2 flex-shrink-0 block"
                      />
                      <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis max-w-[120px] sm:max-w-[200px]">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis max-w-[150px] lg:max-w-none">
                      {user.full_name ? user.full_name : <span className="text-gray-400 dark:text-gray-500">N/A</span>}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                      {user.whatsapp ? user.whatsapp : <span className="text-gray-400 dark:text-gray-500">N/A</span>}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full 
                      ${user.status === USER_STATUS.ATIVO ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 
                        user.status === USER_STATUS.ADMIN ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 
                        user.status === USER_STATUS.TRIAL ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(user.created_at)}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(user.updated_at)}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <select
                        value={user.status}
                        onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatusType)}
                        disabled={updatingUserId === user.id}
                        className={`block w-full py-1 sm:py-2 px-1 sm:px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm 
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm
                          ${updatingUserId === user.id ? 'opacity-50' : ''}`}
                      >
                        <option value={USER_STATUS.INATIVO}>Inativo</option>
                        <option value={USER_STATUS.ATIVO}>Ativo</option>
                        <option value={USER_STATUS.ADMIN}>Admin</option>
                        <option value={USER_STATUS.TRIAL}>Trial</option>
                      </select>
                      
                      {user.status === USER_STATUS.TRIAL && (
                        <button
                          onClick={() => handleSimulateTrialEnd(user.id)}
                          disabled={updatingUserId === user.id}
                          className="p-1 sm:p-2 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md"
                          title="Simular fim do período de teste"
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
