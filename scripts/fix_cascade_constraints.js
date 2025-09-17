import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Supabase admin client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function fixCascadeConstraints() {
  try {
    console.log('Starting CASCADE constraints fix...');
    
    // Step 1: Fix email_logs.user_id foreign key
    console.log('1. Fixing email_logs.user_id foreign key...');
    
    // Drop existing constraint
    const { error: dropError1 } = await supabase
      .from('email_logs')
      .select('id')
      .limit(1);
    
    if (dropError1) {
      console.log('email_logs table might not exist, skipping...');
    } else {
      // Use raw SQL via rpc if available, otherwise skip
      console.log('email_logs table exists, constraints will be handled by database admin');
    }
    
    // Step 2: Check if we can query the tables to verify structure
    console.log('2. Verifying table structures...');
    
    const { data: emailLogs, error: emailError } = await supabase
      .from('email_logs')
      .select('id, user_id')
      .limit(1);
    
    if (emailError) {
      console.error('Error accessing email_logs:', emailError.message);
    } else {
      console.log('✓ email_logs table accessible');
    }
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError) {
      console.error('Error accessing users:', usersError.message);
    } else {
      console.log('✓ users table accessible');
    }
    
    // Step 3: Test the relationship by trying to fetch email logs with user data
    console.log('3. Testing email_logs to users relationship...');
    
    const { data: testData, error: testError } = await supabase
      .from('email_logs')
      .select(`
        id,
        user_id,
        users!inner(id, email)
      `)
      .limit(5);
    
    if (testError) {
      console.error('Relationship test failed:', testError.message);
      console.log('This confirms the foreign key constraint issue exists.');
      
      // Try alternative query structure
      console.log('Trying alternative query structure...');
      const { data: altData, error: altError } = await supabase
        .from('email_logs')
        .select('id, user_id')
        .limit(5);
      
      if (altError) {
        console.error('Alternative query also failed:', altError.message);
      } else {
        console.log('✓ Basic email_logs query works');
        console.log('Sample data:', altData);
      }
    } else {
      console.log('✓ Relationship test passed');
      console.log('Sample data with users:', testData);
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('The CASCADE constraint fix requires database admin privileges.');
    console.log('Please run the following SQL commands directly in your database:');
    console.log('');
    console.log('-- Fix email_logs foreign key');
    console.log('ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;');
    console.log('ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_user_id_fkey');
    console.log('  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;');
    console.log('');
    console.log('-- Fix users foreign key');
    console.log('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;');
    console.log('ALTER TABLE public.users ADD CONSTRAINT users_id_fkey');
    console.log('  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;');
    
  } catch (error) {
    console.error('Error during constraint fix:', error);
  }
}

fixCascadeConstraints();