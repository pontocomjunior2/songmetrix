

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "extensions";


ALTER SCHEMA "extensions" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."user_status" AS ENUM (
    'ATIVO',
    'INATIVO',
    'ADMIN',
    'TRIAL'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_cron_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "postgres";


COMMENT ON FUNCTION "extensions"."grant_pg_cron_access"() IS 'Grants access to pg_cron';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_graphql_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_graphql_access"() IS 'Grants access to pg_graphql';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_net_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_event_trigger_ddl_commands() AS ev
      JOIN pg_extension AS ext
      ON ev.objid = ext.oid
      WHERE ext.extname = 'pg_net'
    )
    THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'supabase_functions_admin'
      )
      THEN
        CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
      END IF;

      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

      IF EXISTS (
        SELECT FROM pg_extension
        WHERE extname = 'pg_net'
        -- all versions in use on existing projects as of 2025-02-20
        -- version 0.12.0 onwards don't need these applied
        AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')
      ) THEN
        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

        REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
        REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

        GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
        GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      END IF;
    END IF;
  END;
  $$;


ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "postgres";


COMMENT ON FUNCTION "extensions"."grant_pg_net_access"() IS 'Grants access to pg_net';



CREATE OR REPLACE FUNCTION "extensions"."pgrst_ddl_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."pgrst_drop_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."set_graphql_placeholder"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."set_graphql_placeholder"() IS 'Reintroduces placeholder function for graphql_public.graphql';



CREATE OR REPLACE FUNCTION "public"."add_favorite_radios_column"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS favorite_radios text[] DEFAULT '{}'::text[];
END;
$$;


ALTER FUNCTION "public"."add_favorite_radios_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alter_users_add_favorite_radios"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS favorite_radios text[] DEFAULT '{}'::text[];
END;
$$;


ALTER FUNCTION "public"."alter_users_add_favorite_radios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_admin_status"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'status' = 'ADMIN'
  );
$$;


ALTER FUNCTION "public"."check_admin_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_auth_sync_queue_structure"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  structure_valid BOOLEAN := TRUE;
BEGIN
  -- Verificar se a tabela auth_sync_queue existe
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'auth_sync_queue'
  ) THEN
    -- Criar a tabela se não existir
    CREATE TABLE public.auth_sync_queue (
      user_id UUID PRIMARY KEY,
      status TEXT,
      processed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Tabela auth_sync_queue criada com sucesso';
    structure_valid := FALSE;
  ELSE
    -- Verificar colunas
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'auth_sync_queue'
      AND column_name = 'updated_at'
    ) THEN
      -- Adicionar coluna updated_at se não existir
      ALTER TABLE public.auth_sync_queue
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      
      RAISE NOTICE 'Coluna updated_at adicionada à tabela auth_sync_queue';
      structure_valid := FALSE;
    END IF;

    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'auth_sync_queue'
      AND column_name = 'status'
    ) THEN
      -- Adicionar coluna status se não existir
      ALTER TABLE public.auth_sync_queue
      ADD COLUMN status TEXT;
      
      RAISE NOTICE 'Coluna status adicionada à tabela auth_sync_queue';
      structure_valid := FALSE;
    END IF;

    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'auth_sync_queue'
      AND column_name = 'processed'
    ) THEN
      -- Adicionar coluna processed se não existir
      ALTER TABLE public.auth_sync_queue
      ADD COLUMN processed BOOLEAN DEFAULT FALSE;
      
      RAISE NOTICE 'Coluna processed adicionada à tabela auth_sync_queue';
      structure_valid := FALSE;
    END IF;
  END IF;

  -- Limpar registros obsoletos para evitar acúmulo
  DELETE FROM public.auth_sync_queue
  WHERE 
    processed = TRUE 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
  
  RETURN structure_valid;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao verificar estrutura da tabela: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_auth_sync_queue_structure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_admin"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Check if the executing user is an admin
  SELECT raw_user_meta_data->>'status'
  INTO v_user_role
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Only admin users can delete users';
  END IF;

  -- Delete from auth.users (this will cascade to public.users)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql_query" "text") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
