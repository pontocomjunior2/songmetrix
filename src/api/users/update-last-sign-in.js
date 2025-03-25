// Endpoint para atualizar o campo last_sign_in_at para todos os usuários
import { createClient } from '@supabase/supabase-js';

// Configuração do cliente Supabase com variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Criar cliente Supabase com chave de serviço (service role key)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // Verificar se a requisição é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar autenticação do usuário
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar se o usuário é administrador
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('status')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.status !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' });
    }

    // Executar a atualização do campo last_sign_in_at
    const { data, error: updateError } = await supabase.rpc('update_users_last_sign_in');

    if (updateError) {
      console.error('Erro ao atualizar last_sign_in_at:', updateError);
      return res.status(500).json({ error: `Erro ao atualizar dados: ${updateError.message}` });
    }

    // Contar quantos registros foram atualizados
    const { count, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .not('last_sign_in_at', 'is', null);

    if (countError) {
      console.error('Erro ao contar registros atualizados:', countError);
      return res.status(200).json({ success: true, message: 'Dados de último acesso atualizados com sucesso' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Dados de último acesso atualizados com sucesso',
      count: count 
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
  }
} 