'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner'; // Usando sonner para notificações

import {
    MessageTemplate,
    MessageTemplateSchema,
    saveMessageTemplate,
    deleteMessageTemplate,
} from '@/actions/messaging'; // Ajuste o caminho se necessário

// Importações de UI (Shadcn) - Confirme os caminhos corretos
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Trash2, Edit, PlusCircle, Loader2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Interface para as props do componente cliente
interface MessageTemplatesClientProps {
    initialTemplates: MessageTemplate[];
    fetchError?: string; // Mensagem de erro opcional da busca inicial
}

// Tipo para o formulário, baseado no schema Zod
type TemplateFormData = z.infer<typeof MessageTemplateSchema>;

export function MessageTemplatesClient({ initialTemplates, fetchError }: MessageTemplatesClientProps) {
    const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
    const [isPending, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

    const form = useForm<TemplateFormData>({
        resolver: zodResolver(MessageTemplateSchema),
        defaultValues: {
            id: undefined,
            name: '',
            content: '',
        },
    });

    // Exibe erro inicial se houver
    // Usar useEffect para garantir que o toast só apareça uma vez no client-side
    useState(() => {
        if (fetchError) {
            toast.error(`Erro ao carregar templates: ${fetchError}`);
        }
    });

    const handleEdit = (template: MessageTemplate) => {
        setEditingTemplate(template);
        form.reset({
            id: template.id,
            name: template.name,
            content: template.content,
        });
        setIsDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingTemplate(null);
        form.reset({ id: undefined, name: '', content: '' }); // Limpa o formulário
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
                             ? prev.map((t) => (t.id === values.id ? result.data : t)) // Atualiza existente
                             : [...prev, result.data]; // Adiciona novo
                         // Ordena a lista após adicionar/atualizar
                         return newTemplates.sort((a, b) => a.name.localeCompare(b.name));
                     });
                     setIsDialogOpen(false); // Fecha o dialog após sucesso
                 } else {
                     // Erro vindo da action (AppError)
                     console.error("Erro ao salvar template:", result.error);
                     toast.error(`Falha ao salvar template: ${result.error.message}`);
                 }
            } catch (error) {
                 // Erro inesperado (não deveria acontecer com next-safe-action, mas por segurança)
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
                     toast.error(`Falha ao excluir template: ${result.error.message}`);
                 }
            } catch (error) {
                 console.error("Erro inesperado ao excluir:", error);
                 toast.error("Ocorreu um erro inesperado ao excluir o template.");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Botão para Adicionar Novo Template */} 
            <div className="flex justify-end">
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                     // Reseta o form ao fechar manualmente se não estiver submetendo
                     if (!open && !isPending) {
                         form.reset({ id: undefined, name: '', content: '' });
                         setEditingTemplate(null);
                     }
                     setIsDialogOpen(open);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAddNew} disabled={isPending}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[525px]">
                        <DialogHeader>
                            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Adicionar Novo Template'}</DialogTitle>
                            <DialogDescription>
                                Preencha os detalhes do template. Use {'{userName}'} para incluir o nome do usuário.
                            </DialogDescription>
                        </DialogHeader>
                        {/* Formulário */} 
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                                {/* Campo ID oculto (necessário para saber se é edição no submit) */} 
                                {editingTemplate && <input type="hidden" {...form.register('id')} />}

                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome do Template</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ex: Boas Vindas Cliente" {...field} disabled={isPending} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Conteúdo da Mensagem</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Olá {userName}, seja bem-vindo à nossa plataforma!"
                                                    {...field}
                                                    rows={5}
                                                    disabled={isPending}
                                                    className="resize-none" // Evita redimensionamento manual
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            {/* <p className="text-xs text-muted-foreground">
                                                Use {'{userName}'} para inserir o nome do usuário.
                                            </p> */}
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="pt-4"> {/* Adiciona espaçamento */} 
                                     <DialogClose asChild>
                                        <Button type="button" variant="outline" disabled={isPending}>
                                            Cancelar
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                                        {isPending ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Tabela de Templates */} 
            <div className="border rounded-lg overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[200px]">Nome</TableHead>
                            <TableHead>Conteúdo (Prévia)</TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates.length === 0 && !fetchError ? (
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
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(template)}
                                            disabled={isPending}
                                            aria-label="Editar"
                                            className="h-8 w-8"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>

                                        {/* Botão Excluir com Confirmação */} 
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                     variant="ghost"
                                                     size="icon"
                                                     disabled={isPending}
                                                     className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                     aria-label="Excluir"
                                                 >
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
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(template.id, template.name)}
                                                        disabled={isPending}
                                                        // className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        variant="destructive" // Usa a variante destructive do botão
                                                    >
                                                         {isPending ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                         ) : null}
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