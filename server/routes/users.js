import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateBasicUser } from '../auth-middleware.js';

const router = express.Router();

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

// Rota para registrar usuário (criação ou atualização na tabela users)
router.post('/register', async (req, res) => {
  try {
    const { id, email, status, full_name, whatsapp } = req.body;
    
    if (!id || !email) {
      return res.status(400).json({ error: 'ID e email são obrigatórios' });
    }
    
    // Criar ou atualizar o registro na tabela users usando o cliente admin
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        id,
        email,
        status: status || 'TRIAL',
        full_name,
        whatsapp,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao criar/atualizar registro do usuário:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Registro do usuário criado/atualizado com sucesso na tabela users');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro no processamento da requisição:', error);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Rota para obter todos os usuários (ADMIN)
router.get('/', authenticateBasicUser, async (req, res) => {
  // Verificar se o usuário é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente)
});

// Rota para atualizar status/plano do usuário (ADMIN)
router.put('/:id/status', authenticateBasicUser, async (req, res) => {
  // Verificar se o requisitante é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente - usar { plan_id: newStatus } na atualização)
});

// Rota para remover usuário (ADMIN)
router.post('/remove', authenticateBasicUser, async (req, res) => {
  // Verificar se o requisitante é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente)
});

// Rota para atualizar last_sign_in (ADMIN)
router.post('/update-last-sign-in', authenticateBasicUser, async (req, res) => {
  // Verificar se o requisitante é ADMIN
  if (req.user?.planId !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  // ... (lógica existente)
});

export default router; 