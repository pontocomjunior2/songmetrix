'use server';

import { z } from 'zod';
import { createSafeActionClient } from 'next-safe-action';
import { createClient } from '../../utils/supabase/server'; // Supabase client para Server Components/Actions
import type { ActionResponse } from '@/types/actions';
import type { TablesInsert } from '@/types/database.types.generated'; // Tipos gerados do Supabase

// Esquema Zod para validação de entrada (deve corresponder ao formulário)
// Adicionando os campos que faltavam no formulário
const createNotificationSchema = z.object({
  title: z.string().min(5).max(100),
  message: z.string().min(10).max(500),
  target_audience: z.enum(['all', 'specific_role', 'specific_user_ids']).default('all'),
  target_details: z.any().optional(), // Pode ser string (role) ou array de UUIDs
  scheduled_at: z.string().datetime({ offset: true }).optional().nullable(), // Data/hora opcional como string ISO 8601
});

// Definindo um tipo mais específico para a resposta da action
type CreateNotificationResponse = ActionResponse<TablesInsert<'notifications'> | null>;

// Cliente Safe Action
const action = createSafeActionClient();

export const createNotification = action
  .schema(createNotificationSchema)
  .action(async ({ parsedInput }): Promise<CreateNotificationResponse> => {
    const supabase = createClient();

    // 1. Obter o ID do usuário logado (admin)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: { code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' } };
    }

    // 2. Verificar se o usuário é admin (usando a tabela admins)
    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminCheckError) {
        console.error('Erro ao verificar admin:', adminCheckError);
        return { success: false, error: { code: 'DB_ERROR', message: 'Erro ao verificar permissões de administrador.' } };
    }

    if (!adminCheck) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'Usuário não tem permissão para criar notificações.' } };
    }

    // 3. Preparar os dados para inserção
    const notificationData: TablesInsert<'notifications'> = {
      title: parsedInput.title,
      message: parsedInput.message,
      target_audience: parsedInput.target_audience,
      // TODO: Validar e formatar target_details dependendo do target_audience
      target_details: parsedInput.target_details ? JSON.stringify(parsedInput.target_details) : null,
      scheduled_at: parsedInput.scheduled_at ? parsedInput.scheduled_at : null,
      created_by: user.id, // ID do admin que está criando
    };

    // 4. Inserir no banco de dados
    const { data: newNotification, error: insertError } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir notificação:', insertError);
      // TODO: Mapear erros específicos do DB (ex: constraint violation) para mensagens melhores
      return { success: false, error: { code: 'DB_INSERT_ERROR', message: 'Falha ao salvar a notificação no banco de dados.' } };
    }

    // 5. Retornar sucesso
    return { success: true, data: newNotification };
  }); 