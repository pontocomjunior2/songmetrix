import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../services/api.ts';
import { toast } from 'react-toastify';
import { Loader2, Edit, Trash2, Plus, X, Check } from 'lucide-react';

interface RelayStream {
  id?: number;
  stream_name: string;
  input_url: string;
  output_url: string;
}

const RelayStreamsManager: React.FC = () => {
  const [streams, setStreams] = useState<RelayStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStream, setEditingStream] = useState<RelayStream | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/relay-streams');
      setStreams(response);
    } catch (error) {
      toast.error('Erro ao carregar lista de relay streams');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const streamData = {
      stream_name: formData.get('stream_name'),
      input_url: formData.get('input_url'),
      output_url: formData.get('output_url')
    };

    try {
      if (editingStream?.id) {
        await apiPut(`/api/relay-streams/${editingStream.id}`, streamData);
        toast.success('Relay stream atualizado com sucesso!');
      } else {
        await apiPost('/api/relay-streams', streamData);
        toast.success('Relay stream adicionado com sucesso!');
      }
      setEditingStream(null);
      setIsFormOpen(false);
      fetchStreams();
    } catch (error) {
      toast.error('Erro ao salvar relay stream');
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este relay stream?')) return;

    try {
      await apiDelete(`/api/relay-streams/${id}`);
      toast.success('Relay stream excluído com sucesso!');
      fetchStreams();
    } catch (error) {
      toast.error('Erro ao excluir relay stream');
      console.error(error);
    }
  };

  const handleEdit = (stream: RelayStream) => {
    setEditingStream(stream);
    setIsFormOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Gerenciar Relay Streams</h2>
        <button
          onClick={() => {
            setEditingStream(null);
            setIsFormOpen(true);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          Adicionar Relay Stream
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome do Stream</label>
              <input
                type="text"
                name="stream_name"
                defaultValue={editingStream?.stream_name || ''}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">URL de Entrada</label>
              <input
                type="text"
                name="input_url"
                defaultValue={editingStream?.input_url || ''}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">URL de Saída</label>
              <input
                type="text"
                name="output_url"
                defaultValue={editingStream?.output_url || ''}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingStream(null);
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
              >
                <Check className="w-4 h-4" />
                {editingStream ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stream Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Input URL</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Output URL</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {streams.map((stream) => (
              <tr key={stream.id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{stream.stream_name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 break-all">{stream.input_url}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 break-all">{stream.output_url}</div>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(stream)}
                    className="inline-flex items-center p-1 text-blue-600 hover:text-blue-900 transition-colors duration-150"
                    title="Edit stream"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => stream.id && handleDelete(stream.id)}
                    className="inline-flex items-center p-1 text-red-600 hover:text-red-900 transition-colors duration-150"
                    title="Delete stream"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RelayStreamsManager;