BEGIN
  EXECUTE sql_query;
  result := json_build_object('success', true, 'message', 'SQL executado com sucesso');
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := json_build_object('success', false, 'message', SQLERRM);
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."exec_sql"("sql_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."exec_sql"("sql_query" "text") IS 'Executa SQL dinâmico com segurança elevada';



CREATE OR REPLACE FUNCTION "public"."get_pending_emails"("p_current_hour" integer DEFAULT NULL::integer) RETURNS TABLE("user_id" "uuid", "email" character varying, "full_name" character varying, "first_login_at" timestamp with time zone, "sequence_id" "uuid", "template_id" "uuid", "subject" character varying, "body" "text", "send_type" character varying)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  WITH active_sequences AS (
    SELECT 
      seq.id as sequence_id,
      seq.template_id,
      seq.days_after_signup,
      seq.send_hour,
      seq.send_type,
      temp.subject,
      temp.body
    FROM 
      public.email_sequences seq
      JOIN public.email_templates temp ON seq.template_id = temp.id
    WHERE 
      seq.active = true 
      AND temp.active = true
      AND (
        (seq.send_type = 'DAYS_AFTER_SIGNUP' AND (p_current_hour IS NULL OR seq.send_hour = p_current_hour))
        OR
        seq.send_type = 'AFTER_FIRST_LOGIN'
      )
  )
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.first_login_at,
    s.sequence_id,
    s.template_id,
    s.subject,
    s.body,
    s.send_type
  FROM 
    public.users u
    CROSS JOIN active_sequences s
  WHERE 
    u.status IN ('ATIVO', 'TRIAL', 'ADMIN')
    AND (
      (s.send_type = 'DAYS_AFTER_SIGNUP' AND EXTRACT(DAY FROM NOW() - u.created_at) >= s.days_after_signup)
      OR
      (s.send_type = 'AFTER_FIRST_LOGIN' AND u.first_login_at IS NOT NULL AND (NOW() - u.first_login_at) < INTERVAL '1 day')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.email_logs l
      WHERE l.user_id = u.id
      AND l.sequence_id = s.sequence_id
    )
  LIMIT 100
$$;


ALTER FUNCTION "public"."get_pending_emails"("p_current_hour" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sendpulse_list_id"("user_status" "text") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    list_id VARCHAR;
BEGIN
    SELECT external_id INTO list_id
    FROM public.sendpulse_lists
    WHERE status = 'ACTIVE' 
    AND name ILIKE 'Lista ' || user_status;
    
    -- Se não encontrar lista específica, retorna a lista TRIAL como padrão
    IF list_id IS NULL THEN
        SELECT external_id INTO list_id
        FROM public.sendpulse_lists
        WHERE status = 'ACTIVE' 
        AND name ILIKE 'Lista TRIAL';
    END IF;
    
    RETURN list_id;
END;
$$;


ALTER FUNCTION "public"."get_sendpulse_list_id"("user_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.users
    SET
        email = NEW.email,
        full_name = NEW.raw_user_meta_data->>'full_name',
        avatar_url = NEW.raw_user_meta_data->>'avatar_url',
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT raw_user_meta_data->>'status' = 'ADMIN' 
          FROM auth.users 
          WHERE id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_user_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Aqui NEW está no contexto correto de uma função de trigger
  IF NEW.status IS NULL OR NEW.status = 'INATIVO' THEN
    NEW.status := 'TRIAL';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_default_user_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_auth_metadata_to_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
      DECLARE
        raw_meta JSONB;
        fullname_value TEXT;
        whatsapp_value TEXT;
      BEGIN
        -- Tentar obter metadados brutos
        SELECT raw_user_meta_data INTO raw_meta FROM auth.users WHERE id = NEW.id;
        
        IF raw_meta IS NOT NULL THEN
          -- Obter valores dos metadados
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
      $$;


ALTER FUNCTION "public"."sync_auth_metadata_to_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_auth_metadata_to_profile"() IS 'Função que sincroniza metadados de autenticação (full_name e whatsapp) com a tabela de perfil';



CREATE OR REPLACE FUNCTION "public"."sync_new_trial_user_to_brevo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  http_response json;
  http_status integer;
  http_method text := 'POST';
  payload json;
  webhook_base_url text := 'https://songmetrix.com.br/api/webhook';
BEGIN
  -- Se o usuário for TRIAL, aciona o webhook
  IF NEW.status = 'TRIAL' THEN
    -- Montar payload com dados do usuário
    payload := json_build_object(
      'id', NEW.id,
      'email', NEW.email,
      'status', NEW.status,
      'name', NEW.name,
      'updated_at', NEW.updated_at,
      'event_type', 'new_trial_user'
    );

    -- Chamar webhook para sincronizar
    SELECT
      status,
      content::json
    INTO
      http_status,
      http_response
    FROM
      http((
        http_method,
        webhook_base_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        to_jsonb(payload)::text,
        5  -- 5 segundos timeout
      ));

    -- Registrar resposta nos logs
    RAISE LOG 'Brevo sync webhook para usuário %: status %, resposta %',
      NEW.email, http_status, http_response;

    -- Verificar resposta
    IF http_status >= 200 AND http_status < 300 THEN
      RAISE LOG 'Usuário TRIAL sincronizado com sucesso: %', NEW.email;
    ELSE
      RAISE WARNING 'Falha ao sincronizar usuário TRIAL %: status %, resposta %',
        NEW.email, http_status, http_response;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Capturar erros, mas não bloquear a operação principal
  RAISE WARNING 'Erro ao sincronizar usuário com Brevo: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_new_trial_user_to_brevo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_new_trial_user_to_brevo"() IS 'Sincroniza automaticamente novos usuários TRIAL com o Brevo';



CREATE OR REPLACE FUNCTION "public"."sync_trial_user_to_brevo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  response_status INT;
  response_content TEXT;
  edge_function_url TEXT := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook';
  auth_token TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bHhjcWFkZGVsd3hmdWtlcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMTc2NTksImV4cCI6MjA1NTU5MzY1OX0.YqQAdHMeGMmPAfKFtZPTovJ8szJi_iiUwkEnnLk1Cg8';
BEGIN
  -- Verificar se o status do usuário é TRIAL (verificar nos metadados)
  IF NEW.raw_user_meta_data->>'status' = 'TRIAL' OR NEW.raw_user_meta_data->>'status' IS NULL THEN
    -- Enviar para a Edge Function que sincroniza com o Brevo
    SELECT
      status, content
    INTO
      response_status, response_content
    FROM
      http((
        'POST',
        edge_function_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || auth_token)
        ],
        json_build_object(
          'email', NEW.email,
          'name', NEW.raw_user_meta_data->>'name',
          'status', COALESCE(NEW.raw_user_meta_data->>'status', 'TRIAL'),
          'id', NEW.id,
          'created_at', NEW.created_at
        )::text
      ));
    
    -- Registrar nos logs
    IF response_status >= 200 AND response_status < 300 THEN
      RAISE LOG 'Usuário TRIAL sincronizado com sucesso: % (status: %)', NEW.email, response_status;
    ELSE
      RAISE WARNING 'Falha ao sincronizar usuário TRIAL %: status %, resposta %',
        NEW.email, response_status, response_content;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Capturar erros para não interromper o fluxo principal
  RAISE WARNING 'Erro ao sincronizar usuário TRIAL com Brevo: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_trial_user_to_brevo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_trial_user_to_brevo"() IS 'Sincroniza automaticamente novos usuários TRIAL com o Brevo via Edge Function';



CREATE OR REPLACE FUNCTION "public"."sync_user_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{status}',
      to_jsonb(NEW.status)
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_status_to_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    auth_uid UUID;
    current_metadata JSONB;
BEGIN
    -- Obter o ID do usuário
    auth_uid := NEW.id;
    
    -- Atualizar os metadados do usuário no Auth
    -- Esta parte será executada pelo servidor Node.js, pois o PostgreSQL não tem acesso direto à API do Supabase Auth
    -- Mas podemos registrar que uma atualização é necessária
    
    -- Inserir ou atualizar um registro na tabela de sincronização
    INSERT INTO auth_sync_queue (user_id, status, processed)
    VALUES (auth_uid, NEW.status, FALSE)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = NEW.status,
        processed = FALSE,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_status_to_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_user_to_brevo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  r json;
  webhook_url text := 'https://aylxcqaddelwxfukerhr.supabase.co/functions/v1/user-webhook';
  http_method text := 'POST';
BEGIN
  -- Enviar dados para a Edge Function
  SELECT status, content::json INTO r
  FROM
    http((
      http_method,
      webhook_url,
      ARRAY[http_header('Content-Type', 'application/json')],
      json_build_object(
        'type', TG_OP, 
        'table', TG_TABLE_NAME, 
        'record', row_to_json(NEW)
      )::text
    ));

  -- Log para depuração
  RAISE LOG 'Enviado para webhook: % %', TG_OP, webhook_url;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Capturar erros, mas não bloquear a operação principal
  RAISE WARNING 'Erro ao enviar para webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_user_to_brevo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_sync_user_to_brevo"() IS 'Envia dados de usuários para a Edge Function Brevo quando há INSERT ou UPDATE';



CREATE OR REPLACE FUNCTION "public"."update_admins_table"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'ADMIN' THEN
        -- Insert the user into the admins table if they are set as admin
        INSERT INTO public.admins (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    ELSIF OLD.status = 'ADMIN' AND NEW.status != 'ADMIN' THEN
        -- Remove the user from the admins table if they are no longer admin
        DELETE FROM public.admins WHERE user_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_admins_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expired_trial_users"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Atualizar usuários TRIAL que passaram de 14 dias para INATIVO
  UPDATE users
  SET 
    status = 'INATIVO',
    updated_at = CURRENT_TIMESTAMP
  WHERE 
    status = 'TRIAL'
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '14 days'
  RETURNING (1) INTO updated_count;
    
  -- Registrar a execução e o número de usuários atualizados
  INSERT INTO system_logs (event_type, event_data)
  VALUES (
    'trial_expiration_check', 
    jsonb_build_object(
      'updated_users_count', COALESCE(updated_count, 0),
      'execution_time', CURRENT_TIMESTAMP
    )
  );
  
  -- Adicionar usuários atualizados à fila de sincronização de metadados do auth
  -- Usando ON CONFLICT para atualizar registros existentes em vez de falhar
  INSERT INTO auth_sync_queue (user_id, status, processed)
  SELECT id, 'INATIVO', FALSE
  FROM users
  WHERE 
    status = 'INATIVO'
    AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    processed = FALSE,
    updated_at = CURRENT_TIMESTAMP;
END;
$$;


ALTER FUNCTION "public"."update_expired_trial_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_new_status" "text", "p_admin_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_admin_status text;
  v_user_record record;
  v_result jsonb;
BEGIN
  -- Check if requesting user is admin
  SELECT status INTO v_admin_status
  FROM users
  WHERE id = p_admin_id;

  IF v_admin_status IS NULL OR v_admin_status != 'ADMIN' THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Check if status is valid
  IF p_new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  -- Get current user record
  SELECT * INTO v_user_record
  FROM users
  WHERE id = p_user_id;

  IF v_user_record IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  -- Update user status
  UPDATE users
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING jsonb_build_object(
    'id', id,
    'email', email,
    'status', status,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_new_status" "text", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_users_last_sign_in"() RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar last_sign_in_at para todos os usuários que não têm esse dado preenchido
    UPDATE public.users
    SET last_sign_in_at = updated_at
    WHERE last_sign_in_at IS NULL;
    
    -- Obter o número de linhas afetadas
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Retornar resultado como JSON
    RETURN json_build_object(
        'success', true,
        'message', 'Atualização concluída com sucesso',
        'updated_count', updated_count
    );
END;
$$;


ALTER FUNCTION "public"."update_users_last_sign_in"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_status_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verificar se o novo status é válido
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('ADMIN', 'ATIVO', 'INATIVO', 'TRIAL') THEN
    RAISE EXCEPTION 'Status inválido: %. Os valores permitidos são: ADMIN, ATIVO, INATIVO, TRIAL', NEW.status;
  END IF;

  -- Verificar se o usuário está tentando se tornar ADMIN
  IF NEW.status = 'ADMIN' AND (OLD.status IS NULL OR OLD.status != 'ADMIN') THEN
    -- Verificar se o usuário atual é um admin
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem definir o status para ADMIN';
    END IF;
  END IF;

  -- Se o usuário já é ADMIN, verificar se não está sendo alterado por um não-admin
  IF OLD.status = 'ADMIN' AND NEW.status != 'ADMIN' THEN
    -- Verificar se o usuário atual é um admin
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND status = 'ADMIN'
    ) THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o status de um administrador';
    END IF;
  END IF;

  -- Para usuários novos, definir o status inicial como TRIAL
  IF TG_OP = 'INSERT' AND (NEW.status IS NULL OR NEW.status = 'INATIVO') THEN
    NEW.status := 'TRIAL';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_status_update"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" "json",
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text"
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" integer NOT NULL,
    "operation" character varying(255) NOT NULL,
    "target_table" character varying(255) NOT NULL,
    "record_id" "uuid" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."admin_audit_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."admin_audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."admin_audit_log_id_seq" OWNED BY "public"."admin_audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."admins" (
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_sync_queue" (
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."auth_sync_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "template_id" "uuid",
    "sequence_id" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(50) NOT NULL,
    "error_message" "text",
    "email_to" character varying(255) NOT NULL,
    "subject" character varying(255) NOT NULL
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_sequences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "template_id" "uuid",
    "days_after_signup" integer NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "send_type" character varying DEFAULT 'DAYS_AFTER_SIGNUP'::character varying NOT NULL,
    "send_hour" integer DEFAULT 8
);


ALTER TABLE "public"."email_sequences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."email_sequences"."send_type" IS 'Tipo de envio: DAYS_AFTER_SIGNUP ou AFTER_FIRST_LOGIN';



COMMENT ON COLUMN "public"."email_sequences"."send_hour" IS 'Hora do dia para enviar o email (0-23)';



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "subject" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sendpulse_lists" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "external_id" character varying(50) NOT NULL,
    "description" "text",
    "status" character varying(20) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sendpulse_lists" OWNER TO "postgres";


COMMENT ON TABLE "public"."sendpulse_lists" IS 'Armazena as listas de emails do SendPulse';



CREATE SEQUENCE IF NOT EXISTS "public"."sendpulse_lists_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."sendpulse_lists_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sendpulse_lists_id_seq" OWNED BY "public"."sendpulse_lists"."id";



CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" integer NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."system_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."system_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."system_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."system_logs_id_seq" OWNED BY "public"."system_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "status" "public"."user_status" DEFAULT 'INATIVO'::"public"."user_status",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "favorite_radios" "text"[] DEFAULT '{}'::"text"[],
    "stripe_customer_id" "text",
    "subscription_id" "text",
    "payment_status" "text",
    "last_payment_date" timestamp with time zone,
    "whatsapp" "text",
    "first_login_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    CONSTRAINT "check_valid_status" CHECK (("status" = ANY (ARRAY['ADMIN'::"public"."user_status", 'ATIVO'::"public"."user_status", 'INATIVO'::"public"."user_status", 'TRIAL'::"public"."user_status"]))),
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['ADMIN'::"public"."user_status", 'ATIVO'::"public"."user_status", 'INATIVO'::"public"."user_status", 'TRIAL'::"public"."user_status"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."first_login_at" IS 'Data e hora do primeiro login após confirmação de email';



COMMENT ON COLUMN "public"."users"."last_sign_in_at" IS 'Armazena a data e hora do último login do usuário';



COMMENT ON CONSTRAINT "check_valid_status" ON "public"."users" IS 'Verifica se o status do usuário é válido: ADMIN, ATIVO, INATIVO ou TRIAL';



COMMENT ON CONSTRAINT "users_status_check" ON "public"."users" IS 'Verifica se o status do usuário é válido: ADMIN, ATIVO, INATIVO ou TRIAL';



CREATE OR REPLACE VIEW "public"."user_profiles" AS
 SELECT "u"."id",
    "u"."email",
    "u"."status",
    "u"."created_at",
    "u"."updated_at"
   FROM "public"."users" "u";


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sendpulse_lists" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sendpulse_lists_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."system_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."system_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."auth_sync_queue"
    ADD CONSTRAINT "auth_sync_queue_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_sequences"
    ADD CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendpulse_lists"
    ADD CONSTRAINT "sendpulse_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "idx_email_logs_sent_at" ON "public"."email_logs" USING "btree" ("sent_at");



CREATE INDEX "idx_email_logs_sequence_id" ON "public"."email_logs" USING "btree" ("sequence_id");



CREATE INDEX "idx_email_logs_status" ON "public"."email_logs" USING "btree" ("status");



CREATE INDEX "idx_email_logs_template_id" ON "public"."email_logs" USING "btree" ("template_id");



CREATE INDEX "idx_email_logs_user_id" ON "public"."email_logs" USING "btree" ("user_id");



CREATE INDEX "idx_email_sequences_active" ON "public"."email_sequences" USING "btree" ("active");



CREATE INDEX "idx_email_templates_active" ON "public"."email_templates" USING "btree" ("active");



CREATE INDEX "idx_users_stripe_customer_id" ON "public"."users" USING "btree" ("stripe_customer_id");



CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "on_auth_user_updated" AFTER UPDATE ON "auth"."users" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_user_update"();



CREATE OR REPLACE TRIGGER "trigger_sync_trial_user_to_brevo" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_trial_user_to_brevo"();



CREATE OR REPLACE TRIGGER "trigger_sync_users_to_brevo" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_user_to_brevo"();



CREATE OR REPLACE TRIGGER "sync_auth_metadata_trigger" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_auth_metadata_to_profile"();



CREATE OR REPLACE TRIGGER "sync_user_status_to_auth" AFTER UPDATE OF "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_status_to_auth"();



CREATE OR REPLACE TRIGGER "sync_user_status_trigger" AFTER UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_status"();



CREATE OR REPLACE TRIGGER "update_admins_trigger" AFTER UPDATE OF "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_admins_table"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_insert_trigger" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_user_status"();



CREATE OR REPLACE TRIGGER "validate_status_trigger" BEFORE INSERT OR UPDATE OF "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."validate_status_update"();



CREATE OR REPLACE TRIGGER "validate_status_update" BEFORE UPDATE OF "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."validate_status_update"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_sequences"
    ADD CONSTRAINT "email_sequences_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow admins to delete records" ON "public"."users" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."status" = 'ADMIN'::"public"."user_status")))));



