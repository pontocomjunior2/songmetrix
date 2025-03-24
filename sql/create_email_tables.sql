-- Criar tabela de templates de email
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de sequências de email
CREATE TABLE IF NOT EXISTS public.email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES public.email_templates(id),
    days_after_signup INTEGER NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de logs de email
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    template_id UUID REFERENCES public.email_templates(id),
    sequence_id UUID REFERENCES public.email_sequences(id),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    email_to VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL
);

-- Criar índices para melhorar o desempenho das consultas
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates(active);
CREATE INDEX IF NOT EXISTS idx_email_sequences_active ON public.email_sequences(active);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_id ON public.email_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sequence_id ON public.email_logs(sequence_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);

-- Implementar políticas de segurança RLS (Row Level Security)
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para templates de email (apenas admins podem gerenciar)
CREATE POLICY admin_manage_templates ON public.email_templates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.status = 'ADMIN'
        )
    );

-- Políticas para sequências de email (apenas admins podem gerenciar)
CREATE POLICY admin_manage_sequences ON public.email_sequences
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.status = 'ADMIN'
        )
    );

-- Políticas para logs de email (admins podem ver todos, usuários apenas os seus)
CREATE POLICY admin_view_all_logs ON public.email_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.status = 'ADMIN'
        )
    );

CREATE POLICY user_view_own_logs ON public.email_logs
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- Habilitar extension uuid-ossp se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Template padrão de boas-vindas
INSERT INTO public.email_templates (name, subject, body, active)
VALUES (
    'welcome_email',
    'Bem-vindo ao SongMetrix!',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://songmetrix.com.br/logo-1280x256.png" alt="SongMetrix Logo" style="max-width: 200px;">
        </div>
        <h1 style="color: #3b82f6; font-size: 24px;">Olá {{name}}!</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Bem-vindo ao SongMetrix, a plataforma completa para monitoramento e análise de execuções musicais nas rádios brasileiras.</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Estamos muito felizes em ter você conosco! Com o SongMetrix, você terá acesso a:</p>
        <ul style="font-size: 16px; line-height: 1.6; color: #333;">
            <li>Monitoramento em tempo real de execuções</li>
            <li>Rankings detalhados</li>
            <li>Relatórios personalizados</li>
            <li>Análise de desempenho de músicas</li>
        </ul>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Para começar, basta acessar sua conta usando o email <strong>{{email}}</strong> em <a href="https://songmetrix.com.br" style="color: #3b82f6;">songmetrix.com.br</a>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #555;">Se tiver qualquer dúvida, não hesite em responder a este email ou entrar em contato pelo WhatsApp.</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Atenciosamente,<br>Equipe SongMetrix</p>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>© 2025 SongMetrix - Todos os direitos reservados</p>
            <p>Este email foi enviado em {{date}}</p>
        </div>
    </div>',
    true
);

-- Sequência de email padrão (1 dia após cadastro)
INSERT INTO public.email_sequences (name, template_id, days_after_signup, active)
SELECT 
    'Boas-vindas (1 dia após cadastro)',
    id,
    1,
    true
FROM public.email_templates
WHERE name = 'welcome_email'
LIMIT 1; 