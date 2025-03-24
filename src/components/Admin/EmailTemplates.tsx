import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase-client';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle, FiEye } from 'react-icons/fi';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState<EmailTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: ''
  });

  // Carregar templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Não foi possível carregar os templates de email');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      body: ''
    });
    setCurrentTemplate(null);
    setEditMode(false);
    setPreviewMode(false);
  };

  const handleCreateNew = () => {
    resetForm();
    setEditMode(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body
    });
    setEditMode(true);
    setPreviewMode(false);
  };

  const handlePreview = (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body
    });
    setPreviewMode(true);
    setEditMode(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleStatus = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ active: !template.active })
        .eq('id', template.id);

      if (error) throw error;
      fetchTemplates();
      toast.success(`Template ${!template.active ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Erro ao alterar status do template:', error);
      toast.error('Não foi possível alterar o status do template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      // Verificar se o template está sendo usado em alguma sequência
      const { data: usageData, error: usageError } = await supabase
        .from('email_sequences')
        .select('id')
        .eq('template_id', id);

      if (usageError) throw usageError;

      if (usageData && usageData.length > 0) {
        toast.error('Este template está sendo usado em uma ou mais sequências de email e não pode ser excluído.');
        return;
      }

      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTemplates();
      toast.success('Template excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error('Não foi possível excluir o template');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.subject || !formData.body) {
      toast.error('Todos os campos são obrigatórios');
      return;
    }

    try {
      if (currentTemplate) {
        // Atualizar template existente
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: formData.name,
            subject: formData.subject,
            body: formData.body,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentTemplate.id);

        if (error) throw error;
        toast.success('Template atualizado com sucesso');
      } else {
        // Criar novo template
        const { error } = await supabase
          .from('email_templates')
          .insert([{
            name: formData.name,
            subject: formData.subject,
            body: formData.body,
            active: true
          }]);

        if (error) throw error;
        toast.success('Template criado com sucesso');
      }

      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error('Não foi possível salvar o template');
    }
  };

  const renderTemplateList = () => {
    if (loading) return <div className="text-center py-4">Carregando...</div>;

    if (templates.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhum template encontrado</p>
          <button
            onClick={handleCreateNew}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center mx-auto"
          >
            <FiPlus className="mr-1" /> Criar Novo Template
          </button>
        </div>
      );
    }

    return (
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                Nome
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Assunto
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {templates.map((template) => (
              <tr key={template.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  {template.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {template.subject}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <span 
                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      template.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {template.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handlePreview(template)}
                      className="text-purple-600 hover:text-purple-900"
                      title="Visualizar"
                    >
                      <FiEye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Editar"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(template)}
                      className={template.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                      title={template.active ? 'Desativar' : 'Ativar'}
                    >
                      {template.active ? <FiXCircle size={16} /> : <FiCheckCircle size={16} />}
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderEditForm = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">
          {currentTemplate ? 'Editar Template' : 'Novo Template'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Template
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md"
              placeholder="Ex: Email de boas-vindas"
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Assunto do Email
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md"
              placeholder="Ex: Bem-vindo ao SongMetrix!"
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Conteúdo HTML
            </label>
            <textarea
              id="body"
              name="body"
              rows={10}
              value={formData.body}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md font-mono text-sm"
              placeholder="<h1>Olá {{name}},</h1><p>Bem-vindo ao SongMetrix!</p>"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use {'{{name}}'}, {'{{email}}'} e {'{{date}}'} como variáveis que serão substituídas automaticamente.
            </p>
          </div>
          
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderPreview = () => {
    if (!currentTemplate) return null;

    // Criar uma versão processada do template com dados de exemplo
    const processedBody = currentTemplate.body
      .replace(/{{name}}/g, 'Usuário Exemplo')
      .replace(/{{email}}/g, 'usuario@exemplo.com')
      .replace(/{{date}}/g, new Date().toLocaleDateString('pt-BR'));

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Visualizar Template</h2>
          <button
            onClick={resetForm}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
          >
            Fechar
          </button>
        </div>
        
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-500 mb-1">Nome:</div>
          <div className="font-semibold">{currentTemplate.name}</div>
        </div>
        
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-500 mb-1">Assunto:</div>
          <div className="font-semibold">{currentTemplate.subject}</div>
        </div>
        
        <div className="border p-4 rounded-md bg-gray-50">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Visualização do email (com dados de exemplo):
          </div>
          <div 
            className="p-4 border rounded-md bg-white"
            dangerouslySetInnerHTML={{ __html: processedBody }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Templates de Email</h1>
        {!editMode && !previewMode && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
          >
            <FiPlus className="mr-1" /> Novo Template
          </button>
        )}
      </div>

      {editMode && renderEditForm()}
      {previewMode && renderPreview()}
      {!editMode && !previewMode && renderTemplateList()}
    </div>
  );
}

export default EmailTemplates; 