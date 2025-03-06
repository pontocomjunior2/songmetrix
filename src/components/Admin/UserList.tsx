import React, { useEffect, useState, useRef } from 'react';
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
  const { updateUserStatus, currentUser, userStatus } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Referência para verificar se o componente está montado
  const isMounted = useRef(true);
  
  // Limpar a referência quando o componente for desmontado
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Limpar mensagem ao montar o componente
    setMessage(null);
    // Carregar usuários
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
    setLoading(true);
    // Limpar mensagem ao carregar usuários
    setMessage(null);
    
    console.log('Carregando usuários...');
    
    try {
      // Buscar usuários da tabela users
      const { data: usersData, error: fetchError } = await supabase
        .from('users')
        .select('id, email, status, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        throw fetchError;
      }
      
      console.log('Usuários carregados:', usersData);
      
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
    // Limpar mensagem antes de atualizar
    setMessage(null);
    setRefreshing(true);
    try {
      await loadUsers();
      // Mostrar mensagem de sucesso temporária
      setMessage({
        type: 'success',
        text: 'Lista de usuários atualizada com sucesso'
      });
      
      // Limpar a mensagem após 3 segundos
      setTimeout(() => {
        if (isMounted.current) {
          setMessage(null);
        }
      }, 3000);
    } catch (error) {
      console.error('Erro ao atualizar lista de usuários:', error);
      setMessage({
        type: 'error',
        text: 'Erro ao atualizar lista de usuários'
      });
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

  const handleConvertToActive = async (userId: string) => {
    try {
      setIsLoading(true);
      
      // Determinar se estamos em ambiente de desenvolvimento
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // Opção 1: Usa a rota de desenvolvimento sem autenticação
      // Opção 2: Usa a rota de API com autenticação em todos os ambientes
      // Defina qual opção usar aqui:
      const useOption: number = 2; // 1 ou 2
      
      let endpoint;
      let headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (useOption === 1 && isDev) {
        // Opção 1: Usa rota dev em ambiente de desenvolvimento
        const serverBaseUrl = 'http://localhost:3001';
        endpoint = `${serverBaseUrl}/dev/convert-user-to-active`;
      } else {
        // Opção 2: Usa rota de API com autenticação em todos os ambientes
        endpoint = isDev 
          ? 'http://localhost:3001/api/convert-user-to-active' 
          : '/api/convert-user-to-active';
          
        // Obter token para autenticação
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('Não foi possível obter o token de autenticação. Faça login novamente.');
        }
        
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('Enviando solicitação para:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        credentials: isDev ? 'include' : 'same-origin', // Incluir cookies em dev
        body: JSON.stringify({
          userId,
          forceConversion: false
        })
      });
      
      // Obter texto de resposta para diagnóstico
      const responseText = await response.text();
      console.log('Resposta recebida:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Resposta não é um JSON válido:', responseText);
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}`);
      }
      
      if (!response.ok) {
        console.error('Erro na resposta do servidor:', data);
        throw new Error(data.message || `Erro do servidor: ${response.status}`);
      }
      
      await loadUsers();
      
      // Em caso de sucesso parcial
      if (response.status === 206) {
        setMessage({
          type: 'warning',
          text: `${data.message}: ${data.error || 'Detalhes não disponíveis'}`
        });
      } else {
        setMessage({
          type: 'success',
          text: `Usuário convertido para ATIVO com sucesso. Motivo: ${data.stripeVerification?.reason || 'N/A'}`
        });
        
        // Limpar a mensagem após 5 segundos
        setTimeout(() => {
          if (isMounted.current) {
            setMessage(null);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Erro ao converter usuário:', error);
      setMessage({
        type: 'error',
        text: `Erro ao converter usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceConvertToActive = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja forçar a conversão deste usuário para ATIVO sem verificar no Stripe?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Determinar se estamos em ambiente de desenvolvimento
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // Opção 1: Usa a rota de desenvolvimento sem autenticação
      // Opção 2: Usa a rota de API com autenticação em todos os ambientes
      // Defina qual opção usar aqui:
      const useOption: number = 2; // 1 ou 2
      
      let endpoint;
      let headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (useOption === 1 && isDev) {
        // Opção 1: Usa rota dev em ambiente de desenvolvimento
        const serverBaseUrl = 'http://localhost:3001';
        endpoint = `${serverBaseUrl}/dev/convert-user-to-active`;
      } else {
        // Opção 2: Usa rota de API com autenticação em todos os ambientes
        endpoint = isDev 
          ? 'http://localhost:3001/api/convert-user-to-active' 
          : '/api/convert-user-to-active';
          
        // Obter token para autenticação
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('Não foi possível obter o token de autenticação. Faça login novamente.');
        }
        
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('Enviando solicitação para:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        credentials: isDev ? 'include' : 'same-origin', // Incluir cookies em dev
        body: JSON.stringify({
          userId,
          forceConversion: true
        })
      });
      
      // Obter texto de resposta para diagnóstico
      const responseText = await response.text();
      console.log('Resposta recebida:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Resposta não é um JSON válido:', responseText);
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}`);
      }
      
      if (!response.ok) {
        console.error('Erro na resposta do servidor:', data);
        throw new Error(data.message || `Erro do servidor: ${response.status}`);
      }
      
      await loadUsers();
      
      // Em caso de sucesso parcial
      if (response.status === 206) {
        setMessage({
          type: 'warning',
          text: `${data.message}: ${data.error || 'Detalhes não disponíveis'}`
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Usuário convertido para ATIVO com sucesso (forçado)'
        });
        
        // Limpar a mensagem após 5 segundos
        setTimeout(() => {
          if (isMounted.current) {
            setMessage(null);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Erro ao converter usuário (forçado):', error);
      setMessage({
        type: 'error',
        text: `Erro ao converter usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <Loading size="large" message="Carregando usuários..." />;
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Gerenciamento de Usuários</h2>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por email..."
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value === '' ? 'ALL' : e.target.value as UserStatusType)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Todos os status</option>
            <option value="ADMIN">Admin</option>
            <option value="ATIVO">Ativo</option>
            <option value="TRIAL">Trial</option>
            <option value="INATIVO">Inativo</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Atualizando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </>
            )}
          </button>
        </div>
      </div>
      
      {message && (
        <div className={`p-4 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : message.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">
                      Usuário
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/6">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/6">
                      Data de Criação
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/6">
                      Última Atualização
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                              {user.email ? user.email.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{user.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === 'ADMIN' 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                              : user.status === 'ATIVO' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : user.status === 'TRIAL' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(user.updated_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end items-center gap-2">
                            {user.status !== 'ADMIN' && (
                              <select
                                value={user.status}
                                onChange={(e) => handleStatusChange(user.id, e.target.value as UserStatusType)}
                                disabled={updatingUserId === user.id}
                                className="block w-24 pl-3 pr-10 py-1 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
                              >
                                <option value="ATIVO">Ativo</option>
                                <option value="TRIAL">Trial</option>
                                <option value="INATIVO">Inativo</option>
                                {userStatus === 'ADMIN' && <option value="ADMIN">Admin</option>}
                              </select>
                            )}
                            
                            {user.status === 'TRIAL' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleConvertToActive(user.id)}
                                  disabled={isLoading}
                                  className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 rounded-md text-xs font-medium transition-colors"
                                  title="Verificar pagamento no Stripe e ativar usuário"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Verificar
                                </button>
                                <button
                                  onClick={() => handleForceConvertToActive(user.id)}
                                  disabled={isLoading}
                                  className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300 rounded-md text-xs font-medium transition-colors"
                                  title="Forçar ativação sem verificação no Stripe"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  Forçar
                                </button>
                              </div>
                            )}
                            
                            {userStatus === 'ADMIN' && user.id !== currentUser?.id && (
                              <button
                                onClick={() => handleRemoveUser(user.id)}
                                disabled={updatingUserId === user.id}
                                className="inline-flex items-center px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md"
                                title="Remover usuário"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Mostrando {filteredUsers.length} de {users.length} usuários
          </div>
        </>
      )}
    </div>
  );
}
