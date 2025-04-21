// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts'; // Arquivo compartilhado para headers CORS

// Interface para o usuário do banco (opcional, mas bom para clareza)
interface DbUser {
  id: string;
  created_at: string; // Vem como string ISO 8601
  plan_id: string;
}

console.log("Função 'expire-trials' iniciada.");

Deno.serve(async (req) => {
  // Tratar requisição OPTIONS para CORS (necessário para invocação manual, se houver)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase usando variáveis de ambiente (disponíveis em Edge Functions)
    // Certifique-se de ter SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY configuradas nos segredos da função no dashboard Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('Cliente Supabase Admin criado.');

    const now = new Date();
    const trialDurationDays = 14; // Definir duração do trial

    console.log(`Buscando usuários com plan_id = 'TRIAL' no banco...`);

    // 1. Buscar usuários TRIAL no banco de dados
    const { data: trialUsers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, created_at, plan_id')
      .eq('plan_id', 'TRIAL') as { data: DbUser[] | null, error: any }; // Type assertion

    if (fetchError) {
      console.error('Erro ao buscar usuários TRIAL:', fetchError);
      throw fetchError;
    }

    if (!trialUsers || trialUsers.length === 0) {
      console.log('Nenhum usuário TRIAL encontrado.');
      return new Response(JSON.stringify({ message: 'Nenhum usuário TRIAL encontrado para processar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Encontrados ${trialUsers.length} usuários TRIAL. Verificando expiração...`);

    const expiredUserIds: string[] = [];
    const updateErrors: { userId: string; error: any }[] = [];

    // 2. Iterar e verificar expiração
    for (const user of trialUsers) {
      const createdAt = new Date(user.created_at);
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log(`Usuário ${user.id}: Criado em ${createdAt.toISOString()}, ${diffDays} dias atrás.`);

      if (diffDays > trialDurationDays) {
        console.log(`-> Trial expirado para ${user.id}. Atualizando para FREE.`);
        expiredUserIds.push(user.id);

        // 3. Atualizar para FREE (em paralelo para otimizar)
        try {
          // a) Atualizar tabela 'users'
          const { error: dbUpdateError } = await supabaseAdmin
            .from('users')
            .update({ plan_id: 'FREE', updated_at: now.toISOString() })
            .eq('id', user.id);

          if (dbUpdateError) throw new Error(`Erro DB: ${dbUpdateError.message}`);
          console.log(` -> Tabela 'users' atualizada para ${user.id}`);

          // b) Atualizar metadados Auth
          // Primeiro, buscar metadados atuais para não sobrescrever outras informações
          const { data: authUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user.id);
          if (getUserError) throw new Error(`Erro ao buscar Auth User: ${getUserError.message}`);

          const currentMetadata = authUserData?.user?.user_metadata ?? {};
          const newMetadata = { ...currentMetadata, plan_id: 'FREE' };

          const { error: metaUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { user_metadata: newMetadata }
          );

          if (metaUpdateError) throw new Error(`Erro Auth Meta: ${metaUpdateError.message}`);
          console.log(` -> Metadados Auth atualizados para ${user.id}`);

        } catch (updateError) {
            console.error(`Erro ao atualizar usuário ${user.id} para FREE:`, updateError);
            updateErrors.push({ userId: user.id, error: updateError.message });
            // Continuar processando outros usuários mesmo se um falhar
        }
      } else {
         console.log(` -> Trial ainda ativo para ${user.id}.`);
      }
    }

    console.log('Processamento de expiração concluído.');

    return new Response(
      JSON.stringify({
        message: 'Processamento de expiração de trial concluído.',
        totalChecked: trialUsers.length,
        totalExpired: expiredUserIds.length,
        updatedUsers: expiredUserIds.filter(id => !updateErrors.some(e => e.userId === id)),
        errors: updateErrors,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro geral na função expire-trials:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/expire-trials' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
