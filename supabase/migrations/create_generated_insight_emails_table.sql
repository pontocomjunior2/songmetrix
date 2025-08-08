-- Criar tabela para armazenar e-mails de insights gerados
CREATE TABLE IF NOT EXISTS generated_insight_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  insight_data JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_user_id 
ON generated_insight_emails(user_id);

CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_status 
ON generated_insight_emails(status);

CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_created_at 
ON generated_insight_emails(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_insight_emails_insight_type 
ON generated_insight_emails(insight_type);

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_generated_insight_emails_updated_at 
    BEFORE UPDATE ON generated_insight_emails 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE generated_insight_emails IS 'Armazena e-mails de insights gerados automaticamente para usuários';
COMMENT ON COLUMN generated_insight_emails.user_id IS 'ID do usuário que receberá o insight';
COMMENT ON COLUMN generated_insight_emails.subject IS 'Assunto do e-mail';
COMMENT ON COLUMN generated_insight_emails.content IS 'Conteúdo HTML do e-mail';
COMMENT ON COLUMN generated_insight_emails.insight_type IS 'Tipo de insight (growth_trend, artist_focus, music_diversity, general_activity)';
COMMENT ON COLUMN generated_insight_emails.insight_data IS 'Dados JSON utilizados para gerar o insight';
COMMENT ON COLUMN generated_insight_emails.status IS 'Status do e-mail (draft, sent, failed)';
COMMENT ON COLUMN generated_insight_emails.sent_at IS 'Data/hora em que o e-mail foi enviado';