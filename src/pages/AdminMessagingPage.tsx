import { Suspense } from 'react';
// Ajuste o caminho se o client for movido para outro local
import { MessageTemplatesClient } from '@/components/admin/messaging/message-templates-client';
import { Skeleton } from "@/components/ui/skeleton"; // Confirme o caminho correto para Skeleton

// Skeleton (movido para cá ou importado de um local compartilhado)
function TemplatesSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                 <Skeleton className="h-10 w-32" /> {/* Botão Adicionar */}
            </div>
            <div className="border rounded-lg overflow-hidden">
                 {/* Skeleton da Tabela Header */}
                 <Skeleton className="h-12 w-full bg-muted" />
                 {/* Skeleton das Linhas da Tabela */}
                 <div className="divide-y">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                 </div>
            </div>
        </div>
    )
}

// Componente principal da página
export default function AdminMessagingPage() {
    return (
        // Use classes Tailwind para layout e espaçamento
        <div className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-6">Gerenciar Templates de Mensagem</h1>
            {/* Suspense pode envolver o Client se ele tiver partes assíncronas internamente */}
            <Suspense fallback={<TemplatesSkeleton />}>
                {/* O Client agora é responsável por buscar seus próprios dados */}
                 <MessageTemplatesClient />
            </Suspense>
        </div>
    );
} 