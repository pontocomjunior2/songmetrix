import React, { useState, useEffect } from 'react';
// import { createClient } from '../../../utils/supabase/server'; // REMOVIDO - Usaremos cliente client-side
import { supabase } from '../../../lib/supabase-client'; // Corrigido
import NotificationTable from './notification-table';
import type { Tables } from '../../../types/database.types.generated'; // Corrigido
// import { Skeleton } from '../ui/skeleton'; // REMOVIDO
import { toast } from 'sonner'; // Usar sonner

// Tipo Notification (sem alterações)
export type Notification = Pick<
  Tables<'notifications'>,
  'id' | 'title' | 'target_audience' | 'created_at' | 'scheduled_at' | 'sent_at'
>;

// REMOVIDO async
function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('notifications')
        .select('id, title, target_audience, created_at, scheduled_at, sent_at')
        .order('created_at', { ascending: false });
        // TODO: Adicionar paginação?

      if (dbError) {
        console.error("Erro ao buscar notificações:", dbError);
        setError('Não foi possível carregar as notificações.');
      } else {
        setNotifications(data || []);
      }
      setLoading(false);
    };

    fetchNotifications();

    // TODO: Adicionar Supabase Realtime para atualizações?
    // const channel = supabase.channel('public:notifications')...
    // return () => { supabase.removeChannel(channel); };

  }, []); // Executa apenas na montagem

  // Callback para remover notificação do estado local
  const handleNotificationDeleted = (deletedId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== deletedId));
    toast.info("Notificação removida da lista."); // Feedback adicional
  };

  if (loading) {
    // Usando texto como fallback
    return <div>Carregando notificações...</div>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (notifications.length === 0) {
    return <p className="text-muted-foreground">Nenhuma notificação encontrada.</p>;
  }

  // Passar o callback para NotificationTable
  return <NotificationTable 
            notifications={notifications} 
            onNotificationDeleted={handleNotificationDeleted} 
         />;
}

export default NotificationList; 