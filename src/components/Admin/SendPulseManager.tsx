import React, { useState, useEffect } from 'react';
import { toast as reactToast } from 'react-toastify';
import { supabase } from '../../lib/supabase-client';
import { syncUserWithSendPulse } from '../../utils/sendpulse-service';
import { 
  FiRefreshCw, 
  FiUsers, 
  FiUserPlus, 
  FiAlertCircle, 
  FiCheckCircle,
  FiMail,
  FiAlertTriangle,
  FiList,
  FiInfo,
  FiMessageCircle
} from 'react-icons/fi';
import { MailCheck } from 'lucide-react';

type UserStatusType = 'ADMIN' | 'ATIVO' | 'INATIVO' | 'TRIAL';

// Interface para usuário
interface User {
  id: string;
  email: string | null;
  status: UserStatusType;
  created_at: string;
  updated_at: string;
  photoURL?: string;
  full_name?: string;
  whatsapp?: string;
  last_sign_in_at?: string;
}

// Interface para progresso de sincronização
interface SyncProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  percentage: number;
}

// Interface para eventos de sincronização
interface SyncEventData {
  type: string;
  processed?: number;
  total?: number;
  success?: boolean;
  email?: string;
  message?: string;
  percentage?: number;
  errors?: number;
  totalUsers?: number;
  errorDetails?: Array<{user: string, error: string}>;
}

function SendPulseManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingUsers, setSyncingUsers] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResults, setSyncResults] = useState<SyncEventData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncResults2, setSyncResults2] = useState<Record<string, { success: boolean; message?: string; error?: string; }>>({});
  
  // Carregar usuários ao montar o componente
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Buscar lista de usuários do Supabase
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      reactToast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  // Função para sincronizar todos os usuários com o SendPulse
  const handleSyncAllUsers = async () => {
    try {
      setSyncing(true);
      setSyncProgress(null);
      setSyncResults(null);
      setError(null);
      
      // Obter a sessão atual para incluir o token de autenticação
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Sessão não encontrada');
      }
      
      // Usar o endpoint do SendPulse
      const response = await fetch('/api/sendpulse/sync-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      
      if (!response.ok && response.headers.get('Content-Type') !== 'text/event-stream') {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      // Stream de resposta - processar as atualizações de progresso
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Leitor de resposta não disponível');
      }
      
      let parsedEventData: SyncEventData | null = null;
      let currentData = '';
      
      // Ler o stream de resposta e processar as atualizações
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decodificar o chunk recebido
        const chunk = new TextDecoder().decode(value);
        
        // Processar eventos SSE linha por linha
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            currentData = line.substring(6);
            
            try {
              parsedEventData = JSON.parse(currentData);
              
              // Processar diferentes tipos de eventos
              if (parsedEventData && parsedEventData.type === 'start') {
                // Início da sincronização
                setSyncProgress({
                  total: parsedEventData.totalUsers || 0,
                  processed: 0,
                  success: 0,
                  failed: 0,
                  percentage: 0
                });
              } 
              else if (parsedEventData && parsedEventData.type === 'progress') {
                // Atualização de progresso
                const total = parsedEventData.total || 0;
                const processed = parsedEventData.processed || 0;
                const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                
                setSyncProgress(prev => ({
                  total: total,
                  processed: processed,
                  success: prev ? prev.success + (parsedEventData.success ? 1 : 0) : (parsedEventData.success ? 1 : 0),
                  failed: prev ? prev.failed + (!parsedEventData.success ? 1 : 0) : (!parsedEventData.success ? 1 : 0),
                  percentage: percentage
                }));
              } 
              else if (parsedEventData && parsedEventData.type === 'complete') {
                // Final da sincronização - resultado completo
                setSyncResults(parsedEventData);
                setSyncProgress({
                  total: parsedEventData.total || 0,
                  processed: parsedEventData.total || 0,
                  success: parsedEventData.success || 0,
                  failed: parsedEventData.errors || 0,
                  percentage: 100
                });
                
                reactToast.success(`Sincronização concluída! ${parsedEventData.success || 0} usuários sincronizados com sucesso, ${parsedEventData.errors || 0} falhas.`);
              } 
              else if (parsedEventData && parsedEventData.type === 'error') {
                // Erro durante o processamento
                throw new Error(parsedEventData.message || 'Erro durante a sincronização');
              }
            } catch (parseError) {
              console.error('Erro ao processar evento SSE:', parseError, currentData);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar usuários com SendPulse:', error);
      setError(`Erro ao sincronizar usuários com SendPulse: ${error.message}`);
      reactToast.error(`Erro ao sincronizar usuários com SendPulse: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncProgress(null); // Garantir que o progresso seja limpo mesmo em caso de erro
    }
  };

  // Função para sincronizar um único usuário com o SendPulse
  const handleSyncUserWithSendPulse = async (user: User) => {
    try {
      // Limpar resultados anteriores para este usuário
      setSyncResults2(prev => ({
        ...prev,
        [user.id]: null
      }));
      
      // Marcar usuário como em processo de sincronização
      setSyncingUsers((prev) => [...prev, user.id]);
      
      // Adicionar classe visual à linha da tabela (será manipulado via CSS)
      const userRow = document.getElementById(`user-row-${user.id}`);
      if (userRow) {
        userRow.classList.add('syncing-row');
      }
      
      // Mostrar toast de progresso claro e com ícone
      const toastId = reactToast.loading(
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0">
            <MailCheck className="w-5 h-5 text-blue-500 animate-pulse" />
          </span>
          <div>
            <p className="font-medium">Sincronizando usuário</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>, 
        {
          position: "top-right",
          autoClose: false,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: false,
        }
      );
      
      const syncData = {
        id: user.id,
        email: user.email,
        name: user.full_name,
        status: user.status,
        whatsapp: user.whatsapp || ''
      };
      
      console.log('Enviando dados para sincronização:', syncData);
      
      // Usar o método do SendPulse
      const result = await syncUserWithSendPulse(syncData);
      
      // Atualizar com o resultado (corrigido para evitar undefined)
      setSyncResults2(prev => ({
        ...prev,
        [user.id]: {
          success: result.success,
          message: result.message,
          error: result.error
        }
      }));
      
      // Atualizar o toast com o resultado e informações mais detalhadas
      if (result.success) {
        reactToast.update(toastId, {
          render: (
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0">
                <MailCheck className="w-5 h-5 text-green-500" />
              </span>
              <div>
                <p className="font-medium">Sincronização concluída</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-xs text-green-600 mt-1">
                  {result.message || 'Usuário sincronizado com sucesso!'}
                </p>
              </div>
            </div>
          ),
          type: 'success',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          isLoading: false
        });
        
        console.log('Resposta de sucesso:', result);
      } else {
        reactToast.update(toastId, {
          render: (
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
              </span>
              <div>
                <p className="font-medium">Erro na sincronização</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-xs text-red-600 mt-1">
                  {result.error || 'Erro desconhecido'}
                </p>
              </div>
            </div>
          ),
          type: 'error',
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          isLoading: false
        });
        
        console.error('Erro na resposta:', result);
      }
    } catch (error: any) {
      console.error('Exceção ao sincronizar usuário:', error);
      reactToast.error(`Erro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      // Remover usuário da lista de sincronização
      setSyncingUsers((prev) => prev.filter(id => id !== user.id));
      
      // Remover classe visual da linha
      const userRow = document.getElementById(`user-row-${user.id}`);
      if (userRow) {
        userRow.classList.remove('syncing-row');
      }
    }
  };

  // Função para formatar data
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return isNaN(date.getTime()) 
      ? 'Data inválida' 
      : date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
  };

  // Classe CSS para cada linha de usuário
  const getRowClassName = (user: User) => {
    let baseClasses = "transition-all";
    
    // Adicionar classes baseadas no status de sincronização
    if (syncingUsers.includes(user.id)) {
      baseClasses += " bg-blue-50";
    }
    
    // Adicionar classes baseadas no resultado da sincronização
    const result = syncResults2[user.id];
    if (result) {
      if (result.success) {
        baseClasses += " bg-green-50";
      } else if (!result.success) {
        baseClasses += " bg-red-50";
      }
    }
    
    return baseClasses;
  };

  const renderProgressBar = () => {
    if (!syncProgress) return null;
    
    const { percentage, processed, total, success, failed } = syncProgress;
    
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
        <div className="mb-2 flex justify-between items-center">
          <div className="text-sm font-medium">Progresso da Sincronização</div>
          <div className="text-sm font-medium">{percentage}%</div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <div>{processed} de {total} processados</div>
          <div className="flex space-x-3">
            <span className="text-green-600 flex items-center">
              <FiCheckCircle className="mr-1" /> {success}
            </span>
            <span className="text-red-600 flex items-center">
              <FiAlertCircle className="mr-1" /> {failed}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Aviso sobre uso do Brevo para envio de emails */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
        <div className="flex items-start">
          <FiMessageCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Informação importante sobre o sistema de email</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>O envio de emails (templates, testes e emails de boas-vindas) agora utiliza o <strong>Brevo SMTP</strong>. 
              O SendPulse continua sendo utilizado apenas para o gerenciamento de listas de contatos e segmentação 
              de usuários por status (TRIAL, ATIVO, INATIVO).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-0 md:p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Integração SendPulse</h1>
          <p className="text-gray-600">
            Gerencie a sincronização de usuários com o serviço de email marketing SendPulse.
          </p>
        </div>
        
        {/* Ações principais */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2 transition-colors"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Atualizar Lista
          </button>
          
          <button
            onClick={handleSyncAllUsers}
            disabled={syncing || users.length === 0}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <FiUsers />
            {syncing ? "Sincronizando..." : "Sincronizar Todos os Usuários"}
          </button>
        </div>
        
        {/* Barra de progresso */}
        {renderProgressBar()}
        
        {/* Mensagem de erro */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2">
            <FiAlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Erro na sincronização</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}
        
        {/* Resultados da sincronização */}
        {syncResults && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg">
            <h3 className="font-medium flex items-center gap-2 mb-2">
              <FiInfo className="h-5 w-5" />
              Resultado da sincronização
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">{syncResults.total || 0}</div>
                <div className="text-sm text-gray-500">Total de usuários</div>
              </div>
              
              <div className="bg-white p-3 rounded-lg shadow-sm border border-green-100">
                <div className="text-2xl font-bold text-green-600">{syncResults.success || 0}</div>
                <div className="text-sm text-gray-500">Sincronizados com sucesso</div>
              </div>
              
              <div className="bg-white p-3 rounded-lg shadow-sm border border-red-100">
                <div className="text-2xl font-bold text-red-600">{syncResults.errors || 0}</div>
                <div className="text-sm text-gray-500">Falhas</div>
              </div>
            </div>
            
            {/* Detalhes de erros */}
            {syncResults.errorDetails && syncResults.errorDetails.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-sm mb-2">Detalhes dos erros:</h4>
                <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border border-gray-200 text-xs">
                  {syncResults.errorDetails.map((detail, index) => (
                    <div key={index} className="mb-1 pb-1 border-b border-gray-100 last:border-0">
                      <span className="font-medium">{detail.user}</span>: {detail.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Tabela de usuários */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registrado
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Acesso
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr 
                      key={user.id} 
                      id={`user-row-${user.id}`}
                      className={getRowClassName(user)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-0">
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name || 'Sem nome'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email || 'Sem email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'ADMIN' 
                            ? 'bg-purple-100 text-purple-800' 
                            : user.status === 'ATIVO' 
                              ? 'bg-green-100 text-green-800' 
                              : user.status === 'TRIAL' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.last_sign_in_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleSyncUserWithSendPulse(user)}
                          disabled={syncingUsers.includes(user.id)}
                          className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed mr-3"
                          title="Sincronizar com SendPulse"
                        >
                          <div className="flex items-center">
                            <FiMail className={syncingUsers.includes(user.id) ? "animate-pulse" : ""} />
                            <span className="ml-1">
                              {syncingUsers.includes(user.id) ? 'Sincronizando...' : 'Sincronizar'}
                            </span>
                          </div>
                        </button>
                        
                        {/* Exibir resultado da sincronização individual */}
                        {syncResults2[user.id] && (
                          <span className={`text-xs ${
                            syncResults2[user.id].success 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {syncResults2[user.id].success 
                              ? syncResults2[user.id].message || 'Sincronizado!' 
                              : syncResults2[user.id].error || 'Erro'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Informações adicionais */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
            <FiList />
            Informações adicionais
          </h2>
          
          <div className="space-y-2 text-sm text-gray-600">
            <p className="flex items-start gap-2">
              <FiInfo className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
              A sincronização com o SendPulse move os usuários para listas específicas baseadas no status:
            </p>
            
            <ul className="pl-6 list-disc space-y-1">
              <li><span className="font-medium">TRIAL</span>: Usuários em período de teste</li>
              <li><span className="font-medium">ATIVO</span>: Usuários com assinatura ativa</li>
              <li><span className="font-medium">INATIVO</span>: Usuários com assinatura cancelada ou expirada</li>
              <li><span className="font-medium">ADMIN</span>: Usuários administrativos (também na lista ATIVO)</li>
            </ul>
            
            <p className="flex items-start gap-2">
              <FiUserPlus className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
              Novos usuários são sincronizados automaticamente quando criados no sistema.
            </p>
            
            <p className="flex items-start gap-2">
              <FiRefreshCw className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
              A mudança de status do usuário atualiza automaticamente sua posição nas listas do SendPulse.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SendPulseManager;
