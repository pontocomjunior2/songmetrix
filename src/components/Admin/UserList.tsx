import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus, UserStatusType } from '../../lib/auth';
import Loading from '../Common/Loading';
import { ErrorAlert } from '../Common/Alert';
import UserAvatar from '../Common/UserAvatar';
import { toast } from 'react-toastify'; // Importing toast for notifications
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface User {
  id: string;
  email: string | null;
  status: keyof typeof UserStatus; // Change to match the UserStatus keys
  created_at: string;
  updated_at: string;
  photoURL?: string;
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusType | 'ALL'>('ALL');
  const { getAllUsers, updateUserStatus, removeUser, currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, statusFilter]);

  const filterUsers = () => {
    const validUsers = users.filter(user => 
      [UserStatus.ATIVO, UserStatus.INATIVO, UserStatus.ADMIN].includes(user.status)
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
      
      // Fetch directly from the users table
      const { data: usersList, error: fetchError } = await supabase
        .from('users')  // Fetch from the users table
        .select('id, email, status, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error details:', fetchError);
        throw new Error(fetchError.message);
      }

      if (!usersList) {
        throw new Error('Nenhum usuário encontrado');
      }

      console.log('Fetched users:', usersList); // Debugging line to check the data structure
      console.log('Users fetched from database:', JSON.stringify(usersList, null, 2)); // Log the fetched users
      console.log('Users fetched from database:', JSON.stringify(usersList, null, 2)); // Log the fetched users
      setUsers(usersList);
    } catch (error: any) {
      let errorMessage = 'Erro ao carregar usuários';
      if (error.message.includes('permission denied')) {
        errorMessage = 'Você não tem permissão de administrador. Por favor, faça logout e login novamente.';
      }
      setError(errorMessage);
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatusType) => {
    try {
      setError('');
      setUpdatingUserId(userId); // Set the user ID being updated

      // Check if the user is trying to change their own admin status
      if (userId === currentUser?.id && currentUser?.status === 'ADMIN' && newStatus !== 'ADMIN') {
        throw new Error('Você não pode remover seu próprio status de administrador');
      }

      // Check if the new status is valid
      if (!Object.values(UserStatus).includes(newStatus)) {
        throw new Error('Status inválido');
      }

      // Update the local state immediately
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId
            ? { ...user, status: newStatus, updated_at: new Date().toISOString() }
            : user
        )
      );

      // Update the status in the users table
      console.log(`Updating user ${userId} to status ${newStatus}`); // Debugging line
      const { error: updateError } = await supabase
        .from('users')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      toast.success(`Status do usuário atualizado para ${newStatus}`);
      
      // Reload the list of users after a brief delay
      setTimeout(() => loadUsers(), 1000);
    } catch (error: any) {
      // Revert the local change if there's an error
      setUsers(prevUsers => [...prevUsers]);
      
      let errorMessage = 'Erro ao atualizar status do usuário';
      if (error.message.includes('not found')) {
        errorMessage = 'Usuário não encontrado';
      } else if (error.message.includes('permission denied')) {
        errorMessage = 'Acesso negado. Apenas administradores podem alterar status.';
      } else {
        errorMessage = error.message;
      }
      setError(errorMessage);
      console.error('Erro ao atualizar status:', error);
    } finally {
      setUpdatingUserId(null); // Reset the updating user ID
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gerenciamento de Usuários</h2>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filtrar por status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatusType | 'ALL')}
            className="mt-1 block w-40 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="ALL">Todos</option>
            <option value={UserStatus.ATIVO}>Ativos</option>
            <option value={UserStatus.INATIVO}>Inativos</option>
            <option value={UserStatus.ADMIN}>Admins</option>
          </select>
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
                    ${user.status === UserStatus.ATIVO ? 'bg-green-100 text-green-800' : 
                      user.status === UserStatus.ADMIN ? 'bg-purple-100 text-purple-800' : 
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
                      <option value={UserStatus.INATIVO}>Inativo</option>
                      <option value={UserStatus.ATIVO}>Ativo</option>
                      <option value={UserStatus.ADMIN}>Admin</option>
                    </select>
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
