-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_user_status(uuid, text, uuid);

-- Create function to update user status
CREATE OR REPLACE FUNCTION update_user_status(
  p_user_id uuid,
  p_new_status text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  IF p_new_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO') THEN
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;
