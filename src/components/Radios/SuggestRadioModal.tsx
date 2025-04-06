import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { PlusCircle, Radio, AlertTriangle } from 'lucide-react';
import { saveRadioSuggestion } from '../../services/radioSuggestionService';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../ui/alert';

// Lista de países mais comuns para o dropdown
const paises = [
  { value: "BR", label: "Brasil" },
  { value: "US", label: "Estados Unidos" },
  { value: "PT", label: "Portugal" },
  { value: "ES", label: "Espanha" },
  { value: "AR", label: "Argentina" },
  { value: "UY", label: "Uruguai" },
  { value: "PY", label: "Paraguai" },
  { value: "CL", label: "Chile" },
  { value: "CO", label: "Colômbia" },
  { value: "MX", label: "México" },
  { value: "CA", label: "Canadá" },
  { value: "IT", label: "Itália" },
  { value: "FR", label: "França" },
  { value: "UK", label: "Reino Unido" },
  { value: "DE", label: "Alemanha" },
  { value: "JP", label: "Japão" },
  { value: "AU", label: "Austrália" },
  { value: "OTHER", label: "Outro" }
];

// Estados do Brasil
const estadosBrasil = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" }
];

// Estados de alguns países selecionados
const estadosInternacionais = {
  US: [
    { value: "AL", label: "Alabama" },
    { value: "AK", label: "Alaska" },
    { value: "AZ", label: "Arizona" },
    { value: "CA", label: "California" },
    { value: "CO", label: "Colorado" },
    { value: "FL", label: "Florida" },
    { value: "NY", label: "New York" },
    { value: "TX", label: "Texas" },
    // Outros estados americanos aqui
    { value: "OTHER", label: "Outros" }
  ],
  PT: [
    { value: "LIS", label: "Lisboa" },
    { value: "POR", label: "Porto" },
    { value: "FAR", label: "Faro" },
    { value: "OTHER", label: "Outros" }
  ],
  // Adicione mais países conforme necessário
  OTHER: [
    { value: "OTHER", label: "Outro" }
  ]
};

interface FormValues {
  radio_name: string;
  city: string;
  country: string;
  state: string;
  stream_url: string;
  website: string;
}

interface SuggestRadioModalProps {
  buttonText?: string;
  buttonClassName?: string;
}

