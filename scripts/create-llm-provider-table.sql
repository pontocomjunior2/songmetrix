-- Create llm_provider_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS llm_provider_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_name VARCHAR(50) NOT NULL,
    api_key TEXT NOT NULL,
    api_url TEXT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    max_tokens INTEGER DEFAULT 1000,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default OpenAI configuration if no active provider exists
INSERT INTO llm_provider_settings (
    provider_name, 
    api_key, 
    api_url, 
    model_name, 
    max_tokens, 
    temperature, 
    is_active
)
SELECT 
    'openai',
    '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',
    'https://api.openai.com/v1/chat/completions',
    'gpt-3.5-turbo',
    1000,
    0.7,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM llm_provider_settings WHERE is_active = true
);