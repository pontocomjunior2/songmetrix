'use server';

import { z } from 'zod';
import { createSafeActionClient } from 'next-safe-action';
import { db } from '@/lib/db'; // Confirme o caminho para sua instância Drizzle/ORM
import { message_templates, users } from '@/lib/db/schema'; // Confirme o caminho para seus schemas Drizzle
import { eq } from 'drizzle-orm';
import { sendTextMessage } from '@/services/evolution-api';
import { AppError, appErrors } from '@/lib/errors';
import type { ActionResponse } from '@/types/actions';
import { revalidatePath } from 'next/cache';

// --- Suposições (Ajuste conforme necessário) ---
// 1. Instância Drizzle/ORM está em @/lib/db
// 2. Schemas Drizzle estão em @/lib/db/schema
// 3. Tabela `users` tem colunas `id` (uuid), `whatsapp` (text/string), `name` (text/string)
// 4. `next-safe-action`, `zod`, `drizzle-orm` estão instalados.
// 5. Os caminhos de importação (@/...) estão corretos no tsconfig.json
// 6. A autenticação de admin será adicionada posteriormente.

// Cliente Safe Action Básico
// O tratamento de erro principal é feito dentro de cada action com try/catch
// lançando AppError para erros esperados.
const action = createSafeActionClient();

//-----------------------------------------
// Schemas Zod (exportados para uso no frontend, se necessário)
//-----------------------------------------

export const MessageTemplateSchema = z.object({
    id: z.string().uuid().optional(), // Opcional para criação
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    content: z.string().min(5, 'Conteúdo deve ter pelo menos 5 caracteres'),
});

export const DeleteTemplateSchema = z.object({
    id: z.string().uuid('ID inválido'),
});

export const SendMessageSchema = z.object({
    userId: z.string().uuid('ID do usuário inválido'),
    templateId: z.string().uuid('ID do template inválido').optional(),
    customMessage: z.string().optional(),
}).refine(data => data.templateId || data.customMessage, {
    message: 'É necessário fornecer um ID de template ou uma mensagem customizada',
    path: ['templateId', 'customMessage'],
});

// Tipo inferido para uso no frontend
export type MessageTemplate = typeof message_templates.$inferSelect;

//-----------------------------------------
// Actions
//-----------------------------------------

/**
 * Busca todos os templates de mensagem.
 */
export const getMessageTemplates = action
    .action(async (): Promise<ActionResponse<MessageTemplate[]>> => {
        try {
            const templates = await db.select().from(message_templates).orderBy(message_templates.name);
            return { success: true, data: templates };
        } catch (error) {
            console.error("Erro ao buscar templates:", error);
            // Lança um AppError específico para ser tratado pelo hook no frontend
            throw appErrors.DATABASE_ERROR;
        }
    }
);

/**
 * Salva (cria ou atualiza) um template de mensagem.
 */
export const saveMessageTemplate = action
    .schema(MessageTemplateSchema) // Valida o input com o schema
    .action(async ({ parsedInput }): Promise<ActionResponse<MessageTemplate>> => {
        const data = parsedInput; // Input validado
        try {
            let savedTemplate: MessageTemplate[] | undefined;

            if (data.id) {
                // Atualiza
                savedTemplate = await db
                    .update(message_templates)
                    .set({ name: data.name, content: data.content, updated_at: new Date() })
                    .where(eq(message_templates.id, data.id))
                    .returning();
            } else {
                // Cria
                savedTemplate = await db
                    .insert(message_templates)
                    .values({ name: data.name, content: data.content })
                    .returning();
            }

            if (!savedTemplate || savedTemplate.length === 0) {
                 // Se não encontrou para atualizar ou falhou ao inserir
                 throw data.id ? appErrors.TEMPLATE_NOT_FOUND : appErrors.DATABASE_ERROR;
            }

            revalidatePath('/admin/messaging'); // Invalida o cache da página onde os templates são listados
            return { success: true, data: savedTemplate[0] };
        } catch (error: any) {
            // Re-lança AppErrors conhecidos para tratamento específico no frontend
            if (error instanceof AppError) throw error;
            // Trata erro específico de constraint (nome duplicado)
            if (error?.code === '23505') { // Código de erro do Postgres para unique violation
                throw new AppError('DUPLICATE_TEMPLATE_NAME', 'Já existe um template com este nome.');
            }
            // Loga o erro inesperado no servidor
            console.error("Erro inesperado ao salvar template:", error);
            // Lança um erro genérico de banco de dados para o frontend
            throw appErrors.DATABASE_ERROR;
        }
    }
);

