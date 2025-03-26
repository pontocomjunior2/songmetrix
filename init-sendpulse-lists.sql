-- Script para inicialização do SendPulse
-- Este script contém instruções SQL para inicializar as tabelas necessárias para o SendPulse
-- Execute este script manualmente usando a interface de consulta do PostgreSQL no Supabase

-- Criar tabela para armazenar IDs das listas do SendPulse
CREATE TABLE IF NOT EXISTS public.sendpulse_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    external_id VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar comentário na tabela
COMMENT ON TABLE public.sendpulse_lists IS 'Armazena as listas de emails do SendPulse';

-- Inserir listas padrão (altere os IDs para os valores reais criados no SendPulse)
INSERT INTO public.sendpulse_lists (name, external_id, description, status)
VALUES
    ('Lista TRIAL', '152167', 'Lista para usuários com status TRIAL', 'ACTIVE'),
    ('Lista ATIVO', '152197', 'Lista para usuários com status ATIVO', 'ACTIVE'),
    ('Lista INATIVO', '152199', 'Lista para usuários com status INATIVO', 'ACTIVE')
ON CONFLICT (id) DO UPDATE
SET 
    external_id = EXCLUDED.external_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Criar função para verificar e atualizar os IDs das listas
CREATE OR REPLACE FUNCTION public.get_sendpulse_list_id(user_status TEXT)
RETURNS VARCHAR AS $$
DECLARE
    list_id VARCHAR;
BEGIN
    SELECT external_id INTO list_id
    FROM public.sendpulse_lists
    WHERE status = 'ACTIVE' 
    AND name ILIKE 'Lista ' || user_status;
    
    -- Se não encontrar lista específica, retorna a lista TRIAL como padrão
    IF list_id IS NULL THEN
        SELECT external_id INTO list_id
        FROM public.sendpulse_lists
        WHERE status = 'ACTIVE' 
        AND name ILIKE 'Lista TRIAL';
    END IF;
    
    RETURN list_id;
END;
$$ LANGUAGE plpgsql;

-- Verificar se os IDs estão configurados corretamente
SELECT * FROM public.sendpulse_lists; 