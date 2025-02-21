import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Simplified authentication middleware
export const authenticateBasicUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No Bearer token provided');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('Verifying token:', token.substring(0, 10) + '...');
    
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Get user status directly from metadata
    const userStatus = user.user_metadata?.status;
    console.log('User status from metadata:', userStatus);

    if (!userStatus || (userStatus !== 'ADMIN' && userStatus !== 'ATIVO')) {
      console.log('Invalid user status:', userStatus);
      return res.status(403).json({ 
        error: 'Usuário inativo',
        code: 'inactive_user'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Protected routes middleware
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Get user status directly from metadata
    const userStatus = user.user_metadata?.status;

    if (!userStatus || (userStatus !== 'ADMIN' && userStatus !== 'ATIVO')) {
      return res.status(403).json({ 
        error: 'Assinatura necessária',
        code: 'subscription_required'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};
