import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.23.4/mod.ts'

// Headers CORS - ajuste a origem conforme necessário para produção
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Ou seu domínio frontend: 'http://localhost:5173'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Esquema Zod para validação (similar ao da action/form)
const notificationSchema = z.object({
  title: z.string().min(5).max(100),
  message: z.union([
    z.string().length(0),
    z.string().min(10).max(500)
  ]).optional().nullable(),
  target_audience: z.enum(['all', 'specific_role', 'specific_user_ids']).default('all'),
  target_details: z.string().optional().nullable(), // String ou JSON stringified
  scheduled_at: z.string().datetime({ offset: true }).optional().nullable(),
});

console.log(`Function 'create-notification' up and running!`);

serve(async (req) => {
  // Tratar requisição OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verificar se é POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    // --- Autenticação Explícita --- 
    // 1. Extrair JWT do header Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Cabeçalho Authorization ausente ou inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwt = authHeader.replace('Bearer ', '');

    // 2. Criar cliente Supabase com o JWT do usuário (usando CUSTOM_SUPABASE_ANON_KEY)
    const supabaseClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('CUSTOM_SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { 
            persistSession: false, 
            autoRefreshToken: false,
            detectSessionInUrl: false 
        }
      }
    );

    // 3. Verificar o usuário usando o cliente com contexto JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth Error:', authError);
      // Log adicional para depuração
      console.error('JWT recebido (primeiros/últimos 10 chars):', `${jwt.substring(0, 10)}...${jwt.substring(jwt.length - 10)}`); 
      return new Response(JSON.stringify({ error: 'Usuário não autenticado ou token inválido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    // --- Fim Autenticação Explícita ---

    // 4. Criar cliente Supabase Admin (com SERVICE_ROLE_KEY) para operações privilegiadas
    const supabaseAdmin: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );

    // 5. Validar o corpo da requisição (usando Zod)
    let payload;
    try {
      const body = await req.json();
      payload = notificationSchema.parse(body);
    } catch (validationError) {
      console.error('Validation Error:', validationError.errors);
      return new Response(JSON.stringify({ error: 'Dados inválidos', details: validationError.errors }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 6. Verificar se o usuário autenticado (user.id) é admin (usando supabaseAdmin)
    const { data: adminCheck, error: adminCheckError } = await supabaseAdmin
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminCheckError) {
      console.error('Admin Check Error:', adminCheckError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissão de admin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!adminCheck) {
      console.warn(`Tentativa de acesso não autorizado por user: ${user.id}`);
      return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403, // Forbidden
      });
    }

    // 7. Preparar dados para inserção (lógica de targetDetailsJsonb como antes)
    let targetDetailsJsonb: unknown | null = null;
    if (payload.target_audience === 'specific_user_ids' && payload.target_details) {
      try {
        const ids = payload.target_details.split(',').map(id => id.trim()).filter(id => id);
        targetDetailsJsonb = ids;
      } catch (e) {
        console.error("Erro ao parsear target_details para user_ids:", e);
        targetDetailsJsonb = null; 
      }
    } else if (payload.target_audience === 'specific_role' && payload.target_details) {
        targetDetailsJsonb = { role: payload.target_details };
    }

    const notificationData = {
      title: payload.title,
      message: payload.message,
      target_audience: payload.target_audience,
      target_details: targetDetailsJsonb,
      scheduled_at: payload.scheduled_at,
      created_by: user.id,
    };

    // 8. Inserir no banco de dados (usando supabaseAdmin)
    const { data: newNotification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (insertError) {
      console.error('Insert Error:', insertError);
      return new Response(JSON.stringify({ error: 'Falha ao salvar notificação', details: insertError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 9. Retornar sucesso
    return new Response(JSON.stringify(newNotification), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201, // Created
    })

  } catch (error) {
    console.error('Unhandled Error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 