import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { toast } from 'react-toastify';
import { FiSend, FiCheck, FiAlertTriangle, FiInfo } from 'react-icons/fi';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  active: boolean;
  created_at: string;
  body?: string;
};

function EmailTester() {
  const [email, setEmail] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Carregar templates disponíveis
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
      
      // Selecionar o template de boas-vindas por padrão
      const welcomeTemplate = data?.find(t => t.name === 'welcome_email' && t.active);
      if (welcomeTemplate) {
        setSelectedTemplateId(welcomeTemplate.id);
      } else if (data && data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Não foi possível carregar os templates de email');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Por favor, informe um email válido');
      return;
    }

    if (!selectedTemplateId && templates.length > 0) {
      toast.error('Por favor, selecione um template');
      return;
    }

    try {
      setSendingStatus('sending');
      setLoading(true);
      setResult(null);

      // Obter a sessão para acessar o token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      // Enviar solicitação para a API
      const response = await fetch('/api/email/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email,
          templateId: selectedTemplateId
        })
      });

      const data = await response.json();
      setResult(data);

      if (response.ok && data.success) {
        setSendingStatus('success');
        toast.success('Email de teste enviado com sucesso!');
      } else {
        setSendingStatus('error');
        toast.error(`Erro ao enviar email: ${data.message || 'Verifique os logs para mais detalhes'}`);
      }
    } catch (error) {
      console.error('Erro ao enviar email de teste:', error);
      setSendingStatus('error');
      toast.error('Erro ao enviar email de teste');
      setResult({ error: error instanceof Error ? error.message : 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = () => {
    if (sendingStatus === 'idle') return null;

    const statusInfo = {
      sending: {
        text: 'Enviando email...',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        icon: <FiInfo className="w-5 h-5 text-yellow-400" />
      },
      success: {
        text: 'Email enviado com sucesso!',
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: <FiCheck className="w-5 h-5 text-green-400" />
      },
      error: {
        text: 'Erro ao enviar email.',
        bgColor: 'bg-red-50',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: <FiAlertTriangle className="w-5 h-5 text-red-400" />
      }
    };

    const status = statusInfo[sendingStatus];

    return (
      <div className={`mt-4 p-4 ${status.bgColor} ${status.textColor} border ${status.borderColor} rounded-md`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">{status.icon}</div>
          <div className="ml-3">
            <h3 className="text-sm font-medium">{status.text}</h3>
            {result && (
              <div className="mt-2 text-sm">
                {sendingStatus === 'success' ? (
                  <p>ID da mensagem: {result.details?.messageId}</p>
                ) : (
                  <p>{result.error || 'Consulte os logs do servidor para mais detalhes.'}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Testar Envio de Email</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email de Destino
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Ex: usuario@exemplo.com"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-1">
              Template
            </label>
            {loadingTemplates ? (
              <div className="text-sm text-gray-500">Carregando templates...</div>
            ) : (
              <select
                id="templateId"
                name="templateId"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="">Selecione um template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.subject} {!template.active && '(Inativo)'}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="mt-6">
            <button
              type="submit"
              className={`px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
              disabled={loading}
            >
              <FiSend className="mr-2" /> {loading ? 'Enviando...' : 'Enviar Email de Teste'}
            </button>
          </div>
        </form>
        
        {renderStatus()}
        
        {result && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Detalhes Técnicos:</h3>
            <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="mt-6 p-4 bg-blue-50 text-blue-800 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium mb-2">Dicas para Diagnóstico:</h3>
          <ul className="list-disc pl-5 text-sm">
            <li className="mb-1">Verifique se o servidor está configurado com as credenciais SMTP corretas</li>
            <li className="mb-1">Certifique-se de que o serviço SMTP não está bloqueando conexões</li>
            <li className="mb-1">Em caso de problemas, consulte os logs do servidor para mensagens detalhadas</li>
            <li className="mb-1">Se estiver usando Gmail, verifique se está usando uma "Senha de App" e não a senha normal</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default EmailTester; 