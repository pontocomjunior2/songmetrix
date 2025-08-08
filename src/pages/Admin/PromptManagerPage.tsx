import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, FileText, Zap, Loader2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'react-toastify';

// Serviços
import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api.ts';

// Componentes UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveDataTable, type ResponsiveColumn } from '@/components/ui/responsive-data-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PromptTemplate {
    id: string;
    name: string;
    content: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface PromptForm {
    name: string;
    content: string;
}

const PromptManagerPage: React.FC = () => {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isActivating, setIsActivating] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<PromptForm>({
        name: '',
        content: '',
    });

    // Carregar prompts na montagem do componente
    useEffect(() => {
        loadPrompts();
    }, []);

    const loadPrompts = async () => {
        try {
            setIsLoading(true);
            const data = await apiGet('/api/admin/prompts');
            setPrompts(data.prompts || []);
        } catch (error) {
            toast.error('Não foi possível carregar os templates de prompt');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (promptData: PromptForm) => {
        try {
            setIsSaving(true);

            if (editingPrompt) {
                await apiPut(`/api/admin/prompts/${editingPrompt.id}`, promptData);
                toast.success('Template atualizado com sucesso');
            } else {
                await apiPost('/api/admin/prompts', promptData);
                toast.success('Template criado com sucesso');
            }

            // Recarregar lista
            await loadPrompts();
            handleCloseModal();
        } catch (error) {
            toast.error('Não foi possível salvar o template de prompt');
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivate = async (promptId: string) => {
        try {
            setIsActivating(promptId);
            await apiPost(`/api/admin/prompts/${promptId}/activate`, {});
            toast.success('Template ativado com sucesso');

            // Recarregar lista
            await loadPrompts();
        } catch (error) {
            toast.error('Não foi possível ativar o template de prompt');
        } finally {
            setIsActivating(null);
        }
    };

    const handleDelete = async (prompt: PromptTemplate) => {
        if (!confirm(`Tem certeza que deseja excluir o template "${prompt.name}"?`)) {
            return;
        }

        try {
            setIsDeleting(prompt.id);
            await apiDelete(`/api/admin/prompts/${prompt.id}`);
            toast.success('Template excluído com sucesso');

            // Recarregar lista
            await loadPrompts();
        } catch (error) {
            toast.error('Não foi possível excluir o template de prompt');
        } finally {
            setIsDeleting(null);
        }
    };

    const handleOpenModal = (prompt?: PromptTemplate) => {
        if (prompt) {
            setEditingPrompt(prompt);
            setFormData({
                name: prompt.name,
                content: prompt.content,
            });
        } else {
            setEditingPrompt(null);
            setFormData({
                name: '',
                content: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingPrompt(null);
        setFormData({
            name: '',
            content: '',
        });
        setIsModalOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.content.trim()) {
            toast.error('Nome e conteúdo são obrigatórios');
            return;
        }
        handleSave(formData);
    };

    const truncateContent = (content: string, maxLength: number = 100) => {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString('pt-BR');
        } catch {
            return 'Data inválida';
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Carregando templates...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Gerenciador de Prompts da IA</h1>
                        <p className="text-muted-foreground">
                            Gerencie os templates de prompt usados para gerar insights de IA
                        </p>
                    </div>
                </div>

                <Button onClick={() => handleOpenModal()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Novo Prompt
                </Button>
            </div>

            {/* Info Alert */}
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    <strong>Importante!</strong> Use o placeholder{' '}
                    <code className="bg-gray-100 px-1 rounded">{'{{INSIGHT_DATA}}'}</code>{' '}
                    no conteúdo do prompt para injetar os dados do insight. Apenas um template pode estar ativo por vez.
                </AlertDescription>
            </Alert>

            {/* Main Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Templates de Prompt
                    </CardTitle>
                    <CardDescription>
                        Lista de templates disponíveis para geração de insights
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {prompts.length === 0 ? (
                        <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Nenhum template configurado</h3>
                            <p className="text-muted-foreground mb-4">
                                Crie seu primeiro template de prompt para começar a gerar insights personalizados.
                            </p>
                            <Button onClick={() => handleOpenModal()} variant="outline" className="gap-2">
                                <Plus className="h-4 w-4" />
                                Criar Primeiro Template
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: cards responsivos */}
                            <div className="sm:hidden">
                                <ResponsiveDataTable<PromptTemplate>
                                    data={prompts}
                                    getRowKey={(row) => row.id}
                                    emptyState={<div className="text-center py-8 text-muted-foreground">Nenhum template configurado</div>}
                                    columns={([
                                        { id: 'name', header: 'Nome', isPrimaryMobileField: true, accessorKey: 'name' },
                                        { id: 'status', header: 'Status', render: (r) => (
                                            <Badge variant={r.is_active ? 'default' : 'secondary'}>
                                                {r.is_active ? (<div className="flex items-center gap-1"><Zap className="h-3 w-3" /> Ativo</div>) : 'Inativo'}
                                            </Badge>
                                        ) },
                                        { id: 'content', header: 'Conteúdo', render: (r) => <span className="text-xs text-muted-foreground">{truncateContent(r.content)}</span> },
                                        { id: 'created', header: 'Criado Em', render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span> },
                                        { id: 'actions', header: 'Ações', render: (r) => (
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleActivate(r.id)} disabled={r.is_active || isActivating === r.id} className="gap-1">
                                                    {isActivating === r.id ? (<Loader2 className="h-3 w-3 animate-spin" />) : r.is_active ? (<Check className="h-3 w-3" />) : (<Zap className="h-3 w-3" />)}
                                                    {r.is_active ? 'Ativo' : 'Ativar'}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleOpenModal(r)} className="gap-1"><Edit className="h-3 w-3" />Editar</Button>
                                                <Button variant="outline" size="sm" onClick={() => handleDelete(r)} disabled={isDeleting === r.id} className="gap-1 text-red-600 hover:text-red-700">{isDeleting === r.id ? (<Loader2 className="h-3 w-3 animate-spin" />) : (<Trash2 className="h-3 w-3" />)}Excluir</Button>
                                            </div>
                                        ) },
                                    ] as ResponsiveColumn<PromptTemplate>[])}
                                />
                            </div>

                            {/* Desktop/Tablet: tabela original */}
                            <div className="hidden sm:block rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome do Template</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Conteúdo</TableHead>
                                            <TableHead>Criado Em</TableHead>
                                            <TableHead>Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {prompts.map((prompt) => (
                                            <TableRow key={prompt.id}>
                                                <TableCell>
                                                    <div className="font-medium">{prompt.name}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                                                        {prompt.is_active ? (<div className="flex items-center gap-1"><Zap className="h-3 w-3" /> Ativo</div>) : 'Inativo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-[300px] text-sm text-muted-foreground">{truncateContent(prompt.content)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground">{formatDate(prompt.created_at)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleActivate(prompt.id)} disabled={prompt.is_active || isActivating === prompt.id} className="gap-1">
                                                            {isActivating === prompt.id ? (<Loader2 className="h-3 w-3 animate-spin" />) : prompt.is_active ? (<Check className="h-3 w-3" />) : (<Zap className="h-3 w-3" />)}
                                                            {prompt.is_active ? 'Ativo' : 'Ativar'}
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(prompt)} className="gap-1"><Edit className="h-3 w-3" />Editar</Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleDelete(prompt)} disabled={isDeleting === prompt.id} className="gap-1 text-red-600 hover:text-red-700">{isDeleting === prompt.id ? (<Loader2 className="h-3 w-3 animate-spin" />) : (<Trash2 className="h-3 w-3" />)}Excluir</Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Modal para Criar/Editar Template */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPrompt ? 'Editar Template de Prompt' : 'Criar Novo Template de Prompt'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure o template que será usado para gerar insights de IA.
                            Use{' '}
                            <code className="bg-gray-100 px-1 rounded">{'{{INSIGHT_DATA}}'}</code>{' '}
                            para injetar os dados do insight.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do Template *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Template para Insights de Crescimento Musical"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="content">Conteúdo do Prompt *</Label>
                            <Textarea
                                id="content"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder={`Você é um especialista em marketing musical para rádios brasileiras.

Baseado nos dados de insight fornecidos: {{INSIGHT_DATA}}

Crie um e-mail profissional que:
- Destaque o crescimento da música
- Use dados específicos para credibilidade
- Tenha tom profissional mas acessível
- Inclua chamada para ação clara

Responda APENAS com um objeto JSON válido contendo:
- "subject": assunto do e-mail (máximo 60 caracteres)
- "body_html": corpo do e-mail em HTML`}
                                rows={15}
                                className="font-mono text-sm"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                💡 Dica: Use{' '}
                                <code className="bg-gray-100 px-1 rounded">{'{{INSIGHT_DATA}}'}</code>{' '}
                                onde você quer que os dados do insight sejam inseridos
                            </p>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving} className="gap-2">
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {editingPrompt ? 'Atualizar Template' : 'Criar Template'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PromptManagerPage;