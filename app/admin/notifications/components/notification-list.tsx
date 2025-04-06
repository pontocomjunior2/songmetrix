import React from 'react';
import { createClient } from '../../../utils/supabase/server'; // Cliente Supabase para Server Components
import NotificationTable from './notification-table'; // Componente para renderizar a tabela (será criado)
import type { Tables } from '@/types/database.types.generated';

// Definindo tipo para as notificações que vamos buscar
export type Notification = Pick<
  Tables<'notifications'>,
  'id' | 'title' | 'target_audience' | 'created_at' | 'scheduled_at' | 'sent_at'
>;

async function NotificationList(): Promise<JSX.Element> {
  const supabase = createClient();

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, title, target_audience, created_at, scheduled_at, sent_at')
    .order('created_at', { ascending: false })
    // Adicionar paginação no futuro, se necessário
    // .range(0, 10)

  if (error) {
    console.error("Erro ao buscar notificações:", error);
    // Renderizar uma mensagem de erro ou um estado vazio mais robusto
    return <p className="text-red-500">Não foi possível carregar as notificações.</p>;
  }

  if (!notifications || notifications.length === 0) {
    return <p className="text-muted-foreground">Nenhuma notificação encontrada.</p>;
  }

  // Passa os dados para o componente de tabela
  return <NotificationTable notifications={notifications} />;
}

export default NotificationList; 