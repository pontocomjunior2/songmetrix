-- Create function to update user status
CREATE OR REPLACE FUNCTION update_user_status(p_user_id uuid, p_status text)
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    -- Validate status
    IF p_status NOT IN ('ADMIN', 'ATIVO', 'INATIVO') THEN
        RAISE EXCEPTION 'Invalid status value';
    END IF;

    -- Update user status
    UPDATE users
    SET status = p_status
    WHERE id = p_user_id
    RETURNING json_build_object(
        'id', id,
        'status', status,
        'updated_at', updated_at
    ) INTO v_result;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;
