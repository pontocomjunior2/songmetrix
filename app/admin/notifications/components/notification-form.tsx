'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from "date-fns"; // Para formatar a data no botão
import { Calendar as CalendarIcon } from "lucide-react"; // Ícone para o DatePicker
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Para DatePicker
import { Calendar } from "@/components/ui/calendar"; // Para DatePicker
import { cn } from "@/lib/utils"; // Helper para classnames (comum com shadcn/ui)
import { useActionState } from 'react';
import { createNotification } from '../../actions/notification-actions';
import type { ActionResponse } from '@/types/actions';
import { toast } from 'sonner';
import type { TablesInsert } from '@/types/database.types.generated';

// Esquema de validação com Zod atualizado
const notificationFormSchema = z.object({
  title: z.string().min(5, { message: 'O título deve ter pelo menos 5 caracteres.' }).max(100),
  message: z.string().min(10, { message: 'A mensagem deve ter pelo menos 10 caracteres.' }).max(500),
  target_audience: z.enum(['all', 'specific_role', 'specific_user_ids'], {
    required_error: "Selecione o público-alvo.",
  }).default('all'),
  // Simplificado por enquanto: aceita uma string opcional.
  // TODO: Adicionar validação mais robusta baseada no target_audience (ex: refinar para array de UUIDs ou nome de role)
  target_details: z.string().optional().nullable(),
  // Aceita um objeto Date opcional
  scheduled_at: z.date().optional().nullable(),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

// Estado inicial atualizado para a action real
const initialState: ActionResponse<TablesInsert<'notifications'> | null> = {
  success: false,
  error: null,
  data: null,
};

export default function NotificationForm() {
  const [state, formAction, isPending] = useActionState(createNotification, initialState);

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      title: '',
      message: '',
      target_audience: 'all',
      target_details: '', // Valor inicial
      scheduled_at: null, // Valor inicial
    },
    context: state,
  });

  // Observar a mudança no campo target_audience
  const targetAudience = form.watch('target_audience');

  React.useEffect(() => {
    // Limpar target_details se o público voltar a ser 'all'
    if (targetAudience === 'all') {
      form.setValue('target_details', '');
    }
  }, [targetAudience, form]);

  React.useEffect(() => {
    if (state.success === true) {
      toast.success('Notificação criada com sucesso!');
      form.reset();
    } else if (state.success === false && state.error) {
      toast.error(`Erro ao criar notificação: ${state.error.message}`);
    }
  }, [state, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => {
          const values = form.getValues();
          // Converter data para string ISO antes de enviar para a action, se existir
          const payload = {
            ...values,
            scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
            // Assegurar que target_details é null se for vazio e o público for específico
            target_details: (targetAudience === 'specific_role' || targetAudience === 'specific_user_ids') && values.target_details
                                ? values.target_details
                                : null,
          };
          formAction(payload as any); // Cast para any pois a action espera string para data
        })}
        className="space-y-8"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Título da notificação" {...field} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        {/* Campo Target Details (Condicional) */}
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
                    // Garantir que o valor seja string ou vazio, não null
                    value={field.value ?? ''} 
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

        {/* Campo Scheduled At (DatePicker) */}
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
                    >
                      {field.value ? (
                        format(field.value, "PPP") // Formato ex: Jun 1, 2024
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
                    selected={field.value ?? undefined} // Passa undefined se null
                    onSelect={(date) => field.onChange(date ?? null)} // Garante que volte null
                    // disabled={(date) => date < new Date() } // Descomentar para desabilitar datas passadas
                    initialFocus
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

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Criando...' : 'Criar Notificação'}
        </Button>
      </form>
    </Form>
  );
} 