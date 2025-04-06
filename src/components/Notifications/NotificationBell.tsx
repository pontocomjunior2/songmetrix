import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { supabase } from '../../lib/supabase-client';
import type { Tables } from '../../types/database.types.generated';
import { useAuth } from '../../contexts/AuthContext';

interface Notification {
  id: string;
  title: string | null;
  message: string;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  target_audience: string;
  is_read: boolean;
}

function mapSupabaseNotification(dbNotification: Tables<'notifications'>): Notification {
    return {
        id: dbNotification.id,
        title: dbNotification.title,
        message: dbNotification.message,
        created_at: dbNotification.created_at,
        scheduled_at: dbNotification.scheduled_at,
        sent_at: dbNotification.sent_at,
        target_audience: dbNotification.target_audience,
        is_read: dbNotification.is_read,
    };
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    console.log("[NotificationBell] Buscando notificações...");

    const { data, error: dbError } = await supabase
      .from('notifications')
      .select('*')
      .eq('target_audience', 'all')
      .order('created_at', { ascending: false })
      .limit(20);

    if (dbError) {
      console.error("[NotificationBell] Erro ao buscar notificações:", dbError);
      setError("Erro ao carregar notificações.");
      setNotifications([]);
    } else if (data) {
      console.log("[NotificationBell] Notificações recebidas:", data.length);
      const mappedData = data.map(mapSupabaseNotification);
      setNotifications(mappedData);
      setUnreadCount(mappedData.filter(n => !n.is_read).length);
    } else {
      setNotifications([]);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();

      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            console.log("[NotificationBell] Nova notificação recebida via Realtime:", payload.new);
            if (payload.new.target_audience === 'all') {
                const newNotification = mapSupabaseNotification(payload.new as Tables<'notifications'>);
                setNotifications((prev) => [newNotification, ...prev]);
                if (!newNotification.is_read) {
                    setUnreadCount((prev) => prev + 1);
                }
            }
          }
        )
        .subscribe();

      console.log("[NotificationBell] Subscrito ao canal Realtime 'public:notifications'.");

      return () => {
        console.log("[NotificationBell] Desinscrevendo do canal Realtime.");
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser, fetchNotifications]);

  const markAsRead = useCallback(async () => {
    if (!currentUser || unreadCount === 0) return;
    
    console.log("[NotificationBell] Marcando notificações como lidas (TODO: API Call)...");
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
    setUnreadCount(0);

  }, [currentUser, notifications, unreadCount]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      markAsRead(); 
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 block h-2.5 w-2.5 transform translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 mr-4 mt-2 p-0">
        <div className="p-4">
          <h4 className="text-sm font-medium leading-none">Notificações</h4>
        </div>
        <Separator />
        {loading ? (
            <p className="p-4 text-sm text-center text-gray-500">Carregando...</p>
        ) : error ? (
            <p className="p-4 text-sm text-center text-red-500">{error}</p>
        ) : notifications.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  !notification.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {notification.title && <p className="mb-0.5 font-medium">{notification.title}</p>}
                <p className="mb-1">{notification.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(notification.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-center text-gray-500">Nenhuma notificação nova.</p>
        )}
         <Separator />
         <div className="p-2 text-center">
           <Button variant="link" size="sm" className="text-xs">
             Ver todas as notificações {/* TODO: Link para página de notificações se houver */}
           </Button>
         </div>
      </PopoverContent>
    </Popover>
  );
} 