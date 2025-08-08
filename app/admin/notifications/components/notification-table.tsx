'use client';

import React from 'react';
import { Badge } from "@/components/ui/badge"; // Usando alias
import { ResponsiveDataTable, type ResponsiveColumn } from "@/components/ui/responsive-data-table";
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
  const columns: ResponsiveColumn<Notification>[] = [
    {
      id: "title",
      header: "Título",
      accessorKey: "title",
      className: "font-medium",
      isPrimaryMobileField: true,
    },
    {
      id: "audience",
      header: "Público",
      accessorKey: "target_audience",
    },
    {
      id: "created",
      header: "Criada em",
      render: (row) => formatDate(row.created_at),
      hideOnMobile: true,
    },
    {
      id: "scheduled",
      header: "Agendada para",
      render: (row) => formatDate(row.scheduled_at),
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.sent_at ? "secondary" : "outline"}>
          {row.sent_at ? `Enviada ${formatDate(row.sent_at)}` : (row.scheduled_at ? 'Agendada' : 'Pendente')}
        </Badge>
      ),
    },
  ];

  return (
    <ResponsiveDataTable
      data={notifications}
      columns={columns}
      getRowKey={(row) => row.id}
      tableClassName="min-w-full"
    />
  );
}