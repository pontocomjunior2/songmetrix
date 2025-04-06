-- Migration: Create notifications table and related objects

-- Tabela para armazenar notificações
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_audience TEXT NOT NULL DEFAULT 'all', -- 'all', 'specific_role', 'specific_user_ids'
    target_details JSONB,                      -- Armazena IDs de usuários ou roles específicos, se target_audience != 'all'
    scheduled_at TIMESTAMPTZ,                   -- NULL se for para enviar imediatamente
    sent_at TIMESTAMPTZ,                       -- NULL se ainda não foi enviada
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)  -- Quem criou a notificação (admin)
);

-- Índices para otimizar consultas comuns
CREATE INDEX idx_notifications_scheduled_at ON public.notifications(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX idx_notifications_target_audience ON public.notifications(target_audience);

-- Comentários para documentar as colunas
COMMENT ON TABLE public.notifications IS 'Stores notifications to be sent to users.';
COMMENT ON COLUMN public.notifications.target_audience IS 'Defines who should receive the notification (e.g., ''all'', ''specific_role'', ''specific_user_ids'').';
COMMENT ON COLUMN public.notifications.target_details IS 'Additional details for the target audience (e.g., array of user IDs or role name).';
COMMENT ON COLUMN public.notifications.scheduled_at IS 'Timestamp when the notification should be sent. NULL for immediate sending.';
COMMENT ON COLUMN public.notifications.sent_at IS 'Timestamp when the notification was actually sent.';
COMMENT ON COLUMN public.notifications.created_by IS 'ID of the admin user who created the notification.';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Conceder permissões básicas para roles padrão (ajustar conforme necessário)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.notifications TO anon; -- Ou remover se anônimos não devem ver nenhuma notificação

-- Política de RLS: Admins podem fazer tudo
-- Verifica se o ID do usuário autenticado existe na tabela `public.admins`.
CREATE POLICY "Allow admins full access"
    ON public.notifications
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    ));

-- Política de RLS: Usuários autenticados podem ler notificações destinadas a eles.
-- Esta é uma política básica e precisa ser expandida para cobrir 'specific_role' e 'specific_user_ids'.
CREATE POLICY "Allow authenticated users to read their notifications"
    ON public.notifications
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND (
            target_audience = 'all'
            -- TODO: Adicionar lógica para verificar 'specific_role' (ex: `target_audience = 'specific_role' AND target_details->>'role' = get_user_role(auth.uid())`)
            -- TODO: Adicionar lógica para verificar 'specific_user_ids' (ex: `target_audience = 'specific_user_ids' AND target_details::jsonb ? auth.uid()::text`)
        )
    ); 