-- Script simplificado para criar a tabela de sugestões de rádio no Supabase
-- Execute este script no console SQL do Supabase

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