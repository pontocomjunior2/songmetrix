-- Migration: Add is_read column to notifications table

ALTER TABLE public.notifications
ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Opcional: Adicionar índice se você for filtrar frequentemente por is_read
-- CREATE INDEX idx_notifications_is_read ON public.notifications(is_read); 

-- Atualizar política de leitura para que usuários possam ler suas notificações não lidas?
-- (A política atual já permite ler, mas poderíamos refinar)
-- Exemplo: (se precisarmos filtrar no RLS - por enquanto, filtramos no client-side)
/*
DROP POLICY IF EXISTS "Allow authenticated users to read their notifications" ON public.notifications;
CREATE POLICY "Allow authenticated users to read their notifications"
    ON public.notifications
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND (
            target_audience = 'all' -- OR outras condições de target
            -- AND is_read = FALSE -- Se quisermos que RLS filtre apenas não lidas (não recomendado geralmente)
        )
    );
*/ 