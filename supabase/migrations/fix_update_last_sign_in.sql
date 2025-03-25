-- Criar função para atualizar o campo last_sign_in_at para todos os usuários

CREATE OR REPLACE FUNCTION update_users_last_sign_in()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar last_sign_in_at para todos os usuários que não têm esse dado preenchido
    UPDATE public.users
    SET last_sign_in_at = updated_at
    WHERE last_sign_in_at IS NULL;
    
    -- Obter o número de linhas afetadas
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Retornar resultado como JSON
    RETURN json_build_object(
        'success', true,
        'message', 'Atualização concluída com sucesso',
        'updated_count', updated_count
    );
END;
$$;
