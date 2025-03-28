-- Script para verificar e corrigir as políticas RLS da tabela radio_suggestions
-- Execute este script no console SQL do Supabase

-- Primeiro, vamos verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'radio_suggestions'
    ) THEN
        RAISE NOTICE 'A tabela radio_suggestions não existe. Crie-a antes de executar este script.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'A tabela radio_suggestions existe.';
    
    -- Verificar se o RLS está habilitado
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'radio_suggestions' 
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS está habilitado para a tabela radio_suggestions.';
    ELSE
        RAISE NOTICE 'RLS não está habilitado. Habilitando agora...';
        EXECUTE 'ALTER TABLE public.radio_suggestions ENABLE ROW LEVEL SECURITY;';
    END IF;
    
    -- Verificar e corrigir as políticas
    -- Remover todas as políticas existentes e recriar
    DROP POLICY IF EXISTS "Usuários autenticados podem criar sugestões" ON public.radio_suggestions;
    DROP POLICY IF EXISTS "Usuários podem ver suas próprias sugestões" ON public.radio_suggestions;
    DROP POLICY IF EXISTS "Apenas administradores podem atualizar sugestões" ON public.radio_suggestions;
    DROP POLICY IF EXISTS "Apenas administradores podem excluir sugestões" ON public.radio_suggestions;
    
    -- Recriar as políticas com configurações corrigidas
    
    -- Política para inserção (todos os usuários autenticados podem inserir)
    CREATE POLICY "Usuários autenticados podem criar sugestões" 
    ON public.radio_suggestions 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);
    
    -- Política para seleção (usuários podem ver suas próprias sugestões, admins podem ver todas)
    CREATE POLICY "Usuários podem ver suas próprias sugestões" 
    ON public.radio_suggestions 
    FOR SELECT 
    TO authenticated 
    USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
        )
    );
    
    -- Política para atualização (apenas admins)
    CREATE POLICY "Apenas administradores podem atualizar sugestões" 
    ON public.radio_suggestions 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
        )
    );
    
    -- Política para exclusão (apenas admins)
    CREATE POLICY "Apenas administradores podem excluir sugestões" 
    ON public.radio_suggestions 
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
        )
    );
    
    -- Política aberta para ADMIN (simplifica tudo para admins)
    CREATE POLICY "Super acesso para administradores" 
    ON public.radio_suggestions 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
        )
    );
    
    RAISE NOTICE 'Políticas RLS recriadas com sucesso para a tabela radio_suggestions.';
END $$; 