CREATE POLICY "Allow admins to update any record" ON "public"."users" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."status" = 'ADMIN'::"public"."user_status")))));



CREATE POLICY "Allow all users to view all records" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow users to update own record" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Usuários autenticados podem atualizar seus dados" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND (("status" = ANY (ARRAY['ADMIN'::"public"."user_status", 'ATIVO'::"public"."user_status", 'INATIVO'::"public"."user_status", 'TRIAL'::"public"."user_status"])) AND ((("status" = 'ADMIN'::"public"."user_status") AND (EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."status" = 'ADMIN'::"public"."user_status"))))) OR ("status" <> 'ADMIN'::"public"."user_status")))));



CREATE POLICY "admin_manage_sequences" ON "public"."email_sequences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."status" = 'ADMIN'::"public"."user_status")))));



CREATE POLICY "admin_manage_templates" ON "public"."email_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."status" = 'ADMIN'::"public"."user_status")))));



CREATE POLICY "admin_view_all_logs" ON "public"."email_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."status" = 'ADMIN'::"public"."user_status")))));



ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_view_own_logs" ON "public"."email_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_read_own_stripe_data" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_status_policy" ON "public"."users" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."status" = 'ADMIN'::"public"."user_status"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."status" = 'ADMIN'::"public"."user_status")))) AND ("status" = ANY (ARRAY['ADMIN'::"public"."user_status", 'ATIVO'::"public"."user_status", 'INATIVO'::"public"."user_status", 'TRIAL'::"public"."user_status"]))));



