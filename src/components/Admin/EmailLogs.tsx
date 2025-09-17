import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase-client';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type EmailLog = {
  id: string;
  user_id: string;
  template_id: string;
  sequence_id: string | null;
  sent_at: string;
  status: string;
  error_message: string | null;
  email_to: string;
  subject: string;
  template?: {
    name: string;
  };
  sequence?: {
    name: string;
  };
  user?: {
    email: string;
    full_name: string;
  };
};

function EmailLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({
    status: '',
    searchTerm: '',
    dateFrom: '',
    dateTo: ''
  });
  const logsPerPage = 20;

  useEffect(() => {
    fetchLogs();
    fetchTotalCount();
  }, [page, filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // First, get the email logs without relationships
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .range((page - 1) * logsPerPage, page * logsPerPage - 1);

      // Aplicar filtros
      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      if (filter.searchTerm) {
        query = query.or(`email_to.ilike.%${filter.searchTerm}%,subject.ilike.%${filter.searchTerm}%`);
      }

      if (filter.dateFrom) {
        query = query.gte('sent_at', filter.dateFrom);
      }

      if (filter.dateTo) {
        // Adicionar um dia para incluir todo o dia selecionado
        const nextDay = new Date(filter.dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('sent_at', nextDay.toISOString());
      }

      const { data: emailLogs, error } = await query;

      if (error) throw error;
      
      if (!emailLogs || emailLogs.length === 0) {
        setLogs([]);
        return;
      }

      // Get unique IDs for related data
      const templateIds = [...new Set(emailLogs.map(log => log.template_id).filter(Boolean))];
      const sequenceIds = [...new Set(emailLogs.map(log => log.sequence_id).filter(Boolean))];
      const userIds = [...new Set(emailLogs.map(log => log.user_id).filter(Boolean))];

      // Fetch related data separately
      const [templatesData, sequencesData, usersData] = await Promise.all([
        templateIds.length > 0 
          ? supabase.from('email_templates').select('id, name').in('id', templateIds)
          : { data: [], error: null },
        sequenceIds.length > 0 
          ? supabase.from('email_sequences').select('id, name').in('id', sequenceIds)
          : { data: [], error: null },
        userIds.length > 0 
          ? supabase.from('users').select('id, email, full_name').in('id', userIds)
          : { data: [], error: null }
      ]);

      // Create lookup maps
      const templatesMap = new Map((templatesData.data || []).map(t => [t.id, t]));
      const sequencesMap = new Map((sequencesData.data || []).map(s => [s.id, s]));
      const usersMap = new Map((usersData.data || []).map(u => [u.id, u]));

      // Combine data
      const enrichedLogs = emailLogs.map(log => ({
        ...log,
        template: templatesMap.get(log.template_id) || null,
        sequence: sequencesMap.get(log.sequence_id) || null,
        user: usersMap.get(log.user_id) || null
      }));

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast.error('Não foi possível carregar o histórico de emails');
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalCount = async () => {
    try {
      let query = supabase
        .from('email_logs')
        .select('id', { count: 'exact', head: true });

      // Aplicar os mesmos filtros
      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      if (filter.searchTerm) {
        query = query.or(`email_to.ilike.%${filter.searchTerm}%,subject.ilike.%${filter.searchTerm}%`);
      }

      if (filter.dateFrom) {
        query = query.gte('sent_at', filter.dateFrom);
      }

      if (filter.dateTo) {
        // Adicionar um dia para incluir todo o dia selecionado
        const nextDay = new Date(filter.dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('sent_at', nextDay.toISOString());
      }

      const { count, error } = await query;

      if (error) throw error;
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Erro ao contar logs:', error);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilter(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(1); // Resetar para a primeira página quando mudar o filtro
  };

  const handleClearFilters = () => {
    setFilter({
      status: '',
      searchTerm: '',
      dateFrom: '',
      dateTo: ''
    });
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return 'Data inválida';
    }
  };

  const renderPagination = () => {
    const pageCount = Math.ceil(totalCount / logsPerPage);
    
    if (pageCount <= 1) return null;
    
    return (
      <div className="flex justify-between items-center mt-4">
        <div>
          <span className="text-sm text-gray-700">
            Mostrando <span className="font-medium">{(page - 1) * logsPerPage + 1}</span> a{' '}
            <span className="font-medium">{Math.min(page * logsPerPage, totalCount)}</span> de{' '}
            <span className="font-medium">{totalCount}</span> registros
          </span>
        </div>
        <nav className="flex space-x-2">
          <button
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className={`px-3 py-1 rounded ${
              page === 1 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={() => setPage(prev => Math.min(prev + 1, pageCount))}
            disabled={page === pageCount}
            className={`px-3 py-1 rounded ${
              page === pageCount 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            Próxima
          </button>
        </nav>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Histórico de Emails</h1>
      
      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">
              Busca
            </label>
            <input
              type="text"
              id="searchTerm"
              name="searchTerm"
              value={filter.searchTerm}
              onChange={handleFilterChange}
              placeholder="Email ou assunto"
              className="w-full p-2 border rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={filter.status}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Todos</option>
              <option value="SUCCESS">Enviados</option>
              <option value="FAILED">Falhas</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              id="dateFrom"
              name="dateFrom"
              value={filter.dateFrom}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
              Data final
            </label>
            <input
              type="date"
              id="dateTo"
              name="dateTo"
              value={filter.dateTo}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-md"
            />
          </div>
        </div>
        
        <div className="mt-4 text-right">
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md mr-2"
          >
            Limpar filtros
          </button>
          <button
            onClick={() => { fetchLogs(); fetchTotalCount(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Filtrar
          </button>
        </div>
      </div>
      
      {/* Lista de logs */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                  Data
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Destinatário
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Assunto
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Template
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                    {formatDate(log.sent_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {log.user?.full_name ? (
                      <div>
                        <div>{log.user.full_name}</div>
                        <div className="text-xs text-gray-400">{log.email_to}</div>
                      </div>
                    ) : (
                      log.email_to
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {log.subject}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {log.template?.name || '-'}
                    {log.sequence && (
                      <div className="text-xs text-gray-400">
                        Sequência: {log.sequence.name}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {log.status === 'SUCCESS' ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">
                        Enviado
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">
                          Falha
                        </span>
                        {log.error_message && (
                          <div className="text-xs text-red-500 mt-1">
                            {log.error_message.length > 50 
                              ? `${log.error_message.substring(0, 50)}...` 
                              : log.error_message}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {renderPagination()}
    </div>
  );
}

export default EmailLogs;