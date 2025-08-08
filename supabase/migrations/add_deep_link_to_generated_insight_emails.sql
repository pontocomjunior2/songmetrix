-- Adicionar campo deep_link à tabela generated_insight_emails
ALTER TABLE generated_insight_emails 
ADD COLUMN IF NOT EXISTS deep_link TEXT;

-- Criar índice para o campo deep_link
CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_deep_link 
ON generated_insight_emails(deep_link);

-- Comentário para documentação
COMMENT ON COLUMN generated_insight_emails.deep_link IS 'Link profundo para a página específica do insight no app';