CREATE POLICY "users_update_stripe_data" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT ALL ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM "postgres";
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "postgres" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM "postgres";
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "postgres" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "public"."add_favorite_radios_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_favorite_radios_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_favorite_radios_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."alter_users_add_favorite_radios"() TO "anon";
GRANT ALL ON FUNCTION "public"."alter_users_add_favorite_radios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."alter_users_add_favorite_radios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_admin_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_admin_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_admin_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_auth_sync_queue_structure"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_auth_sync_queue_structure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_auth_sync_queue_structure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("sql_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql_query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_pending_emails"("p_current_hour" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_pending_emails"("p_current_hour" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_emails"("p_current_hour" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_emails"("p_current_hour" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sendpulse_list_id"("user_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sendpulse_list_id"("user_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sendpulse_list_id"("user_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_user_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_user_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_user_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_auth_metadata_to_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_auth_metadata_to_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_auth_metadata_to_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_new_trial_user_to_brevo"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_new_trial_user_to_brevo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_new_trial_user_to_brevo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_trial_user_to_brevo"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_trial_user_to_brevo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_trial_user_to_brevo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_status_to_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_status_to_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_status_to_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_user_to_brevo"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_user_to_brevo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_user_to_brevo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_admins_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_admins_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_admins_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_expired_trial_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_expired_trial_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_expired_trial_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_new_status" "text", "p_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_new_status" "text", "p_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_new_status" "text", "p_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_users_last_sign_in"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_users_last_sign_in"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_users_last_sign_in"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_status_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_status_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_status_update"() TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."schema_migrations" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."schema_migrations" TO "postgres";
GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."admins" TO "anon";
GRANT ALL ON TABLE "public"."admins" TO "authenticated";
GRANT ALL ON TABLE "public"."admins" TO "service_role";



GRANT ALL ON TABLE "public"."auth_sync_queue" TO "anon";
GRANT ALL ON TABLE "public"."auth_sync_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_sync_queue" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."email_sequences" TO "anon";
GRANT ALL ON TABLE "public"."email_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."email_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."sendpulse_lists" TO "anon";
GRANT ALL ON TABLE "public"."sendpulse_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."sendpulse_lists" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sendpulse_lists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sendpulse_lists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sendpulse_lists_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."system_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."system_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."system_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."system_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT INSERT ON TABLE "public"."users" TO PUBLIC;



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES  TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS  TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES  TO "dashboard_user";












ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
