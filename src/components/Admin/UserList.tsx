import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/user-status';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast as reactToast } from 'react-toastify'; // Importing toast for notifications
import { Trash2, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { FaEdit, FaSync } from 'react-icons/fa';

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
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [fixingNewUsers, setFixingNewUsers] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProcessResult, setQueueProcessResult] = useState<any>(null);
  const [isSyncingNewUsers, setSyncingNewUsers] = useState(false);
  const { getAllUsers, updateUserStatus, removeUser, currentUser, userStatus } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, statusFilter]);

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
        .select('id, email, status, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        throw fetchError;
      }
      
      console.log('Usuários carregados:', usersData);
      
      // Verificar usuários criados nos últimos 7 dias com status INATIVO
      const usersToUpdate = [];
      
      for (const user of usersData) {
        // Verificar se o usuário foi criado nos últimos 7 dias
        const createdAt = new Date(user.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Se o usuário foi criado nos últimos 7 dias e está INATIVO, deve ser TRIAL
        if (diffDays <= 7 && user.status === 'INATIVO') {
          usersToUpdate.push({
            id: user.id,
            oldStatus: user.status,
            newStatus: 'TRIAL'
          });
          
          // Atualizar o status localmente
          user.status = 'TRIAL';
        }
      }
      
      // Atualizar os usuários que precisam ser alterados
      if (usersToUpdate.length > 0) {
        console.log('Usuários que precisam de atualização:', usersToUpdate);
        
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          throw new Error('Sessão não encontrada');
        }
        
        // Atualizar cada usuário
        for (const userToUpdate of usersToUpdate) {
          try {
            // Atualizar no banco de dados
            const { error: updateDbError } = await supabase
              .from('users')
              .update({
                status: userToUpdate.newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', userToUpdate.id);
              
            if (updateDbError) {
              console.error(`Erro ao atualizar status do usuário ${userToUpdate.id} no banco:`, updateDbError);
              continue;
            }
            
            // Atualizar os metadados via API
            const response = await fetch('/api/users/update-status', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session.access_token}`
              },
              body: JSON.stringify({
                userId: userToUpdate.id,
                newStatus: userToUpdate.newStatus
              })
            });
            
            if (!response.ok) {
              const result = await response.json();
              console.error(`Erro ao atualizar metadados do usuário ${userToUpdate.id}:`, result.error);
            }
          } catch (error) {
            console.error(`Erro ao processar atualização do usuário ${userToUpdate.id}:`, error);
          }
        }
      }
      
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
      
      const response = await fetch('/api/users/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          userId,
          newStatus
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

  const handleRemoveUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja remover este usuário?')) {
      try {
        setError('');
        await removeUser(userId);
        await loadUsers();
      } catch (error: any) {
        setError('Erro ao remover usuário: ' + error.message);
        console.error('Erro ao remover usuário:', error);
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

  const handleSyncStatus = async () => {
    try {
      setSyncingStatus(true);
      setSyncMessage(null);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      const response = await fetch('/api/users/sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar status');
      }
      
      setSyncMessage(`Sincronização concluída. ${result.updates.length} usuários atualizados.`);
      
      // Recarregar a lista de usuários
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao sincronizar status:', error);
      setSyncMessage(`Erro: ${error.message}`);
    } finally {
      setSyncingStatus(false);
    }
  };

  const handleFixNewUsers = async () => {
    try {
      setFixingNewUsers(true);
      setFixMessage(null);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      const response = await fetch('/api/users/fix-new-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao corrigir status dos usuários novos');
      }
      
      setFixMessage(`Correção concluída. ${result.updates.length} usuários atualizados. ${result.errors.length} erros.`);
      
      // Recarregar a lista de usuários
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao corrigir status dos usuários novos:', error);
      setFixMessage(`Erro: ${error.message}`);
    } finally {
      setFixingNewUsers(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setIsProcessingQueue(true);
      setQueueProcessResult(null);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      const response = await fetch('/api/users/process-sync-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar fila de sincronização');
      }
      
      setQueueProcessResult(result);
      reactToast.success(`${result.processed} usuários atualizados com sucesso. ${result.errors.length} erros.`);
      
      // Recarregar a lista de usuários
      loadUsers();
    } catch (error) {
      console.error('Erro ao processar fila de sincronização:', error);
      reactToast.error(error instanceof Error ? error.message : 'Erro ao processar fila de sincronização');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const handleSyncNewUsers = async () => {
    try {
      setSyncingNewUsers(true);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      const response = await fetch('/api/users/sync-new-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao sincronizar novos usuários');
      }
      
      reactToast.success(`${result.updated} usuários novos atualizados para TRIAL.`);
      
      // Recarregar a lista de usuários
      loadUsers();
    } catch (error) {
      console.error('Erro ao sincronizar novos usuários:', error);
      reactToast.error(error instanceof Error ? error.message : 'Erro ao sincronizar novos usuários');
    } finally {
      setSyncingNewUsers(false);
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
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gerenciar Usuários</h1>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gerenciamento de Usuários</h2>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filtrar por status:</label>
          <select
            value={statusFilter} 
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as UserStatusType | 'ALL')}
            className="mt-1 block w-40 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
            <option value="ADMIN">Admins</option>
            <option value="TRIAL">Trial</option>
          </select>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleSyncStatus}
            disabled={syncingStatus}
            className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
          >
            {syncingStatus ? (
              <>
                <FaSync className="animate-spin mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                <FaSync className="mr-2" />
                Sincronizar Status
              </>
            )}
          </button>
          
          <button
            onClick={handleFixNewUsers}
            disabled={fixingNewUsers}
            className="flex items-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:bg-green-300"
          >
            {fixingNewUsers ? (
              <>
                <FaSync className="animate-spin mr-2" />
                Corrigindo...
              </>
            ) : (
              <>
                <FaSync className="mr-2" />
                Corrigir Novos Usuários
              </>
            )}
          </button>
          
          <button
            onClick={handleProcessQueue}
            disabled={isProcessingQueue}
            className="flex items-center bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:bg-purple-300"
          >
            {isProcessingQueue ? (
              <>
                <FaSync className="animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <FaSync className="mr-2" />
                Processar Fila
              </>
            )}
          </button>
          
          <button
            onClick={handleSyncNewUsers}
            disabled={isSyncingNewUsers}
            className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded disabled:bg-yellow-300"
          >
            {isSyncingNewUsers ? (
              <>
                <FaSync className="animate-spin mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                <FaSync className="mr-2" />
                Sincronizar Novos Usuários
              </>
            )}
          </button>
        </div>
      </div>
      
      {syncMessage && (
        <div className={`p-3 mb-4 rounded ${syncMessage.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {syncMessage}
        </div>
      )}
      
      {fixMessage && (
        <div className={`p-3 mb-4 rounded ${fixMessage.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {fixMessage}
        </div>
      )}

      {error && (
        <ErrorAlert message={error} onClose={() => setError('')} />
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Criação
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Atualização
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <UserAvatar
                      email={user.email || ''}
                      photoURL={user.photoURL}
                      size="sm"
                      className="mr-3"
                    />
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${user.status === USER_STATUS.ATIVO ? 'bg-green-100 text-green-800' : 
                      user.status === USER_STATUS.ADMIN ? 'bg-purple-100 text-purple-800' : 
                      user.status === USER_STATUS.TRIAL ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDate(user.created_at)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDate(user.updated_at)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <select
                      value={user.status}
                      onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatusType)}
                      disabled={updatingUserId === user.id} // Disable while updating
                      className={`block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm 
                        focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
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
                        className="p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-md"
                        title="Simular fim do período de teste"
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                    )}
                    
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                        title="Remover usuário"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        Total de usuários: {filteredUsers.length}
      </div>
    </div>
  );
}
