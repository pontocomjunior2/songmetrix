-- Add Stripe-related columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS subscription_id text,
ADD COLUMN IF NOT EXISTS payment_status text,
ADD COLUMN IF NOT EXISTS last_payment_date timestamp with time zone;

-- Add index for stripe_customer_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Add policy to allow users to view their own Stripe data
CREATE POLICY "users_read_own_stripe_data" ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Add policy to allow system to update Stripe data
CREATE POLICY "users_update_stripe_data" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);