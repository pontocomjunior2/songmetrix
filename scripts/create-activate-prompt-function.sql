-- Função para ativar um template de prompt específico
-- Esta função garante que apenas um prompt esteja ativo por vez usando uma transação
CREATE OR REPLACE FUNCTION activate_prompt_template(prompt_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_data JSON;
    activated_prompt RECORD;
BEGIN
    -- Desativar todos os templates de prompt
    UPDATE prompt_templates 
    SET is_active = false, updated_at = NOW()
    WHERE is_active = true;
    
    -- Ativar o template específico
    UPDATE prompt_templates 
    SET is_active = true, updated_at = NOW()
    WHERE id = prompt_id
    RETURNING * INTO activated_prompt;
    
    -- Verificar se o prompt foi encontrado e atualizado
    IF activated_prompt IS NULL THEN
        RAISE EXCEPTION 'Template de prompt não encontrado com ID: %', prompt_id;
    END IF;
    
    -- Retornar dados do prompt ativado
    SELECT row_to_json(activated_prompt) INTO result_data;
    
    RETURN result_data;
END;
$$;

-- Conceder permissões para o service role
GRANT EXECUTE ON FUNCTION activate_prompt_template(UUID) TO service_role;