/**
 * Exclui um template de mensagem.
 */
export const deleteMessageTemplate = action
    .schema(DeleteTemplateSchema) // Valida o input
    .action(async ({ parsedInput }): Promise<ActionResponse<{ id: string }>> => {
        const { id } = parsedInput; // ID validado
        try {
            const deleted = await db
                .delete(message_templates)
                .where(eq(message_templates.id, id))
                .returning({ id: message_templates.id });

            // Verifica se algum registro foi realmente deletado
            if (!deleted || deleted.length === 0) {
                throw appErrors.TEMPLATE_NOT_FOUND;
            }

            revalidatePath('/admin/messaging'); // Invalida o cache
            return { success: true, data: { id } };
        } catch (error) {
             // Re-lança AppErrors conhecidos
             if (error instanceof AppError) throw error;
             // Loga erros inesperados
             console.error("Erro inesperado ao excluir template:", error);
             // Lança erro genérico de banco de dados
             throw appErrors.DATABASE_ERROR;
        }
    }
);

/**
 * Envia uma mensagem para um usuário específico.
 */
export const sendMessageToUser = action
    .schema(SendMessageSchema) // Valida o input
    .action(async ({ parsedInput }): Promise<ActionResponse<{ messageId?: string }>> => {
        const data = parsedInput; // Input validado
        try {
            // 1. Buscar dados do usuário
            const userResult = await db
                .select({ whatsapp: users.whatsapp, name: users.name })
                .from(users)
                .where(eq(users.id, data.userId))
                .limit(1);
            const user = userResult[0];

            // Verifica se usuário existe e tem WhatsApp
            if (!user) throw appErrors.USER_NOT_FOUND;
            if (!user.whatsapp || user.whatsapp.trim() === '') throw appErrors.MISSING_WHATSAPP;

            let messageContent = data.customMessage;

            // 2. Buscar e formatar template (se ID fornecido)
            if (data.templateId) {
                const templateResult = await db
                    .select({ content: message_templates.content })
                    .from(message_templates)
                    .where(eq(message_templates.id, data.templateId))
                    .limit(1);
                const template = templateResult[0];

                if (!template) throw appErrors.TEMPLATE_NOT_FOUND;

                // Substitui placeholders (ex: {userName})
                messageContent = template.content.replace(/\{userName\}/g, user.name || 'usuário');
                // Adicione mais .replace() para outros placeholders se necessário
            }

            // 3. Validar conteúdo final da mensagem
            if (!messageContent || messageContent.trim() === '') {
                 throw new AppError('INVALID_MESSAGE', 'Conteúdo da mensagem está vazio ou inválido.');
            }

            // 4. Enviar mensagem via Evolution API
            const apiResponse = await sendTextMessage(user.whatsapp, messageContent);
            const messageId = (apiResponse as any)?.key?.id; // Tenta extrair o ID da resposta

            return { success: true, data: { messageId: messageId ?? 'ID não retornado pela API' } };

        } catch (error) {
            // Re-lança AppErrors para tratamento específico no frontend
            if (error instanceof AppError) throw error;

            // Loga erros inesperados
            console.error("Erro inesperado ao enviar mensagem para usuário:", error);
            // Lança um erro genérico para o frontend
            // Poderia ser mais específico se o erro vier da API, mas sendTextMessage já trata isso
            throw appErrors.UNEXPECTED_ERROR;
        }
    }
); 