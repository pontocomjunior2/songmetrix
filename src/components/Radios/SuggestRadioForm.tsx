import React, { useState } from 'react';
import { PlusCircle, Radio, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
import { saveRadioSuggestion } from '../../services/radioSuggestionService';

// Schema de validação usando Zod
const suggestRadioSchema = z.object({
  radioName: z.string().min(3, { message: 'Nome da rádio deve ter pelo menos 3 caracteres' }),
  streamUrl: z.string().url({ message: 'URL do stream inválida' }).optional().or(z.literal('')),
  city: z.string().min(2, { message: 'Cidade deve ter pelo menos 2 caracteres' }),
  state: z.string().min(2, { message: 'Estado deve ter pelo menos 2 caracteres' }),
  contactEmail: z.string().email({ message: 'Email inválido' }).optional().or(z.literal('')),
  additionalInfo: z.string().optional(),
});

type SuggestRadioFormData = z.infer<typeof suggestRadioSchema>;

function SuggestRadioForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedRadio, setSubmittedRadio] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuggestRadioFormData>({
    resolver: zodResolver(suggestRadioSchema),
    defaultValues: {
      radioName: '',
      streamUrl: '',
      city: '',
      state: '',
      contactEmail: '',
      additionalInfo: '',
    },
  });

  const onSubmit = async (data: SuggestRadioFormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // Converter os dados para o formato esperado pelo serviço
      await saveRadioSuggestion({
        radio_name: data.radioName,
        stream_url: data.streamUrl,
        city: data.city,
        state: data.state,
        contact_email: data.contactEmail,
        additional_info: data.additionalInfo
      });
      
      setSubmitStatus('success');
      setSubmittedRadio(data.radioName);
      reset();
      
      // Não fecha o modal automaticamente, esperando o usuário clicar em OK
    } catch (error) {
      console.error('Erro ao enviar sugestão:', error);
      setSubmitStatus('error');
      
      if (error instanceof Error) {
        const appError = error as any; // Usando any para acessar a propriedade details
        if (appError.details && appError.message === 'Tabela de sugestões não configurada') {
          setErrorMessage(`${appError.message}: ${appError.details}. Por favor, informe ao administrador do sistema.`);
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage('Ocorreu um erro ao enviar sua sugestão. Tente novamente mais tarde.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form when dialog is closed
      reset();
      setSubmitStatus('idle');
      setErrorMessage('');
      setSubmittedRadio('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="default"
          className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Sugerir Rádio</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {submitStatus === 'success' ? (
          <div className="py-6 flex flex-col items-center text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Sugestão Enviada com Sucesso!</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Sua sugestão para a rádio <strong>{submittedRadio}</strong> foi recebida e será analisada pela nossa equipe. Agradecemos sua contribuição para o crescimento da plataforma!
            </p>
            <Button 
              onClick={() => setIsOpen(false)}
              className="bg-green-600 hover:bg-green-700 text-white px-10 py-2 rounded-md font-medium transition-colors"
            >
              OK
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5" /> 
                Sugerir uma Rádio
              </DialogTitle>
              <DialogDescription>
                Preencha as informações abaixo para sugerir uma rádio para monitoramento.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="radioName">Nome da Rádio *</Label>
                <Input 
                  id="radioName" 
                  placeholder="Ex: Rádio FM 98.5" 
                  {...register('radioName')} 
                  className={errors.radioName ? 'border-red-500' : ''}
                />
                {errors.radioName && (
                  <p className="text-red-500 text-xs mt-1">{errors.radioName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="streamUrl">URL do Stream (se disponível)</Label>
                <Input 
                  id="streamUrl" 
                  placeholder="https://stream.exemplo.com.br/radio" 
                  {...register('streamUrl')} 
                  className={errors.streamUrl ? 'border-red-500' : ''}
                />
                {errors.streamUrl && (
                  <p className="text-red-500 text-xs mt-1">{errors.streamUrl.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade *</Label>
                  <Input 
                    id="city" 
                    placeholder="São Paulo" 
                    {...register('city')} 
                    className={errors.city ? 'border-red-500' : ''}
                  />
                  {errors.city && (
                    <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado *</Label>
                  <Input 
                    id="state" 
                    placeholder="SP" 
                    {...register('state')} 
                    className={errors.state ? 'border-red-500' : ''}
                  />
                  {errors.state && (
                    <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Seu Email (opcional)</Label>
                <Input 
                  id="contactEmail" 
                  placeholder="seu@email.com" 
                  {...register('contactEmail')} 
                  className={errors.contactEmail ? 'border-red-500' : ''}
                />
                {errors.contactEmail && (
                  <p className="text-red-500 text-xs mt-1">{errors.contactEmail.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalInfo">Informações Adicionais (opcional)</Label>
                <textarea 
                  id="additionalInfo"
                  rows={3}
                  placeholder="Compartilhe mais detalhes sobre a rádio..." 
                  {...register('additionalInfo')} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {submitStatus === 'error' && (
                <Alert className="bg-red-100 text-red-800 border-red-200">
                  {errorMessage}
                </Alert>
              )}

              <DialogFooter>
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Sugestão'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SuggestRadioForm; 