import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase-client';

type UserStatus = 'ADMIN' | 'ATIVO' | 'INATIVO';

interface User {
  id: string;
  email: string;
  status: UserStatus;
}

const UserList: React.FC = () => {
  const queryClient = useQueryClient();

  // Query para buscar usuários
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, status')
        .order('email');

      if (error) throw error;
      return data as User[];
    }
  });

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: UserStatus }) => {
      const { data, error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar status: ${error.message}`);
    }
  });

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Gerenciar Usuários</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-sm leading-4 text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-300">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-300">
                  {user.status}
                </td>
                <td className="px-6 py-4 whitespace-no-wrap border-b border-gray-300">
                  <select
                    value={user.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as UserStatus;
                      updateStatusMutation.mutate({ userId: user.id, newStatus });
                    }}
                    className="form-select mt-1 block w-full"
                    disabled={updateStatusMutation.isLoading}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserList;
