-- Criação da tabela para logs de emails enviados
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id),
  sequence_id UUID REFERENCES public.email_sequences(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR NOT NULL,
  error_message TEXT,
  email_to VARCHAR NOT NULL,
  subject VARCHAR NOT NULL
);

-- Adicionar comentários à tabela e colunas
COMMENT ON TABLE public.email_logs IS 'Registro de todos os emails enviados pelo sistema';
COMMENT ON COLUMN public.email_logs.id IS 'ID único do log';
COMMENT ON COLUMN public.email_logs.user_id IS 'ID do usuário que recebeu o email';
COMMENT ON COLUMN public.email_logs.template_id IS 'ID do template usado';
COMMENT ON COLUMN public.email_logs.sequence_id IS 'ID da sequência associada, se houver';
COMMENT ON COLUMN public.email_logs.sent_at IS 'Data e hora de envio do email';
COMMENT ON COLUMN public.email_logs.status IS 'Status do envio (SUCCESS, FAILED)';
COMMENT ON COLUMN public.email_logs.error_message IS 'Mensagem de erro, se houver';
COMMENT ON COLUMN public.email_logs.email_to IS 'Endereço de email do destinatário';
COMMENT ON COLUMN public.email_logs.subject IS 'Assunto do email enviado';

-- Políticas RLS para a tabela de logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Política para leitura - apenas administradores
CREATE POLICY "email_logs_select_policy" ON public.email_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Política para inserção - apenas inserções via função ou pelo sistema
CREATE POLICY "email_logs_insert_policy" ON public.email_logs
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Criar índice para melhorar performance de consultas por usuário
CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON public.email_logs(user_id);

-- Criar índice para melhorar performance de consultas por data de envio
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON public.email_logs(sent_at); 