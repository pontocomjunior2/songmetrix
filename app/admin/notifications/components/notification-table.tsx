'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Usando alias
import { Badge } from "@/components/ui/badge"; // Usando alias
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale'; // Para formatar datas em pt-BR
import type { Notification } from './notification-list'; // Importando tipo do componente pai

interface NotificationTableProps {
  notifications: Notification[];
}

// Função helper para formatar datas (pode ser movida para utils)
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch (error) {
    console.error("Erro ao formatar data:", dateString, error);
    return 'Data inválida';
  }
}

export default function NotificationTable({ notifications }: NotificationTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Público</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Agendada para</TableHead>
            <TableHead>Status</TableHead>
            {/* <TableHead>Ações</TableHead> */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell className="font-medium">{notification.title}</TableCell>
              <TableCell>{notification.target_audience}</TableCell>
              <TableCell>{formatDate(notification.created_at)}</TableCell>
              <TableCell>{formatDate(notification.scheduled_at)}</TableCell>
              <TableCell>
                <Badge variant={notification.sent_at ? "secondary" : "outline"}>
                  {notification.sent_at ? `Enviada ${formatDate(notification.sent_at)}` : (notification.scheduled_at ? 'Agendada' : 'Pendente')}
                </Badge>
              </TableCell>
              {/* <TableCell>Dropdown com ações (editar, deletar, reenviar?)</TableCell> */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 