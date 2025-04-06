'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Notification } from './notification-list';
import { supabase } from '../../../lib/supabase-client';
import { toast } from 'sonner';

interface NotificationTableProps {
  notifications: Notification[];
  onNotificationDeleted: (deletedId: string) => void;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch (error) {
    console.error("Erro ao formatar data:", dateString, error);
    return 'Data inválida';
  }
}

export default function NotificationTable({
  notifications,
  onNotificationDeleted,
}: NotificationTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (notificationId: string) => {
    if (deletingId) return;

    if (!window.confirm(`Tem certeza que deseja excluir a notificação ${notificationId}?`)) {
        return;
    }

    setDeletingId(notificationId);

    try {
      const { error } = await supabase.functions.invoke(
        'delete-notification',
        {
          method: 'DELETE',
          body: { id: notificationId }
        }
      );

      if (error) {
          let errorMessage = 'Falha ao excluir notificação.';
          if (error.context && error.context.json && error.context.json.error) {
              errorMessage = error.context.json.error;
          } else {
              errorMessage = error.message || errorMessage;
          }
          throw new Error(errorMessage);
      }

      toast.success("Notificação excluída com sucesso!");
      onNotificationDeleted(notificationId);

    } catch (err: any) {
        console.error("Erro ao excluir notificação:", err);
        toast.error(`Erro: ${err.message || 'Falha ao excluir notificação.'}`);
    } finally {
        setDeletingId(null);
    }
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Público</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Agendada para</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell className="font-medium py-3">{notification.title ?? '-'}</TableCell>
              <TableCell className="py-3">{notification.target_audience}</TableCell>
              <TableCell className="py-3">{formatDate(notification.created_at)}</TableCell>
              <TableCell className="py-3">{formatDate(notification.scheduled_at)}</TableCell>
              <TableCell className="py-3">
                <Badge 
                  variant={notification.sent_at 
                              ? "secondary"
                              : "default"
                          }
                  className="capitalize"
                >
                  {notification.sent_at 
                      ? `Enviada` 
                      : (notification.scheduled_at ? 'Agendada' : 'Pendente')
                  }
                </Badge>
              </TableCell>
              <TableCell className="text-right py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(notification.id)}
                  disabled={deletingId === notification.id}
                  aria-label="Excluir notificação"
                >
                  {deletingId === notification.id ? (
                    <span className="animate-spin h-4 w-4">...</span>
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 