'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, SubmitHandler, FieldValues } from 'react-hook-form';
import { z } from 'zod';
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from '../../ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../ui/form';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Calendar } from "../../ui/calendar";
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase-client';
import type { TablesInsert } from '../../../types/database.types.generated';

const notificationFormSchema = z.object({
  title: z.string().min(5, { message: 'O título deve ter pelo menos 5 caracteres.' }).max(100),
  message: z.union([
    z.string().length(0),
    z.string().min(10, { message: 'A mensagem deve ter pelo menos 10 caracteres.' }).max(500)
  ]).optional().nullable(),
  target_audience: z.enum(['all', 'specific_role', 'specific_user_ids'], {
    required_error: "Selecione o público-alvo.",
  }),
  target_details: z.string().optional().nullable(),
  scheduled_at: z.date().optional().nullable(),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

export default function NotificationForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      title: '',
      message: '',
      target_audience: 'all',
      target_details: '',
      scheduled_at: null,
    },
  });

  const targetAudience = form.watch('target_audience');

  React.useEffect(() => {
    if (targetAudience === 'all') {
      form.setValue('target_details', '');
    }
  }, [targetAudience, form]);

  const handleSubmit: SubmitHandler<NotificationFormValues> = async (values) => {
    setIsSubmitting(true);
    setError(null);

    const payload = {
      title: values.title,
      message: values.message,
      target_audience: values.target_audience,
      target_details: (form.getValues('target_audience') === 'specific_role' || form.getValues('target_audience') === 'specific_user_ids') && values.target_details
                        ? values.target_details
                        : null,
      scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
    };

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
          console.error("Erro ao obter sessão ou sessão inexistente:", sessionError);
          toast.error("Erro de autenticação. Faça login novamente.");
          setIsSubmitting(false);
          return;
      }
      console.log("Sessão ativa encontrada, token (início):", session.access_token.substring(0, 10));

      const { data, error: functionError } = await supabase.functions.invoke(
        'create-notification',
        {
          body: payload,
        }
      );

      if (functionError) {
        let errorMessage = 'Falha ao criar notificação.';
        if (functionError.context && functionError.context.json && functionError.context.json.error) {
            errorMessage = functionError.context.json.error;
            if (functionError.context.json.details) {
                errorMessage += `: ${JSON.stringify(functionError.context.json.details)}`;
            }
        } else {
            errorMessage = functionError.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      console.log("Resposta da função:", data);
      toast.success('Notificação criada com sucesso!');
      form.reset();

    } catch (err: any) {
      console.error("Erro ao invocar função 'create-notification':", err);
      setError(err.message || 'Falha ao criar notificação. Tente novamente.');
      toast.error(`Erro: ${err.message || 'Falha ao criar notificação.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Título da notificação" {...field} disabled={isSubmitting}/>
              </FormControl>
              <FormDescription>O título que será exibido.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensagem</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Digite a mensagem..."
                  className="resize-none"
                  rows={5}
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>O conteúdo principal.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="target_audience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Público-Alvo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione para quem enviar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="all">Todos os Usuários</SelectItem>
                  <SelectItem value="specific_role">Função Específica</SelectItem>
                  <SelectItem value="specific_user_ids">Usuários Específicos (IDs)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Quem receberá esta notificação.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {(targetAudience === 'specific_role' || targetAudience === 'specific_user_ids') && (
          <FormField
            control={form.control}
            name="target_details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {targetAudience === 'specific_role' ? 'Nome da Função' : 'IDs dos Usuários (separados por vírgula)'}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={targetAudience === 'specific_role' ? 'ex: manager' : 'ex: id1,id2,id3'}
                    {...field}
                    value={field.value ?? ''}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormDescription>
                  {targetAudience === 'specific_role'
                    ? 'Digite o nome da role que receberá.'
                    : 'Cole os UUIDs dos usuários separados por vírgula.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="scheduled_at"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Agendar Envio (Opcional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isSubmitting}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Escolha uma data</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ?? undefined}
                    onSelect={(date: Date | undefined) => field.onChange(date ?? null)}
                    initialFocus
                    disabled={isSubmitting}
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                Selecione uma data para enviar a notificação mais tarde. Deixe em branco para enviar imediatamente.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Criando...' : 'Criar Notificação'}
        </Button>
      </form>
    </Form>
  );
} 