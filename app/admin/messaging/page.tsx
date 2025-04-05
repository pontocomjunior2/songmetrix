import { Suspense } from 'react';
import { getMessageTemplates } from '@/actions/messaging'; // Ajuste o caminho se necessário
import { MessageTemplatesClient } from './_components/message-templates-client';
// Confirme o caminho correto para Skeleton (pode ser @/components/ui/skeleton)
import { Skeleton } from "@/components/ui/skeleton";
// import { Skeleton } from '@repo/ui/components/ui/skeleton'; // Use seu alias @repo/ui

// Componente Server para buscar dados iniciais
async function MessageTemplatesData() {
    // Idealmente, adicionar tratamento de erro aqui se getMessageTemplates pudesse falhar
    // ou passar o erro para o componente cliente tratar.
    const result = await getMessageTemplates({}); // Chama a action para buscar os templates

    if (!result.success) {
         console.error("Falha ao buscar templates:", result.error);
         // Passa o erro para o cliente para exibição
         return <MessageTemplatesClient initialTemplates={[]} fetchError={result.error.message} />;
    }

    return <MessageTemplatesClient initialTemplates={result.data ?? []} />;
}

export default function AdminMessagingPage() {
    return (
        // Use classes Tailwind para layout e espaçamento
        <div className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-6">Gerenciar Templates de Mensagem</h1>
            <Suspense fallback={<TemplatesSkeleton />}>
                 <MessageTemplatesData />
            </Suspense>
        </div>
    );
}

// Skeleton para feedback de carregamento
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