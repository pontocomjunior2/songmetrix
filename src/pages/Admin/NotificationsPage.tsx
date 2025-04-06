import React, { Suspense } from 'react';
// import { Heading } from '@/components/ui/heading'; // Assumindo alias @/ -> src/
// Usando caminho relativo CORRETO
// import Heading from '../../components/ui/heading'; // REMOVIDO - Arquivo não existe
import NotificationForm from '../../components/Admin/Notifications/notification-form'; // Corrigido
// import { Skeleton } from '@/components/ui/skeleton';
// import Skeleton from '../../components/ui/skeleton'; // REMOVIDO
import NotificationList from '../../components/Admin/Notifications/notification-list'; // Corrigido
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"; // Importar componentes Card

export default function NotificationsPage() { // Renomeado para clareza
  return (
    <div className="pt-6 space-y-10"> {/* Adicionando padding superior e aumentando espaço entre cards */}
      {/* Card para Criar Nova Notificação */}
      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Notificação</CardTitle>
          <CardDescription>
            Preencha os detalhes abaixo para enviar uma nova notificação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="pt-4">
            <Suspense fallback={<div>Carregando formulário...</div>}>
              <NotificationForm />
            </Suspense>
          </div>
        </CardContent>
      </Card>

      {/* Card para Notificações Criadas */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações Criadas</CardTitle>
          <CardDescription>
            Lista das notificações já criadas ou agendadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="pt-4">
            <Suspense fallback={<div>Carregando notificações...</div>}>
              <NotificationList />
            </Suspense>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 