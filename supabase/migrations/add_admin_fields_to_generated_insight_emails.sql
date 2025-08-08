-- Adicionar campos de administração à tabela generated_insight_emails
ALTER TABLE generated_insight_emails 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_approved_by 
ON generated_insight_emails(approved_by);

CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_sent_by 
ON generated_insight_emails(sent_by);

CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_approved_at 
ON generated_insight_emails(approved_at);

-- Comentários para documentação
COMMENT ON COLUMN generated_insight_emails.approved_at IS 'Data/hora em que o insight foi aprovado por um admin';
COMMENT ON COLUMN generated_insight_emails.approved_by IS 'ID do admin que aprovou o insight';
COMMENT ON COLUMN generated_insight_emails.sent_by IS 'ID do admin que enviou o insight';
COMMENT ON COLUMN generated_insight_emails.error_message IS 'Mensagem de erro em caso de falha no envio';