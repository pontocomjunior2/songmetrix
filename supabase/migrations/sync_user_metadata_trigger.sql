-- Script simplificado para criar o trigger de sincronização de metadados do usuário
-- Execute este script no SQL Editor do Supabase Studio para resolver problemas com a sincronização de metadados

-- Assegurar que as colunas existam
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

-- Criar função para sincronizar metadados
CREATE OR REPLACE FUNCTION sync_auth_metadata_to_profile()
RETURNS TRIGGER AS $$
DECLARE
  raw_meta JSONB;
  fullname_value TEXT;
  whatsapp_value TEXT;
BEGIN
  -- Obter metadados do auth.users
  SELECT raw_user_meta_data INTO raw_meta FROM auth.users WHERE id = NEW.id;
  
  IF raw_meta IS NOT NULL THEN
    -- Obter nome completo dos metadados (verificar várias chaves possíveis)
    fullname_value := COALESCE(
      raw_meta->>'fullName',
      raw_meta->>'full_name',
      raw_meta->>'name',
      NULL
    );
    
    -- Obter whatsapp dos metadados
    whatsapp_value := raw_meta->>'whatsapp';
    
    -- Atualizar campos apenas se estiverem vazios no perfil
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

-- Criar trigger para sincronizar metadados
CREATE TRIGGER sync_auth_metadata_trigger
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION sync_auth_metadata_to_profile();

-- Verificar se o trigger foi criado
SELECT 'Trigger sync_auth_metadata_trigger criado com sucesso!' AS status;

-- Processar usuários existentes
DO $$
DECLARE
  user_record RECORD;
  auth_meta JSONB;
  fullname_value TEXT;
  whatsapp_value TEXT;
  users_updated INT := 0;
BEGIN
  FOR user_record IN SELECT id, full_name, whatsapp FROM public.users
  LOOP
    -- Obter metadados do usuário
    SELECT raw_user_meta_data INTO auth_meta FROM auth.users WHERE id = user_record.id;
    
    IF auth_meta IS NOT NULL THEN
      fullname_value := COALESCE(
        auth_meta->>'fullName',
        auth_meta->>'full_name',
        auth_meta->>'name',
        NULL
      );
      
      whatsapp_value := auth_meta->>'whatsapp';
      
      -- Atualizar se necessário
      IF (fullname_value IS NOT NULL AND (user_record.full_name IS NULL OR user_record.full_name = '')) OR
         (whatsapp_value IS NOT NULL AND (user_record.whatsapp IS NULL OR user_record.whatsapp = '')) THEN
        
        UPDATE public.users
        SET 
          full_name = COALESCE(NULLIF(fullname_value, ''), full_name),
          whatsapp = COALESCE(NULLIF(whatsapp_value, ''), whatsapp)
        WHERE id = user_record.id;
        
        users_updated := users_updated + 1;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Usuários atualizados: %', users_updated;
END
$$; 