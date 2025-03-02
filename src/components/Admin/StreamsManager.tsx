import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiServices from '../../services/api';
import { toast } from 'react-toastify';
import { Loader2, Search, Plus, Edit, Trash2, X, Check, Filter } from 'lucide-react';

interface Stream {
  id?: number;
  url: string;
  name: string;
  sheet: string;
  cidade: string;
  estado: string;
  regiao: string;
  segmento: string;
  index: string;
}

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const StreamsManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [formData, setFormData] = useState<Stream>({
    url: '',
    name: '',
    sheet: '',
    cidade: '',
    estado: '',
    regiao: '',
    segmento: '',
    index: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    regiao: '',
    estado: '',
    cidade: '',
    segmento: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueCities, setUniqueCities] = useState<string[]>([]);
  const [uniqueSegments, setUniqueSegments] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser) {
      fetchStreams();
    }
  }, [currentUser]);

  useEffect(() => {
    if (streams.length > 0) {
      // Extrair cidades e segmentos únicos para os filtros
      const cities = [...new Set(streams.map(stream => stream.cidade))].sort();
      setUniqueCities(cities);

      const segments = [...new Set(
        streams.flatMap(stream => 
          stream.segmento.split(',').map(s => s.trim())
        )
      )].sort();
      setUniqueSegments(segments);

      applyFilters();
    }
  }, [streams, searchTerm, filterOptions]);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const data = await apiServices.streams.getAll();
      setStreams(data);
      setFilteredStreams(data);
    } catch (error) {
      console.error('Erro ao carregar streams:', error);
      toast.error('Erro ao carregar lista de streams');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...streams];

    // Aplicar filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(stream => 
        stream.name.toLowerCase().includes(term) || 
        stream.cidade.toLowerCase().includes(term) ||
        stream.segmento.toLowerCase().includes(term)
      );
    }

    // Aplicar filtros de seleção
    if (filterOptions.regiao) {
      result = result.filter(stream => stream.regiao === filterOptions.regiao);
    }
    
    if (filterOptions.estado) {
      result = result.filter(stream => stream.estado === filterOptions.estado);
    }
    
    if (filterOptions.cidade) {
      result = result.filter(stream => stream.cidade === filterOptions.cidade);
    }
    
    if (filterOptions.segmento) {
      result = result.filter(stream => 
        stream.segmento.split(',').map(s => s.trim()).includes(filterOptions.segmento)
      );
    }

    setFilteredStreams(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilterOptions(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilterOptions({
      regiao: '',
      estado: '',
      cidade: '',
      segmento: ''
    });
    setSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingStream?.id) {
        // Atualizar stream existente
        await apiServices.streams.update(editingStream.id, formData);
        toast.success('Stream atualizado com sucesso!');
      } else {
        // Criar novo stream
        await apiServices.streams.create(formData);
        toast.success('Stream criado com sucesso!');
      }
      
      // Recarregar a lista e resetar o formulário
      fetchStreams();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar stream:', error);
      toast.error('Erro ao salvar stream');
    }
  };

  const handleEdit = (stream: Stream) => {
    setEditingStream(stream);
    setFormData(stream);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    
    if (!window.confirm('Tem certeza que deseja excluir este stream?')) {
      return;
    }
    
    try {
      await apiServices.streams.delete(id);
      toast.success('Stream excluído com sucesso!');
      fetchStreams();
    } catch (error) {
      console.error('Erro ao excluir stream:', error);
      toast.error('Erro ao excluir stream');
    }
  };

  const resetForm = () => {
    setEditingStream(null);
    setFormData({
      url: '',
      name: '',
      sheet: '',
      cidade: '',
      estado: '',
      regiao: '',
      segmento: '',
      index: ''
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciamento de Streams</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Novo Stream'}
          </button>
        </div>
      </div>

      {/* Formulário de criação/edição */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingStream ? 'Editar Stream' : 'Novo Stream'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Rádio
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome na Planilha
                </label>
                <input
                  type="text"
                  name="sheet"
                  value={formData.sheet}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL do Stream
                </label>
                <input
                  type="url"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estado
                </label>
                <select
                  name="estado"
                  value={formData.estado}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                >
                  <option value="">Selecione um estado</option>
                  {ESTADOS.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Região
                </label>
                <select
                  name="regiao"
                  value={formData.regiao}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                >
                  <option value="">Selecione uma região</option>
                  {REGIOES.map(regiao => (
                    <option key={regiao} value={regiao}>{regiao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Índice
                </label>
                <input
                  type="text"
                  name="index"
                  value={formData.index}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Segmento
                </label>
                <textarea
                  name="segmento"
                  value={formData.segmento}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  rows={2}
                  required
                  placeholder="Ex: Jovem, Pop, Rock"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
              >
                {editingStream ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filtros</h2>
            <button
              onClick={resetFilters}
              className="text-sm text-navy-600 hover:text-navy-800 dark:text-navy-400 dark:hover:text-navy-300"
            >
              Limpar filtros
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Região
              </label>
              <select
                name="regiao"
                value={filterOptions.regiao}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todas as regiões</option>
                {REGIOES.map(regiao => (
                  <option key={regiao} value={regiao}>{regiao}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                name="estado"
                value={filterOptions.estado}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todos os estados</option>
                {ESTADOS.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cidade
              </label>
              <select
                name="cidade"
                value={filterOptions.cidade}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todas as cidades</option>
                {uniqueCities.map(cidade => (
                  <option key={cidade} value={cidade}>{cidade}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Segmento
              </label>
              <select
                name="segmento"
                value={filterOptions.segmento}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Todos os segmentos</option>
                {uniqueSegments.map(segmento => (
                  <option key={segmento} value={segmento}>{segmento}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Barra de pesquisa */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nome, cidade ou segmento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
        />
      </div>

      {/* Tabela de streams */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-navy-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Cidade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Região</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Segmento</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-200">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStreams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      Nenhum stream encontrado
                    </td>
                  </tr>
                ) : (
                  filteredStreams.map((stream) => (
                    <tr key={stream.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.cidade}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.estado}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{stream.regiao}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                        <div className="max-w-xs truncate">{stream.segmento}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(stream)}
                            className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(stream.id)}
                            className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 text-sm text-gray-500 dark:text-gray-400">
          Total: {filteredStreams.length} streams
        </div>
      </div>
    </div>
  );
};

export default StreamsManager; 