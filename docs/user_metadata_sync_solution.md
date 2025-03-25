# Solução para Sincronização de Metadados de Usuário no SONGMETRIX

## Problema

Os campos `full_name` e `whatsapp` não estavam sendo preenchidos automaticamente no perfil dos usuários quando eles se registravam no sistema. Mesmo quando os metadados (`user_metadata`) estavam sendo salvos na tabela `auth.users` do Supabase, eles não eram transferidos para a tabela `public.users` onde são necessários para exibição na interface.

## Diagnóstico

1. Confirmamos que os metadados estavam sendo salvos corretamente na tabela `auth.users`.
2. Identificamos que não havia um mecanismo automático para sincronizar esses metadados com a tabela `public.users`.
3. Descobrimos que, embora existisse um trigger no banco de dados, ele não estava funcionando corretamente.

## Solução Implementada

### 1. Criação de Trigger de Sincronização no Banco de Dados

Desenvolvemos e implementamos um trigger no PostgreSQL que sincroniza automaticamente os metadados de autenticação com a tabela de perfil do usuário:

```sql
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
```

Este trigger é executado antes da inserção ou atualização de um registro na tabela `public.users` e preenche automaticamente os campos `full_name` e `whatsapp` com os valores encontrados nos metadados da tabela `auth.users`.

### 2. Scripts de Utilitário

Criamos diversos scripts para diagnóstico, migração e teste da solução:

1. **Script de Aplicação do Trigger**: `scripts/apply_user_profile_trigger.js`
   - Aplica o trigger diretamente no banco de dados.

2. **Script de Teste de Sincronização**: `scripts/test_user_metadata_sync.js`
   - Cria um usuário de teste com metadados.
   - Verifica se os campos são sincronizados corretamente.

3. **Script de Migração de Metadados**: `scripts/migrate_user_metadata.js`
   - Atualiza os usuários existentes com os metadados da tabela `auth.users`.

4. **Script de Verificação de Metadados**: `scripts/check-user-metadata.js`
   - Analisa e exibe os metadados existentes para diagnóstico.

### 3. Comandos NPM

Adicionamos comandos ao `package.json` para facilitar a execução dos scripts:

```json
{
  "scripts": {
    "check-user-metadata": "node scripts/check-user-metadata.js",
    "migrate-user-metadata": "node scripts/migrate_user_metadata.js",
    "fix-user-profiles": "node scripts/fix_user_profile_fields.js",
    "apply-profile-trigger": "node scripts/apply_user_profile_trigger.js",
    "test-metadata-sync": "node scripts/test_user_metadata_sync.js"
  }
}
```

## Testes e Resultados

Realizamos testes extensivos para garantir que a solução funcionasse corretamente:

1. **Teste com Usuário Novo**:
   - Criamos um novo usuário com metadados.
   - Confirmamos que os campos `full_name` e `whatsapp` foram automaticamente preenchidos.

2. **Migração de Usuários Existentes**:
   - Executamos scripts para atualizar usuários existentes.
   - Verificamos que os campos foram preenchidos para usuários que já tinham metadados.

## Conclusão

A implementação do trigger de sincronização de metadados resolveu o problema dos campos `full_name` e `whatsapp` que não eram preenchidos automaticamente. Agora, quando um usuário se registra no sistema, seus dados pessoais são sincronizados automaticamente para o perfil, garantindo uma experiência mais completa e coerente.

## Próximos Passos

1. **Monitoramento**: Continuar monitorando o funcionamento do trigger para garantir que funcione conforme esperado.
2. **Extensão**: Considerar estender a sincronização para outros campos de metadados que possam ser relevantes.
3. **Documentação**: Manter esta documentação atualizada com quaisquer alterações futuras na solução.

---

*Documentação criada em: 1º de Agosto de 2023* 