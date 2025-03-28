-- Criar tabela para sugestões de rádio
CREATE TABLE IF NOT EXISTS radio_suggestions (
  id SERIAL PRIMARY KEY,
  radio_name TEXT NOT NULL,
  stream_url TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  contact_email TEXT,
  additional_info TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar comentários à tabela para documentação
COMMENT ON TABLE radio_suggestions IS 'Tabela para armazenar sugestões de rádios feitas pelos usuários';
COMMENT ON COLUMN radio_suggestions.id IS 'ID único da sugestão';
COMMENT ON COLUMN radio_suggestions.radio_name IS 'Nome da rádio sugerida';
COMMENT ON COLUMN radio_suggestions.stream_url IS 'URL do stream da rádio (opcional)';
COMMENT ON COLUMN radio_suggestions.city IS 'Cidade da rádio';
COMMENT ON COLUMN radio_suggestions.state IS 'Estado/UF da rádio';
COMMENT ON COLUMN radio_suggestions.contact_email IS 'Email de contato fornecido pelo usuário (opcional)';
COMMENT ON COLUMN radio_suggestions.additional_info IS 'Informações adicionais sobre a rádio (opcional)';
COMMENT ON COLUMN radio_suggestions.user_id IS 'ID do usuário que fez a sugestão';
COMMENT ON COLUMN radio_suggestions.user_email IS 'Email do usuário que fez a sugestão';
COMMENT ON COLUMN radio_suggestions.status IS 'Status da sugestão: pending, approved, rejected';
COMMENT ON COLUMN radio_suggestions.created_at IS 'Data e hora de criação do registro';
COMMENT ON COLUMN radio_suggestions.updated_at IS 'Data e hora da última atualização do registro';

-- Criar função para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar o updated_at automaticamente
CREATE TRIGGER update_radio_suggestions_modtime
BEFORE UPDATE ON radio_suggestions
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Aplicar políticas de segurança (RLS)
ALTER TABLE radio_suggestions ENABLE ROW LEVEL SECURITY;

-- Política que permite usuários autenticados inserir suas próprias sugestões
CREATE POLICY "Usuários autenticados podem criar sugestões" ON radio_suggestions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política que permite usuários visualizarem apenas suas próprias sugestões (a menos que sejam admin)
CREATE POLICY "Usuários podem ver suas próprias sugestões" ON radio_suggestions
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
  )
);

-- Política que permite apenas administradores atualizar sugestões
CREATE POLICY "Apenas administradores podem atualizar sugestões" ON radio_suggestions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
  )
);

-- Política que permite apenas administradores excluir sugestões
CREATE POLICY "Apenas administradores podem excluir sugestões" ON radio_suggestions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'userStatus' = 'ADMIN'
  )
); 