export default function SuggestRadioModal({ 
  buttonText = "Sugerir Rádio", 
  buttonClassName = "" 
}: SuggestRadioModalProps) {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<{message: string, details?: string} | null>(null);
  const [availableStates, setAvailableStates] = useState(estadosBrasil);
  
  const [formValues, setFormValues] = useState<FormValues>({
    radio_name: '',
    city: '',
    country: 'BR',
    state: '',
    stream_url: '',
    website: ''
  });

  const [formErrors, setFormErrors] = useState<Partial<FormValues>>({});

  // Atualizar a lista de estados quando o país mudar
  useEffect(() => {
    if (formValues.country === 'BR') {
      setAvailableStates(estadosBrasil);
    } else if (estadosInternacionais[formValues.country as keyof typeof estadosInternacionais]) {
      setAvailableStates(estadosInternacionais[formValues.country as keyof typeof estadosInternacionais]);
    } else {
      setAvailableStates([{ value: "OTHER", label: "Outro" }]);
    }
    
    // Limpar a seleção de estado ao trocar de país
    if (formValues.state && formValues.state !== 'OTHER') {
      setFormValues(prev => ({ ...prev, state: '' }));
    }
  }, [formValues.country]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
    
    // Limpar erro do campo quando o usuário digitar
    if (formErrors[name as keyof FormValues]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormValues];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<FormValues> = {};
    
    if (!formValues.radio_name.trim()) {
      errors.radio_name = 'Nome da rádio é obrigatório';
    }
    
    if (!formValues.city.trim()) {
      errors.city = 'Cidade é obrigatória';
    }
    
    if (!formValues.country) {
      errors.country = 'País é obrigatório';
    }
    
    if (!formValues.state) {
      errors.state = 'Estado é obrigatório';
    }
    
    if (!formValues.website.trim()) {
      errors.website = 'Site da rádio é obrigatório';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!currentUser) {
      setError({
        message: 'Você precisa estar logado para sugerir uma rádio',
        details: 'Faça login e tente novamente'
      });
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Preparar as informações adicionais incluindo o país
      const additionalInfo = {
        website: formValues.website,
        country: formValues.country
      };
      
      console.log('[SuggestRadioModal] Tentando salvar sugestão...');
      await saveRadioSuggestion({
        radio_name: formValues.radio_name,
        city: formValues.city,
        state: formValues.state,
        stream_url: formValues.stream_url,
        contact_email: currentUser.email || undefined,
        additional_info: JSON.stringify(additionalInfo)
      });
      
      // Buscar o nome do estado completo para a notificação
      // const estadoSelecionado = availableStates.find(s => s.value === formValues.state);
      // const nomeEstado = estadoSelecionado ? estadoSelecionado.label : formValues.state; // Fallback para o código se não encontrar
      
      // Remover chamada toast.success
      console.log('[SuggestRadioModal] Sugestão salva com sucesso.'); // Ajustar log
      // console.log('[SuggestRadioModal] Notificação disparada.'); // Remover log
      
      setIsSuccess(true);
      setFormValues({
        radio_name: '',
        city: '',
        country: 'BR',
        state: '',
        stream_url: '',
        website: ''
      });
    } catch (err: any) {
      console.error('[SuggestRadioModal] Erro ao enviar sugestão:', err);
      setError({
        message: err.message || 'Erro ao enviar sugestão',
        details: err.details || 'Tente novamente mais tarde'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setIsSuccess(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-10 px-4 py-2 ${buttonClassName}`}
        >
          <PlusCircle className="w-4 h-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        {!isSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Sugerir Nova Rádio</DialogTitle>
              <DialogDescription>
                Preencha os dados da rádio que você gostaria que fosse monitorada pelo SongMetrix.
                Nossa equipe irá analisar sua sugestão.
              </DialogDescription>
            </DialogHeader>
            
            {error && (
              <Alert className="bg-red-100 text-red-800 border-red-200 my-4">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <div>
                  <h4 className="font-medium">{error.message}</h4>
                  {error.details && <p className="text-sm mt-1">{error.details}</p>}
                </div>
              </Alert>
            )}
            
            <div className="text-sm text-gray-500 mb-4">
              <span className="text-red-500">*</span> Campos obrigatórios
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <label htmlFor="radio_name" className="block text-sm font-medium mb-1">
                  Nome da Rádio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="radio_name"
                  name="radio_name"
                  value={formValues.radio_name}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${
                    formErrors.radio_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {formErrors.radio_name && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.radio_name}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="country" className="block text-sm font-medium mb-1">
                  País <span className="text-red-500">*</span>
                </label>
                <select
                  id="country"
                  name="country"
                  value={formValues.country}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${
                    formErrors.country ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione o país...</option>
                  {paises.map(pais => (
                    <option key={pais.value} value={pais.value}>
                      {pais.label}
                    </option>
                  ))}
                </select>
                {formErrors.country && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.country}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium mb-1">
                    Cidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formValues.city}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded-md ${
                      formErrors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={isSubmitting}
                  />
                  {formErrors.city && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="state" className="block text-sm font-medium mb-1">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="state"
                    name="state"
                    value={formValues.state}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded-md ${
                      formErrors.state ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={isSubmitting}
                  >
                    <option value="">Selecione...</option>
                    {availableStates.map(estado => (
                      <option key={estado.value} value={estado.value}>
                        {estado.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.state && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="stream_url" className="block text-sm font-medium mb-1">
                  URL do Stream
                </label>
                <input
                  type="text"
                  id="stream_url"
                  name="stream_url"
                  value={formValues.stream_url}
                  onChange={handleChange}
                  placeholder="Ex: http://streaming.radio.com:8000/stream"
                  className={`w-full p-2 border rounded-md ${
                    formErrors.stream_url ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {formErrors.stream_url && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.stream_url}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="website" className="block text-sm font-medium mb-1">
                  Site da Rádio <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={formValues.website}
                  onChange={handleChange}
                  placeholder="Ex: https://www.radio.com.br"
                  className={`w-full p-2 border rounded-md ${
                    formErrors.website ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {formErrors.website && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.website}</p>
                )}
              </div>
              
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <span className="mr-2">Enviando...</span>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    </>
                  ) : (
                    'Enviar Sugestão'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-4">
              <h3 className="text-lg font-medium">Sugestão enviada com sucesso!</h3>
              <p className="mt-2">
                Obrigado pela sua sugestão. Nossa equipe irá analisar e entraremos em contato se necessário.
              </p>
            </div>
            <Button onClick={handleCloseSuccess} className="bg-indigo-600 hover:bg-indigo-700 text-white">OK</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 