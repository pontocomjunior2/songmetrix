-- Adiciona coluna last_sign_in_at à tabela users se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'last_sign_in_at'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN last_sign_in_at TIMESTAMPTZ;
        
        -- Adiciona comentário à coluna
        COMMENT ON COLUMN public.users.last_sign_in_at IS 'Armazena a data e hora do último login do usuário';
        
        -- Log de conclusão
        RAISE NOTICE 'Coluna last_sign_in_at adicionada com sucesso à tabela users';
    ELSE
        RAISE NOTICE 'Coluna last_sign_in_at já existe na tabela users';
    END IF;
END $$; 