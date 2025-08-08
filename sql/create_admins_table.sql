-- Criar tabela de administradores se não existir
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Garantir que um usuário só pode ser admin uma vez
    UNIQUE(user_id)
);

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Política para permitir que apenas admins vejam a tabela de admins
CREATE POLICY "Admins can view admin table" ON public.admins
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que apenas admins insiram novos admins
CREATE POLICY "Admins can insert new admins" ON public.admins
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que apenas admins atualizem a tabela de admins
CREATE POLICY "Admins can update admin table" ON public.admins
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que apenas admins deletem da tabela de admins
CREATE POLICY "Admins can delete from admin table" ON public.admins
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Comentários para documentação
COMMENT ON TABLE public.admins IS 'Tabela para gerenciar usuários administradores do sistema';
COMMENT ON COLUMN public.admins.user_id IS 'ID do usuário que tem permissões de administrador';
COMMENT ON COLUMN public.admins.created_by IS 'ID do admin que criou este registro';

-- Inserir o primeiro admin (substitua pelo seu user_id)
-- IMPORTANTE: Execute este comando manualmente com o user_id correto
-- INSERT INTO public.admins (user_id, created_by) 
-- VALUES ('SEU_USER_ID_AQUI', 'SEU_USER_ID_AQUI')
-- ON CONFLICT (user_id) DO NOTHING;