-- Criação da tabela para sequências de email
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE,
  days_after_signup INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  send_type VARCHAR NOT NULL DEFAULT 'DAYS_AFTER_SIGNUP',
  send_hour INTEGER DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Adicionar comentários à tabela e colunas
COMMENT ON TABLE public.email_sequences IS 'Configuração de sequências de email após signup';
COMMENT ON COLUMN public.email_sequences.id IS 'ID único da sequência';
COMMENT ON COLUMN public.email_sequences.template_id IS 'ID do template de email a ser usado';
COMMENT ON COLUMN public.email_sequences.days_after_signup IS 'Dias após o cadastro para enviar o email';
COMMENT ON COLUMN public.email_sequences.name IS 'Nome da sequência para fácil identificação';
COMMENT ON COLUMN public.email_sequences.active IS 'Indica se a sequência está ativa';
COMMENT ON COLUMN public.email_sequences.send_type IS 'Tipo de envio: DAYS_AFTER_SIGNUP ou AFTER_FIRST_LOGIN';
COMMENT ON COLUMN public.email_sequences.send_hour IS 'Hora do dia para enviar o email (0-23)';
COMMENT ON COLUMN public.email_sequences.created_at IS 'Data de criação da sequência';
COMMENT ON COLUMN public.email_sequences.updated_at IS 'Data da última atualização da sequência';
COMMENT ON COLUMN public.email_sequences.created_by IS 'ID do usuário que criou a sequência';

-- Políticas RLS para a tabela de sequências
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

-- Política para leitura - apenas administradores
CREATE POLICY "email_sequences_select_policy" ON public.email_sequences
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Política para inserção - apenas administradores
CREATE POLICY "email_sequences_insert_policy" ON public.email_sequences
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Política para atualização - apenas administradores
CREATE POLICY "email_sequences_update_policy" ON public.email_sequences
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Política para deleção - apenas administradores
CREATE POLICY "email_sequences_delete_policy" ON public.email_sequences
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Criar sequência de boas-vindas padrão (1 dia após o cadastro)
INSERT INTO public.email_sequences (template_id, days_after_signup, name)
SELECT 
  id,
  1, 
  'Email de Boas-vindas'
FROM public.email_templates 
WHERE name = 'welcome_email'; 