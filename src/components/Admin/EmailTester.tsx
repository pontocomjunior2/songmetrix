import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiSend } from 'react-icons/fi';
import { supabase } from '../../lib/supabase-client';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  active: boolean;
  created_at: string;
};

function EmailTester() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [debug, setDebug] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Carregar templates
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('email_templates')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          setTemplates(data);
          // Selecionar o template de boas-vindas por padrão se existir
          const welcomeTemplate = data?.find((t: EmailTemplate) => t.name === 'welcome_email' && t.active);
          if (welcomeTemplate) {
            setSelectedTemplate(welcomeTemplate.id);
          } else if (data.length > 0) {
            setSelectedTemplate(data[0].id);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
        toast.error('Não foi possível carregar os templates de email');
      }
    };

    loadTemplates();
  }, []);

  const handleSendTestEmail = async () => {
    if (!email || !selectedTemplate) {
      toast.error('Por favor, informe um email e selecione um template', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setLoading(true);
    setDebug(''); // Limpar logs de debug
    
    try {
      toast.info('Enviando email de teste...', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      const debugLog = (message: string) => {
        console.log(message);
        setDebug(prev => prev + message + '\n');
      };
      
      debugLog('Obtendo sessão do Supabase...');
      const sessionData = await supabase.auth.getSession();
      const accessToken = sessionData.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      
      debugLog('Enviando requisição para servidor de email...');
      // Construindo URL para API
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3002/api/email/send-test'
        : '/api/email/send-test';
      
      debugLog(`URL da API: ${apiUrl}`);
      
      // Adicionar logs detalhados para depuração
      const reqBody = { email, templateId: selectedTemplate };
      debugLog(`Corpo da requisição: ${JSON.stringify(reqBody)}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(reqBody)
      });
      
      debugLog(`Resposta recebida: status ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        debugLog(`Erro no servidor: ${response.status}\n${errorText}`);
        throw new Error(`Erro no servidor: ${response.status}\n${errorText}`);
      }
      
      const data = await response.json();
      debugLog(`Dados da resposta: ${JSON.stringify(data)}`);
      
      if (data.success) {
        toast.success('Email de teste enviado com sucesso!', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        toast.error(`Erro ao enviar email: ${data.message || 'Verifique os logs para mais detalhes'}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    } catch (error) {
      console.error('Erro ao enviar email de teste:', error);
      
      let errorMessage = 'Erro ao enviar email de teste';
      if (error instanceof Error) {
        errorMessage = `Erro: ${error.message}`;
      }
      
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Testar Envio de Email</h2>
      
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Informe o email de destino"
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
          Template de Email
        </label>
        <select
          id="template"
          name="template"
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          {templates.length === 0 && (
            <option value="">Nenhum template disponível</option>
          )}
          
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name} - {template.subject}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mt-6">
        <button
          onClick={handleSendTestEmail}
          disabled={loading || !email || !selectedTemplate}
          className={`flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md transition-colors ${
            loading || !email || !selectedTemplate ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
          }`}
        >
          <FiSend className="mr-2" /> {loading ? 'Enviando...' : 'Enviar Email de Teste'}
        </button>
        
        <div className="mt-4 text-sm text-gray-500">
          <p className="mb-2">
            <strong>Nota:</strong> Este teste enviará um email real para o endereço informado.
          </p>
          <p>
            As variáveis do template serão substituídas por valores de teste.
          </p>
        </div>
        
        {/* Adicionar botão para mostrar/esconder informações de debug */}
        <div className="mt-4">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showDebug ? 'Esconder detalhes técnicos' : 'Mostrar detalhes técnicos'}
          </button>
          
          {showDebug && debug && (
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-60">
              <pre>{debug}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailTester; 