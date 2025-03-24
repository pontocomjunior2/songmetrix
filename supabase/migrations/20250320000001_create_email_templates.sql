-- Criação da tabela para templates de email
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT TRUE
);

-- Adicionar comentários à tabela e colunas
COMMENT ON TABLE public.email_templates IS 'Templates de email para diferentes propósitos';
COMMENT ON COLUMN public.email_templates.id IS 'ID único do template';
COMMENT ON COLUMN public.email_templates.name IS 'Nome identificador do template';
COMMENT ON COLUMN public.email_templates.subject IS 'Assunto do email';
COMMENT ON COLUMN public.email_templates.body IS 'Corpo do email em formato HTML';
COMMENT ON COLUMN public.email_templates.created_at IS 'Data de criação do template';
COMMENT ON COLUMN public.email_templates.updated_at IS 'Data da última atualização do template';
COMMENT ON COLUMN public.email_templates.created_by IS 'ID do usuário que criou o template';
COMMENT ON COLUMN public.email_templates.active IS 'Indica se o template está ativo';

-- Políticas RLS para a tabela de templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Política para leitura - apenas administradores
CREATE POLICY "email_templates_select_policy" ON public.email_templates
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Política para inserção - apenas administradores
CREATE POLICY "email_templates_insert_policy" ON public.email_templates
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Política para atualização - apenas administradores
CREATE POLICY "email_templates_update_policy" ON public.email_templates
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
CREATE POLICY "email_templates_delete_policy" ON public.email_templates
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'ADMIN'
  )
);

-- Criar template de boas-vindas padrão
INSERT INTO public.email_templates (name, subject, body)
VALUES (
  'welcome_email',
  'Bem-vindo ao SONGMETRIX!',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #333;">Bem-vindo ao SONGMETRIX!</h1>
    <p>Olá {{name}},</p>
    <p>É com grande satisfação que damos as boas-vindas à plataforma SONGMETRIX.</p>
    <p>Agora você tem acesso a todas as ferramentas necessárias para monitorar as reproduções musicais em rádios de todo o Brasil.</p>
    <p>Se precisar de qualquer assistência, não hesite em entrar em contato com nossa equipe de suporte.</p>
    <p>Atenciosamente,<br>Equipe SONGMETRIX</p>
  </div>'
); 