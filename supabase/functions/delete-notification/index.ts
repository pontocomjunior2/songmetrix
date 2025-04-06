import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS', // Permitir DELETE
}

console.log(`Function 'delete-notification' up and running!`);

serve(async (req) => {
  // Tratar OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verificar se é DELETE
  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    // --- Autenticação (igual create-notification) ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Cabeçalho Authorization ausente ou inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwt = authHeader.replace('Bearer ', '');

    const supabaseClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('CUSTOM_SUPABASE_ANON_KEY') ?? '', 
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth Error:', authError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado ou token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // --- Fim Autenticação ---

    // Cliente Admin
    const supabaseAdmin: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verificar Admin (igual create-notification)
    const { data: adminCheck, error: adminCheckError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminCheckError || !adminCheck) {
        if(adminCheckError) console.error('Admin Check Error:', adminCheckError);
        else console.warn(`Tentativa de DELETE não autorizada por user: ${user.id}`);
        return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Obter ID da notificação do CORPO da requisição
    let notificationId: string | undefined;
    try {
        const body = await req.json();
        notificationId = body?.id; // Espera { "id": "..." }
    } catch (parseError) {
        console.error('Body Parse Error:', parseError);
        // Retorna erro se o corpo não for JSON ou não tiver 'id'
    }
    
    if (!notificationId || typeof notificationId !== 'string') {
        return new Response(JSON.stringify({ error: 'ID da notificação ausente ou inválido no corpo da requisição' }), {
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Validar se é um UUID (opcional mas bom)
    // TODO: Adicionar validação de UUID se necessário

    // Deletar a notificação usando cliente Admin
    const { error: deleteError } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (deleteError) {
        console.error('Delete Error:', deleteError);
        return new Response(JSON.stringify({ error: 'Falha ao deletar notificação', details: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Retornar sucesso sem conteúdo
    return new Response(null, { 
        status: 204, // No Content
        headers: corsHeaders 
    });

  } catch (error) {
    console.error('Unhandled Error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}) 