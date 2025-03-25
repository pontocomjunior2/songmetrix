-- Nome: sync_user_metadata_to_profile.sql
-- Descrição: Script para criar um trigger que sincroniza metadados de autenticação com a tabela de perfil
-- Data: Agora

-- Primeiro, verificar se as colunas existem na tabela users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
    ALTER TABLE users ADD COLUMN full_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'whatsapp') THEN
    ALTER TABLE users ADD COLUMN whatsapp text;
  END IF;
END
$$;

-- Criar função para sincronizar metadados de autenticação com o perfil
CREATE OR REPLACE FUNCTION sync_auth_metadata_to_profile()
RETURNS TRIGGER AS $$
DECLARE
  raw_meta JSONB;
  fullname_value TEXT;
  whatsapp_value TEXT;
BEGIN
  -- Tentar obter metadados brutos
  SELECT raw_user_meta_data INTO raw_meta FROM auth.users WHERE id = NEW.id;
  
  IF raw_meta IS NOT NULL THEN
    -- Obter valores dos metadados
    -- Verificar diferentes chaves possíveis para o nome completo (fullName, full_name)
    fullname_value := COALESCE(
      raw_meta->>'fullName',
      raw_meta->>'full_name',
      raw_meta->>'name',
      NULL
    );
    
    -- Obter valor do WhatsApp
    whatsapp_value := raw_meta->>'whatsapp';
    
    -- Atualizar colunas apenas se os valores dos metadados existirem e as colunas do perfil estiverem vazias
    IF fullname_value IS NOT NULL AND (NEW.full_name IS NULL OR NEW.full_name = '') THEN
      NEW.full_name := fullname_value;
    END IF;
    
    IF whatsapp_value IS NOT NULL AND (NEW.whatsapp IS NULL OR NEW.whatsapp = '') THEN
      NEW.whatsapp := whatsapp_value;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS sync_auth_metadata_trigger ON public.users;

-- Criar trigger para sincronizar metadados na inserção ou atualização
CREATE TRIGGER sync_auth_metadata_trigger
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION sync_auth_metadata_to_profile();

-- Adicionar comentários para documentação
COMMENT ON FUNCTION sync_auth_metadata_to_profile() IS 'Função que sincroniza metadados de autenticação (full_name e whatsapp) com a tabela de perfil';
COMMENT ON TRIGGER sync_auth_metadata_trigger ON public.users IS 'Trigger que sincroniza metadados de autenticação com o perfil do usuário durante inserção ou atualização';

-- Aplicar a sincronização em usuários existentes para garantir que todos os dados estejam atualizados
DO $$
DECLARE
  user_record RECORD;
  auth_meta JSONB;
  fullname_value TEXT;
  whatsapp_value TEXT;
  updates_made BOOLEAN;
BEGIN
  FOR user_record IN SELECT id, full_name, whatsapp FROM public.users
  LOOP
    updates_made := FALSE;
    
    -- Obter metadados do usuário
    SELECT raw_user_meta_data INTO auth_meta FROM auth.users WHERE id = user_record.id;
    
    IF auth_meta IS NOT NULL THEN
      -- Obter valores dos metadados
      fullname_value := COALESCE(
        auth_meta->>'fullName',
        auth_meta->>'full_name',
        auth_meta->>'name',
        NULL
      );
      
      whatsapp_value := auth_meta->>'whatsapp';
      
      -- Preparar atualização
      IF fullname_value IS NOT NULL AND (user_record.full_name IS NULL OR user_record.full_name = '') THEN
        updates_made := TRUE;
      END IF;
      
      IF whatsapp_value IS NOT NULL AND (user_record.whatsapp IS NULL OR user_record.whatsapp = '') THEN
        updates_made := TRUE;
      END IF;
      
      -- Atualizar perfil se necessário
      IF updates_made THEN
        UPDATE public.users
        SET 
          full_name = COALESCE(NULLIF(fullname_value, ''), full_name),
          whatsapp = COALESCE(NULLIF(whatsapp_value, ''), whatsapp)
        WHERE id = user_record.id;
      END IF;
    END IF;
  END LOOP;
END
$$; 