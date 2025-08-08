-- Criar tabela para configurações de provedores LLM
CREATE TABLE IF NOT EXISTS llm_provider_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  api_url TEXT,
  model_name TEXT,
  max_tokens INTEGER DEFAULT 1000,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Validações
  CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2),
  CONSTRAINT valid_max_tokens CHECK (max_tokens > 0 AND max_tokens <= 8000),
  CONSTRAINT valid_provider_name CHECK (provider_name IN ('OpenAI', 'Anthropic', 'Google', 'Azure'))
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_llm_provider_settings_provider_name 
ON llm_provider_settings(provider_name);

CREATE INDEX IF NOT EXISTS idx_llm_provider_settings_is_active 
ON llm_provider_settings(is_active);

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_llm_provider_settings_updated_at 
    BEFORE UPDATE ON llm_provider_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Garantir que apenas um provedor pode estar ativo por vez
CREATE OR REPLACE FUNCTION ensure_single_active_provider()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o novo registro está sendo marcado como ativo
    IF NEW.is_active = TRUE THEN
        -- Desativar todos os outros provedores
        UPDATE llm_provider_settings 
        SET is_active = FALSE, updated_at = NOW()
        WHERE id != NEW.id AND is_active = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_llm_provider
    BEFORE INSERT OR UPDATE ON llm_provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_active_provider();

-- Habilitar RLS (Row Level Security)
ALTER TABLE llm_provider_settings ENABLE ROW LEVEL SECURITY;

-- Política para permitir que apenas admins vejam as configurações
CREATE POLICY "Admins can view LLM settings" ON llm_provider_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Política para permitir que apenas admins modifiquem as configurações
CREATE POLICY "Admins can modify LLM settings" ON llm_provider_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Comentários para documentação
COMMENT ON TABLE llm_provider_settings IS 'Configurações dos provedores de LLM (OpenAI, Anthropic, etc.)';
COMMENT ON COLUMN llm_provider_settings.provider_name IS 'Nome do provedor (OpenAI, Anthropic, Google, Azure)';
COMMENT ON COLUMN llm_provider_settings.api_key IS 'Chave da API do provedor (criptografada)';
COMMENT ON COLUMN llm_provider_settings.api_url IS 'URL da API do provedor (opcional, usa padrão se não especificado)';
COMMENT ON COLUMN llm_provider_settings.model_name IS 'Nome do modelo a ser usado (ex: gpt-4, claude-3, etc.)';
COMMENT ON COLUMN llm_provider_settings.max_tokens IS 'Número máximo de tokens para as respostas';
COMMENT ON COLUMN llm_provider_settings.temperature IS 'Temperatura para controlar criatividade (0-2)';
COMMENT ON COLUMN llm_provider_settings.is_active IS 'Indica se este provedor está ativo (apenas um pode estar ativo)';

-- Inserir configuração padrão para OpenAI (desativada por padrão)
INSERT INTO llm_provider_settings (
    provider_name, 
    api_key, 
    api_url,
    model_name,
    max_tokens,
    temperature,
    is_active
) VALUES (
    'OpenAI',
    'CONFIGURE_YOUR_API_KEY_HERE',
    'https://api.openai.com/v1/chat/completions',
    'gpt-4o',
    1000,
    0.7,
    FALSE
) ON CONFLICT (provider_name) DO NOTHING;