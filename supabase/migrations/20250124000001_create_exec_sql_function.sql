-- Migration: Create exec_sql function for dynamic SQL execution
-- This function allows executing SQL commands via RPC calls

CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Execute the SQL query
  EXECUTE sql_query;
  
  -- Return success message
  RETURN 'SQL executed successfully';
EXCEPTION
  WHEN OTHERS THEN
    -- Return error message
    RETURN 'Error: ' || SQLERRM;
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM public;

-- Add comment for documentation
COMMENT ON FUNCTION public.exec_sql(text) IS 
'Function to execute dynamic SQL queries via RPC. Only accessible to service_role for security.';