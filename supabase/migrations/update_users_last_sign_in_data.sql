-- Script para atualizar o campo last_sign_in_at para usuários existentes
-- Usa o campo updated_at como estimativa do último acesso

DO $$
BEGIN
    -- Verificar se a coluna existe antes de tentar atualizar
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'last_sign_in_at'
    ) THEN
        -- Atualizar last_sign_in_at para todos os usuários que não têm esse dado preenchido
        UPDATE public.users
        SET last_sign_in_at = updated_at
        WHERE last_sign_in_at IS NULL;
        
        -- Contar quantos registros foram atualizados
        RAISE NOTICE 'Campo last_sign_in_at atualizado para % usuários', 
            (SELECT COUNT(*) FROM public.users WHERE last_sign_in_at = updated_at);
    ELSE
        RAISE NOTICE 'A coluna last_sign_in_at não existe na tabela users. Execute primeiro o script update_users_add_last_sign_in.sql';
    END IF;
END $$; 