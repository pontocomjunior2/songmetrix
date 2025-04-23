import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' }); // Ajuste o caminho se necessário

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixExpiredTrialMetadata() {
  console.log('Iniciando busca por usuários com plan_id legado...');
  let usersProcessed = 0;
  let usersUpdated = 0;
  let page = 0;
  const pageSize = 100; // Ajuste conforme necessidade/limites

  try {
    while (true) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: page + 1, // API é 1-based
        perPage: pageSize
      });

      if (listError) {
        console.error(`Erro ao listar usuários (página ${page + 1}):`, listError);
        break;
      }

      if (!users || users.length === 0) {
        console.log('Nenhum usuário restante para verificar.');
        break; // Sai do loop se não houver mais usuários
      }

      console.log(`Processando página ${page + 1} (${users.length} usuários)...`);

      for (const user of users) {
        usersProcessed++;
        const userId = user.id;
        const currentMetadata = user.user_metadata || {};
        const currentPlanId = currentMetadata.plan_id;

        console.log(`[DEBUG] User: ${userId}, Metadata plan_id encontrado: '${currentPlanId}' (Tipo: ${typeof currentPlanId})`);

        // Verifique todos os possíveis valores legados de trial expirado
        const legacyExpiredValues = ['expired_trial', 'trial_expired']; // Garanta minúsculas

        // --- MODIFICAÇÃO AQUI ---
        // Converter para minúsculas ANTES de verificar a inclusão
        const planIdLower = currentPlanId ? currentPlanId.trim().toLowerCase() : null;

        if (planIdLower && legacyExpiredValues.includes(planIdLower)) {
        // --- FIM DA MODIFICAÇÃO ---

          console.log(`Usuário ${userId} encontrado com plan_id legado: ${currentPlanId}. Atualizando para FREE...`);
          const newMetadata = { ...currentMetadata, plan_id: 'FREE' };
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: newMetadata }
          );

          if (updateError) {
            console.error(`Erro ao atualizar metadados para ${userId}:`, updateError);
          } else {
            console.log(`Metadados para ${userId} atualizados para FREE com sucesso.`);
            usersUpdated++;
          }
        }
        // OPCIONAL: Tratar usuários com plan_id undefined (Tipo: undefined)
        else if (typeof currentPlanId === 'undefined') {
            console.log(`Usuário ${userId} tem plan_id UNDEFINED. Atualizando para FREE...`);
            // Você pode decidir definir esses também como FREE
            const newMetadata = { ...currentMetadata, plan_id: 'FREE' };
             const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { user_metadata: newMetadata }
            );
            if (updateError) {
                console.error(`Erro ao definir metadados como FREE para ${userId} (plan_id undefined):`, updateError);
            } else {
                console.log(`Metadados para ${userId} (plan_id undefined) definidos como FREE com sucesso.`);
                usersUpdated++; // Incrementar aqui também se decidir atualizar
            }
        }
      }
      page++; // Vai para a próxima página
    }
  } catch (error) {
    console.error('Erro inesperado durante a correção:', error);
  } finally {
    console.log(`--- Resumo da Correção ---`);
    console.log(`Usuários verificados: ${usersProcessed}`);
    console.log(`Usuários atualizados: ${usersUpdated}`);
    console.log('--------------------------');
  }
}

fixExpiredTrialMetadata();
