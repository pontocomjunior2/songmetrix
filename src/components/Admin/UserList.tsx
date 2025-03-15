import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/user-status';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast as reactToast } from 'react-toastify'; // Importing toast for notifications
import { Trash2, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { FaEdit } from 'react-icons/fa';

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
  const [refreshing, setRefreshing] = useState(false);
  const [processingTasks, setProcessingTasks] = useState(false);
  const { updateUserStatus, currentUser, userStatus } = useAuth();

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
      
      console.log('Usuários carregados da tabela:', usersData);
      
      // Verificar com o servidor se há informações adicionais sobre os usuários
      if (usersData?.length > 0) {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          throw new Error('Sessão não encontrada');
        }
        
        try {
          // Chamar API para obter informações atualizadas dos usuários
          const response = await fetch('/api/users/metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session.access_token}`
            },
            body: JSON.stringify({
              userIds: usersData.map(user => user.id)
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.users && Array.isArray(result.users)) {
              // Combinar os dados da tabela users com os metadados
              const combinedUsers = usersData.map(tableUser => {
                const metadataUser = result.users.find((u: { id: string, metadata?: { status?: string } }) => u.id === tableUser.id);
                if (metadataUser && metadataUser.metadata && metadataUser.metadata.status) {
                  // Se o status nos metadados for diferente do status na tabela, use o dos metadados
                  return {
                    ...tableUser,
                    status: metadataUser.metadata.status as UserStatusType
                  };
                }
                return tableUser;
              });
              
              console.log('Usuários combinados com metadados:', combinedUsers);
              setUsers(combinedUsers);
              return;
            }
          }
        } catch (apiError) {
          console.error('Erro ao buscar metadados:', apiError);
          // Continuar com os dados da tabela em caso de erro
        }
      }
      
      // Se não conseguir dados combinados, usar apenas os dados da tabela
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
      
      // Declarar variáveis fora do bloco try/catch para torná-las acessíveis em todo o escopo da função
      let responseData: any = null;
      let logoutNotice = '';
      
      try {
        // NOVA LÓGICA: Se estamos definindo como ADMIN, usar a rota dedicada
        if (newStatus === 'ADMIN') {
          try {
            console.log('Usando rota dedicada para definir status ADMIN...');
            
            const adminResponse = await fetch('/api/admin/set-admin-status', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session.access_token}`
              },
              body: JSON.stringify({ userId })
            });
            
            const adminResult = await adminResponse.json();
            responseData = adminResult;
            
            if (!adminResponse.ok || !adminResult.success) {
              console.error('Falha na definição de ADMIN:', adminResult);
              throw new Error(adminResult.message || 'Erro ao definir status ADMIN');
            }
            
            console.log('Resposta do servidor (rota ADMIN dedicada):', adminResult);
            
            // Exibir notificação específica para ADMIN
            if (adminResult.instructions) {
              reactToast.info(adminResult.instructions, { autoClose: 8000 });
            }
          } catch (adminError) {
            console.error('Erro na rota ADMIN dedicada:', adminError);
            // Falhar completamente para evitar inconsistências
            throw adminError;
          }
        } else {
          // Para outros status, manter a lógica original
          try {
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
            responseData = result;
            
            if (!response.ok) {
              console.error('Falha na atualização padrão:', result.error);
              console.log('Tentando método alternativo para definir status...');
              throw new Error(result.error || 'Erro ao atualizar status');
            }
            
            console.log('Resposta do servidor (método padrão):', result);
          } catch (error) {
            // Se houver erro, tentar o método direto
            console.log('Usando método direto para atualização...');
            
            const directResponse = await fetch('/api/users/direct-update-status', {
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
            
            const directResult = await directResponse.json();
            responseData = directResult;
            
            if (!directResponse.ok) {
              throw new Error(directResult.error || 'Erro ao atualizar status (método direto)');
            }
            
            console.log('Resposta do servidor (método direto):', directResult);
          }
        }
      } catch (error) {
        // Atualizar a lista de usuários localmente
        setUsers(users.map(user => {
          if (user.id === userId) {
            // Usar o status fornecido pelo backend nos metadados, mesmo que a tabela users
            // não tenha sido atualizada devido a restrições de política
            const effectiveStatus = responseData?.newMetadata?.status || newStatus;
            console.log(`Atualizando status do usuário ${userId} na interface para ${effectiveStatus}`);
            return { ...user, status: effectiveStatus };
          }
          return user;
        }));
        
        setEditingUser(null);
        
        // Mostrar notificação de sucesso
        reactToast.success(`Status do usuário alterado para ${newStatus}`);
        
        // Exibir a mensagem de notificação sobre logout/login se estiver presente na resposta
        if (logoutNotice) {
          reactToast.info(logoutNotice, {
            autoClose: 8000, // Mantém a notificação visível por mais tempo
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
          });
        }
        
        // Se estamos promovendo para ADMIN e houve uma notificação de sistema, adicionar uma
        // notificação extra sobre a atualização da interface
        if (newStatus === 'ADMIN' && logoutNotice) {
          setTimeout(() => {
            reactToast.info("A interface mostrará o status atual mesmo que a tabela não tenha sido atualizada. O dropdown será sincronizado na próxima vez que o usuário acessar o sistema.", {
              autoClose: 10000,
              pauseOnHover: true
            });
          }, 1000);
        }
      }
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

  const handleProcessTasks = async () => {
    try {
      setProcessingTasks(true);
      setError('');
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      const response = await fetch('/api/admin/process-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar tarefas');
      }
      
      console.log('Resposta do processamento de tarefas:', result);
      
      if (result.results && result.results.length > 0) {
        reactToast.success(`${result.message}`);
        
        // Recarregar a lista de usuários para refletir as mudanças
        await loadUsers();
      } else {
        reactToast.info('Nenhuma tarefa pendente encontrada');
      }
    } catch (error: any) {
      console.error('Erro ao processar tarefas:', error);
      setError(`Erro ao processar tarefas: ${error.message}`);
      reactToast.error(`Erro ao processar tarefas: ${error.message}`);
    } finally {
      setProcessingTasks(false);
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
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
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleProcessTasks}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={processingTasks}
            >
              {processingTasks ? 'Processando...' : 'Sincronizar Usuários'}
            </button>
          </div>
        </div>
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
                        disabled={updatingUserId === user.id}
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
    </div>
  );
}
