import React, { Suspense } from 'react';
import { Heading } from '@/components/ui/heading'; // Assumindo que você tem um componente Heading
import NotificationForm from './components/notification-form';
import { Skeleton } from '@/components/ui/skeleton'; // Para o fallback do Suspense
import NotificationList from './components/notification-list'; // Importando a lista

export default function AdminNotificationsPage() {
  return (
    <div className="container mx-auto py-10">
      <Heading title="Gerenciar Notificações" description="Crie e gerencie notificações para os usuários." />

      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}> {/* Aumentei altura do fallback */}
          {/* Formulário para criar novas notificações */}
          <NotificationForm />
        </Suspense>
      </div>

      {/* Lista de notificações existentes */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Notificações Criadas</h2>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}> {/* Fallback para a lista */}
          <NotificationList />
        </Suspense>
      </div>
    </div>
  );
}

// Interfaces e Conteúdo Estático (se necessário, mas este componente é simples) 