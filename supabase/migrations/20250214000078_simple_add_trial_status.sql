-- Adicionar o valor TRIAL ao enum user_status de forma segura
DO $$
BEGIN
    -- Verificar se o valor TRIAL já existe no enum
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'TRIAL'
        AND enumtypid = (
            SELECT oid
            FROM pg_type
            WHERE typname = 'user_status'
        )
    ) THEN
        -- Adicionar o valor TRIAL ao enum
        ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'TRIAL';
    END IF;
END $$; 