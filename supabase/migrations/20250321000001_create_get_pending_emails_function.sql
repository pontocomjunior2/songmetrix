-- Função para obter emails pendentes para processamento
CREATE OR REPLACE FUNCTION public.get_pending_emails()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  full_name VARCHAR,
  sequence_id UUID,
  template_id UUID,
  subject VARCHAR,
  body TEXT
) LANGUAGE sql SECURITY DEFINER
AS $$
  WITH active_sequences AS (
    SELECT 
      seq.id as sequence_id,
      seq.template_id,
      seq.days_after_signup,
      temp.subject,
      temp.body
    FROM 
      public.email_sequences seq
      JOIN public.email_templates temp ON seq.template_id = temp.id
    WHERE 
      seq.active = true 
      AND temp.active = true
  )
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    s.sequence_id,
    s.template_id,
    s.subject,
    s.body
  FROM 
    public.users u
    CROSS JOIN active_sequences s
  WHERE 
    u.status IN ('ATIVO', 'TRIAL', 'ADMIN')
    AND u.email_confirmed_at IS NOT NULL
    AND EXTRACT(DAY FROM NOW() - u.created_at) >= s.days_after_signup
    AND NOT EXISTS (
      SELECT 1 FROM public.email_logs l
      WHERE l.user_id = u.id
      AND l.sequence_id = s.sequence_id
    )
  LIMIT 100;
$$;

-- Permissões da função
REVOKE ALL ON FUNCTION public.get_pending_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_emails() TO service_role; 