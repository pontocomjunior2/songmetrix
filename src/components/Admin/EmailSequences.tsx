import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase-client';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle } from 'react-icons/fi';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
};

type EmailSequence = {
  id: string;
  name: string;
  template_id: string;
  days_after_signup: number;
  active: boolean;
  send_type: 'DAYS_AFTER_SIGNUP' | 'AFTER_FIRST_LOGIN';
  send_hour: number;
  created_at: string;
  updated_at: string;
  template?: EmailTemplate;
};

function EmailSequences() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSequence, setCurrentSequence] = useState<EmailSequence | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    template_id: '',
    days_after_signup: 1,
    send_type: 'DAYS_AFTER_SIGNUP' as 'DAYS_AFTER_SIGNUP' | 'AFTER_FIRST_LOGIN',
    send_hour: 8
  });

  // Carregar sequências e templates
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Carregar templates ativos
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('id, name, subject')
        .eq('active', true)
        .order('name');

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Carregar sequências
      const { data: sequencesData, error: sequencesError } = await supabase
        .from('email_sequences')
        .select(`
          *,
          template:template_id (
            id, name, subject
          )
        `)
        .order('days_after_signup');

      if (sequencesError) throw sequencesError;
      setSequences(sequencesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Não foi possível carregar as sequências de email');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      template_id: '',
      days_after_signup: 1,
      send_type: 'DAYS_AFTER_SIGNUP',
      send_hour: 8
    });
    setCurrentSequence(null);
    setEditMode(false);
  };

  const handleCreateNew = () => {
    resetForm();
    setEditMode(true);
  };

  const handleEdit = (sequence: EmailSequence) => {
    setCurrentSequence(sequence);
    setFormData({
      name: sequence.name,
      template_id: sequence.template_id,
      days_after_signup: sequence.days_after_signup,
      send_type: sequence.send_type || 'DAYS_AFTER_SIGNUP',
      send_hour: sequence.send_hour || 8
    });
    setEditMode(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'days_after_signup' || name === 'send_hour' ? parseInt(value) || 0 : value
    }));
  };

  const handleToggleStatus = async (sequence: EmailSequence) => {
    try {
      const { error } = await supabase
        .from('email_sequences')
        .update({ active: !sequence.active })
        .eq('id', sequence.id);

      if (error) throw error;
      fetchData();
      toast.success(`Sequência ${!sequence.active ? 'ativada' : 'desativada'} com sucesso`);
    } catch (error) {
      console.error('Erro ao alterar status da sequência:', error);
      toast.error('Não foi possível alterar o status da sequência');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta sequência?')) return;

    try {
      const { error } = await supabase
        .from('email_sequences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
      toast.success('Sequência excluída com sucesso');
    } catch (error) {
      console.error('Erro ao excluir sequência:', error);
      toast.error('Não foi possível excluir a sequência');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.template_id || formData.days_after_signup < 0) {
      toast.error('Todos os campos são obrigatórios e o número de dias deve ser positivo');
      return;
    }

    try {
      if (currentSequence) {
        // Atualizar sequência existente
        const { error } = await supabase
          .from('email_sequences')
          .update({
            name: formData.name,
            template_id: formData.template_id,
            days_after_signup: formData.days_after_signup,
            send_type: formData.send_type,
            send_hour: formData.send_hour,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSequence.id);

        if (error) throw error;
        toast.success('Sequência atualizada com sucesso');
      } else {
        // Criar nova sequência
        const { error } = await supabase
          .from('email_sequences')
          .insert([{
            name: formData.name,
            template_id: formData.template_id,
            days_after_signup: formData.days_after_signup,
            send_type: formData.send_type,
            send_hour: formData.send_hour,
            active: true
          }]);

        if (error) throw error;
        toast.success('Sequência criada com sucesso');
      }

      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar sequência:', error);
      toast.error('Não foi possível salvar a sequência');
    }
  };

  const renderSequenceList = () => {
    if (loading) return <div className="text-center py-4">Carregando...</div>;

    if (sequences.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhuma sequência encontrada</p>
          <button
            onClick={handleCreateNew}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center mx-auto"
          >
            <FiPlus className="mr-1" /> Criar Nova Sequência
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
                Template
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Tipo de Envio
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Agendamento
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
            {sequences.map((sequence) => (
              <tr key={sequence.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  {sequence.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {sequence.template?.name || 'Template não encontrado'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {sequence.send_type === 'AFTER_FIRST_LOGIN' ? 'Após Primeiro Login' : 'Dias Após Cadastro'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {sequence.send_type === 'AFTER_FIRST_LOGIN' 
                    ? 'Imediato'
                    : `${sequence.days_after_signup} ${sequence.days_after_signup === 1 ? 'dia' : 'dias'}`}
                  {sequence.send_hour !== undefined && sequence.send_type !== 'AFTER_FIRST_LOGIN' && 
                    ` às ${sequence.send_hour}:00h`}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <span 
                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      sequence.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {sequence.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(sequence)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Editar"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(sequence)}
                      className={sequence.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                      title={sequence.active ? 'Desativar' : 'Ativar'}
                    >
                      {sequence.active ? <FiXCircle size={16} /> : <FiCheckCircle size={16} />}
                    </button>
                    <button
                      onClick={() => handleDelete(sequence.id)}
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
          {currentSequence ? 'Editar Sequência' : 'Nova Sequência'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Sequência
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md"
              placeholder="Ex: Boas-vindas após 1 dia"
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="template_id" className="block text-sm font-medium text-gray-700 mb-1">
              Template de Email
            </label>
            <select
              id="template_id"
              name="template_id"
              value={formData.template_id}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Selecione um template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.subject}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="mt-1 text-sm text-red-500">
                Nenhum template ativo disponível. Crie um template antes de criar uma sequência.
              </p>
            )}
          </div>
          
          <div className="mb-4">
            <label htmlFor="send_type" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Envio
            </label>
            <select
              id="send_type"
              name="send_type"
              value={formData.send_type}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="DAYS_AFTER_SIGNUP">Dias após cadastro</option>
              <option value="AFTER_FIRST_LOGIN">Após primeiro login</option>
            </select>
          </div>
          
          {formData.send_type === 'DAYS_AFTER_SIGNUP' && (
            <div className="mb-4">
              <label htmlFor="days_after_signup" className="block text-sm font-medium text-gray-700 mb-1">
                Dias após o cadastro
              </label>
              <input
                type="number"
                min="0"
                id="days_after_signup"
                name="days_after_signup"
                value={formData.days_after_signup}
                onChange={handleInputChange}
                className="w-full p-2 border rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">
                Número de dias após o cadastro para enviar este email.
              </p>
            </div>
          )}
          
          {formData.send_type === 'DAYS_AFTER_SIGNUP' && (
            <div className="mb-4">
              <label htmlFor="send_hour" className="block text-sm font-medium text-gray-700 mb-1">
                Hora de envio
              </label>
              <input
                type="number"
                min="0"
                max="23"
                id="send_hour"
                name="send_hour"
                value={formData.send_hour}
                onChange={handleInputChange}
                className="w-full p-2 border rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">
                Hora do dia para enviar este email (0-23).
              </p>
            </div>
          )}
          
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
              disabled={templates.length === 0}
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sequências de Email</h1>
        {!editMode && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            disabled={templates.length === 0}
          >
            <FiPlus className="mr-1" /> Nova Sequência
          </button>
        )}
      </div>

      {editMode && renderEditForm()}
      {!editMode && renderSequenceList()}
    </div>
  );
}

export default EmailSequences; 