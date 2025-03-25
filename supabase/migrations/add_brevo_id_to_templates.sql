-- Add id_brevo column to email_templates
ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS id_brevo INTEGER;

-- Add comment for new column
COMMENT ON COLUMN public.email_templates.id_brevo IS 'ID do template no Brevo'; 