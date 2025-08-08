'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import {
    MessageTemplate, // Verifique se este tipo está exportado de actions
    MessageTemplateSchema,
    saveMessageTemplate,
    deleteMessageTemplate,
    getMessageTemplates, // Importa a action para buscar dados
} from '@/actions/messaging'; // Confirme o caminho

// Importações de UI (Shadcn) - Confirme os caminhos
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDataTable, type ResponsiveColumn } from "@/components/ui/responsive-data-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash2, Edit, PlusCircle, Loader2, AlertCircle } from 'lucide-react'; // Adicionado AlertCircle
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton"; // Importa Skeleton

// Interface para as props (agora vazia ou omitida)
interface MessageTemplatesClientProps {
    // Não recebe mais props iniciais
}

// Tipo para o formulário
type TemplateFormData = z.infer<typeof MessageTemplateSchema>;

// Skeleton interno para loading inicial
function TemplatesLoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                 <Skeleton className="h-10 w-32" /> {/* Botão Adicionar */}
            </div>
            <div className="border rounded-lg overflow-hidden">
                 <Skeleton className="h-12 w-full bg-muted" /> {/* Header */}
                 <div className="divide-y">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                 </div>
            </div>
        </div>
    )
}

export function MessageTemplatesClient({}: MessageTemplatesClientProps) { // Props removidas
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

    const form = useForm<TemplateFormData>({
        resolver: zodResolver(MessageTemplateSchema),
        defaultValues: { id: undefined, name: '', content: '' },
    });

    // --- Busca de Dados Iniciais ---
    useEffect(() => {
        setIsLoadingInitial(true);
        setInitialLoadError(null);
        getMessageTemplates({}) // Chama a action
            .then(result => {
                if (result.success) {
                    setTemplates(result.data ?? []);
                } else {
                    console.error("Falha ao buscar templates iniciais:", result.error);
                    const errorMsg = result.error.message || "Erro desconhecido ao carregar templates.";
                    setInitialLoadError(errorMsg);
                    toast.error(`Erro ao carregar: ${errorMsg}`);
                }
            })
            .catch(err => {
                console.error("Erro inesperado na busca inicial:", err);
                const errorMsg = "Erro inesperado ao conectar com o servidor.";
                setInitialLoadError(errorMsg);
                toast.error(errorMsg);
            })
            .finally(() => {
                setIsLoadingInitial(false);
            });
    }, []); // Array de dependências vazio para rodar só na montagem

    // --- Handlers --- (sem alterações significativas, apenas confirmação)
    const handleEdit = (template: MessageTemplate) => {
        setEditingTemplate(template);
        form.reset({ id: template.id, name: template.name, content: template.content });
        setIsDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingTemplate(null);
        form.reset({ id: undefined, name: '', content: '' });
        setIsDialogOpen(true);
    };

    const onSubmit = (values: TemplateFormData) => {
        startTransition(async () => {
            try {
                 const result = await saveMessageTemplate(values);
                 if (result.success) {
                     toast.success(`Template "${result.data.name}" ${values.id ? 'atualizado' : 'criado'} com sucesso!`);
                     setTemplates((prev) => {
                         const newTemplates = values.id
                             ? prev.map((t) => (t.id === values.id ? result.data : t))
                             : [...prev, result.data];
                         return newTemplates.sort((a, b) => a.name.localeCompare(b.name));
                     });
                     setIsDialogOpen(false);
                 } else {
                     console.error("Erro ao salvar template:", result.error);
                     toast.error(`Falha ao salvar: ${result.error.message}`);
                 }
            } catch (error) {
                 console.error("Erro inesperado ao salvar:", error);
                 toast.error("Ocorreu um erro inesperado ao salvar o template.");
            }
        });
    };

    const handleDelete = (templateId: string, templateName: string) => {
        startTransition(async () => {
            try {
                 const result = await deleteMessageTemplate({ id: templateId });
                 if (result.success) {
                     toast.success(`Template "${templateName}" excluído com sucesso!`);
                     setTemplates((prev) => prev.filter((t) => t.id !== templateId));
                 } else {
                     console.error("Erro ao excluir template:", result.error);
                     toast.error(`Falha ao excluir: ${result.error.message}`);
                 }
            } catch (error) {
                 console.error("Erro inesperado ao excluir:", error);
                 toast.error("Ocorreu um erro inesperado ao excluir o template.");
            }
        });
    };

    // --- Renderização ---
    if (isLoadingInitial) {
        return <TemplatesLoadingSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Botão Adicionar e Dialog/Formulário */} 
            <div className="flex justify-end">
                 <Dialog open={isDialogOpen} onOpenChange={(open) => {
                     if (!open && !isPending) {
                         form.reset({ id: undefined, name: '', content: '' });
                         setEditingTemplate(null);
                     }
                     setIsDialogOpen(open);
                 }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddNew} disabled={isPending}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[525px]">
                        {/* ... Conteúdo do DialogHeader e Form ... */}
                         <DialogHeader>
                            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Adicionar Novo Template'}</DialogTitle>
                            <DialogDescription>
                                Preencha os detalhes do template. Use {'{userName}'} para incluir o nome do usuário.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                                {editingTemplate && <input type="hidden" {...form.register('id')} />}
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome do Template</FormLabel>
                                        <FormControl><Input placeholder="Ex: Boas Vindas Cliente" {...field} disabled={isPending} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="content" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Conteúdo da Mensagem</FormLabel>
                                        <FormControl><Textarea placeholder="Olá {userName}, ..." {...field} rows={5} disabled={isPending} className="resize-none" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <DialogFooter className="pt-4">
                                     <DialogClose asChild><Button type="button" variant="outline" disabled={isPending}>Cancelar</Button></DialogClose>
                                     <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                                         {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                         {editingTemplate ? 'Salvar' : 'Criar'}
                                     </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                 </Dialog>
            </div>

            {/* Mensagem de Erro de Carregamento Inicial */} 
            {initialLoadError && (
                <div className="flex items-center gap-x-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p>Não foi possível carregar os templates: {initialLoadError}</p>
                </div>
            )}

            {/* Lista Responsiva (Mobile) */} 
            <div className="sm:hidden border rounded-lg overflow-hidden shadow-sm">
                <ResponsiveDataTable<MessageTemplate>
                    data={templates}
                    getRowKey={(row) => row.id}
                    emptyState={<div className="text-center py-8 text-muted-foreground">Nenhum template cadastrado.</div>}
                    columns={([
                        { id: 'name', header: 'Nome', isPrimaryMobileField: true, accessorKey: 'name' },
                        { id: 'content', header: 'Conteúdo (Prévia)', render: (r) => <span className="text-xs text-muted-foreground">{r.content}</span> },
                        { id: 'actions', header: 'Ações', render: (r) => (
                            <div className="text-right space-x-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} disabled={isPending} aria-label="Editar" className="h-8 w-8">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isPending} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Excluir">
                                             <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Tem certeza que deseja excluir o template "<span className="font-semibold">{r.name}</span>"?
                                                Esta ação não pode ser desfeita.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(r.id, r.name)} disabled={isPending} variant="destructive">
                                                 {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Excluir
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ) },
                    ] as ResponsiveColumn<MessageTemplate>[])}
                />
            </div>

            {/* Tabela (Desktop/Tablet) */} 
            <div className="hidden sm:block border rounded-lg overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[200px]">Nome</TableHead>
                            <TableHead>Conteúdo (Prévia)</TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!initialLoadError && templates.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    Nenhum template cadastrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            templates.map((template) => (
                                <TableRow key={template.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium py-3">{template.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground py-3 truncate max-w-md lg:max-w-xl">
                                        {template.content}
                                    </TableCell>
                                    <TableCell className="text-right py-3 space-x-1">
                                        {/* Botão Editar */} 
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} disabled={isPending} aria-label="Editar" className="h-8 w-8">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        {/* Botão Excluir com Confirmação */} 
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isPending} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Excluir">
                                                     <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja excluir o template "<span className="font-semibold">{template.name}</span>"?
                                                        Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(template.id, template.name)} disabled={isPending} variant="destructive">
                                                         {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
} 