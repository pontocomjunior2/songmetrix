import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface RadioStream {
  url: string;
  name: string;
  sheet: string;
  cidade: string;
  estado: string;
  regiao: string;
  segmento: string;
  index: string;
}

const RadioStreams: React.FC = () => {
  const [streams, setStreams] = useState<RadioStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStream, setEditingStream] = useState<RadioStream | null>(null);
  const { user } = useAuth();

  const API_URL = 'https://cloud1.radyou.com.br';
  const API_KEY = 'Conquista@@2';

  const fetchStreams = async () => {
    try {
      const response = await fetch(`${API_URL}/streams`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      if (!response.ok) throw new Error('Falha ao carregar rádios');
      const data = await response.json();
      setStreams(data);
    } catch (error) {
      toast.error('Erro ao carregar lista de rádios');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
export default RadioStreams; // Adicionando a exportação do componente

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const streamData = {
      url: formData.get('url'),
      name: formData.get('name'),
      sheet: formData.get('sheet'),
      cidade: formData.get('cidade'),
      estado: formData.get('estado'),
      regiao: formData.get('regiao'),
      segmento: formData.get('segmento')
    };
export default RadioStreams; // Adicionando a exportação do componente

    try {
      const url = editingStream
        ? `${API_URL}/streams/${editingStream.index}`
        : `${API_URL}/streams`;

      const response = await fetch(url, {
        method: editingStream ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(streamData)
      });

      if (!response.ok) throw new Error('Falha ao salvar rádio');
      
      toast.success(editingStream ? 'Rádio atualizada com sucesso!' : 'Rádio adicionada com sucesso!');
      setEditingStream(null);
      fetchStreams();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast.error('Erro ao salvar rádio');
      console.error(error);
    }
  };

  const handleDelete = async (index: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta rádio?')) return;

    try {
      const response = await fetch(`${API_URL}/streams/${index}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (!response.ok) throw new Error('Falha ao excluir rádio');
      
      toast.success('Rádio excluída com sucesso!');
      fetchStreams();
    } catch (error) {
      toast.error('Erro ao excluir rádio');
      console.error(error);
    }
  };

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      toast.error('Acesso não autorizado');
      return;
    }
    fetchStreams();
  }, [user]);

  if (user?.role !== 'ADMIN') {
    return <div className="p-4">Acesso não autorizado</div>;
  }

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Gerenciamento de Rádios</h2>
      
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <input
              type="text"
              name="url"
              defaultValue={editingStream?.url}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              name="name"
              defaultValue={editingStream?.name}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sheet</label>
            <input
              type="text"
              name="sheet"
              defaultValue={editingStream?.sheet}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input
              type="text"
              name="cidade"
              defaultValue={editingStream?.cidade}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <input
              type="text"
              name="estado"
              defaultValue={editingStream?.estado}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Região</label>
            <input
              type="text"
              name="regiao"
              defaultValue={editingStream?.regiao}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Segmento</label>
            <input
              type="text"
              name="segmento"
              defaultValue={editingStream?.segmento}
              required
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingStream ? 'Atualizar' : 'Adicionar'} Rádio
          </button>
          {editingStream && (
            <button
              type="button"
              onClick={() => setEditingStream(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar Edição
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Nome</th>
              <th className="p-2 border">Cidade</th>
              <th className="p-2 border">Estado</th>
              <th className="p-2 border">Região</th>
              <th className="p-2 border">Segmento</th>
              <th className="p-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream) => (
              <tr key={stream.index}>
                <td className="p-2 border">{stream.name}</td>
                <td className="p-2 border">{stream.cidade}</td>
                <td className="p-2 border">{stream.estado}</td>
                <td className="p-2 border">{stream.regiao}</td>
                <td className="p-2 border">{stream.segmento}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStream(stream)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(stream.index)}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
  const [streams, setStreams] = useState<RadioStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStream, setEditingStream] = useState<RadioStream | null>(null);
  const { user } = useAuth();

  const API_URL = 'https://cloud1.radyou.com.br';
  const API_KEY = 'Conquista@@2';

  const fetchStreams = async () => {
    try {
      const response = await fetch(`${API_URL}/streams`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      if (!response.ok) throw new Error('Falha ao carregar rádios');
      const data = await response.json();
      setStreams(data);
    } catch (error) {
      toast.error('Erro ao carregar lista de rádios');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const streamData = {
      url: formData.get('url'),
      name: formData.get('name'),
      sheet: formData.get('sheet'),
      cidade: formData.get('cidade'),
      estado: formData.get('estado'),
      regiao: formData.get('regiao'),
      segmento: formData.get('segmento')
    };

    try {
      const url = editingStream
        ? `${API_URL}/streams/${editingStream.index}`
        : `${API_URL}/streams`;

      const response = await fetch(url, {
        method: editingStream ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(streamData)
      });

      if (!response.ok) throw new Error('Falha ao salvar rádio');
      
      toast.success(editingStream ? 'Rádio atualizada com sucesso!' : 'Rádio adicionada com sucesso!');
      setEditingStream(null);
      fetchStreams();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast.error('Erro ao salvar rádio');
      console.error(error);
    }
  };

  const handleDelete = async (index: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta rádio?')) return;

    try {
      const response = await fetch(`${API_URL}/streams/${index}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (!response.ok) throw new Error('Falha ao excluir rádio');
      
      toast.success('Rádio excluída com sucesso!');
      fetchStreams();
    } catch (error) {
      toast.error('Erro ao excluir rádio');
      console.error(error);
    }
  };

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      toast.error('Acesso não autorizado');
      return;
    }
    fetchStreams();
  }, [user]);

  if (user?.role !== 'ADMIN') {
    return <div className="p-4">Acesso não autorizado</div>;
  }

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Gerenciamento de Rádios</h2>
      
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <input
              type="text"
              name="url"
              defaultValue={editingStream?.url}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              name="name"
              defaultValue={editingStream?.name}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sheet</label>
            <input
              type="text"
              name="sheet"
              defaultValue={editingStream?.sheet}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input
              type="text"
              name="cidade"
              defaultValue={editingStream?.cidade}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <input
              type="text"
              name="estado"
              defaultValue={editingStream?.estado}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Região</label>
            <input
              type="text"
              name="regiao"
              defaultValue={editingStream?.regiao}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Segmento</label>
            <input
              type="text"
              name="segmento"
              defaultValue={editingStream?.segmento}
              required
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingStream ? 'Atualizar' : 'Adicionar'} Rádio
          </button>
          {editingStream && (
            <button
              type="button"
              onClick={() => setEditingStream(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar Edição
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Nome</th>
              <th className="p-2 border">Cidade</th>
              <th className="p-2 border">Estado</th>
              <th className="p-2 border">Região</th>
              <th className="p-2 border">Segmento</th>
              <th className="p-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream) => (
              <tr key={stream.index}>
                <td className="p-2 border">{stream.name}</td>
                <td className="p-2 border">{stream.cidade}</td>
                <td className="p-2 border">{stream.estado}</td>
                <td className="p-2 border">{stream.regiao}</td>
                <td className="p-2 border">{stream.segmento}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStream(stream)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(stream.index)}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RadioStreams;
