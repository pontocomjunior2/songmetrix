#!/usr/bin/env node

/**
 * Script para testar envio direto sem passar pela API
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testDirectSend() {
  try {
    console.log('📧 Testando envio direto...\n');

    // 1. Buscar um insight aprovado
    console.log('📋 Buscando insight aprovado...');
    
    const { data: insights, error: fetchError } = await supabaseAdmin
      .from('generated_insight_emails')
      .select(`
        *,
        users (
          email,
          full_name
        )
      `)
      .eq('status', 'approved')
      .limit(1);

    if (fetchError || !insights || insights.length === 0) {
      console.error('❌ Nenhum insight aprovado encontrado');
      return;
    }

    const insight = insights[0];
    console.log('✅ Insight encontrado:', insight.id);
    console.log('   Destinatário:', insight.users?.email);
    console.log('   Assunto:', insight.subject);

    // 2. Importar e testar o serviço diretamente
    console.log('\n📦 Importando serviço de e-mail...');
    const { sendEmail } = await import('../server/smtp-email-service.js');
    console.log('✅ Serviço importado!');

    // 3. Enviar e-mail diretamente
    console.log('\n📤 Enviando e-mail diretamente...');
    
    const emailResult = await sendEmail({
      to: insight.users.email,
      subject: insight.subject,
      html: insight.body_html || insight.content || '<p>Conteúdo não disponível</p>',
      user_id: insight.user_id,
      email_type: 'insight',
      insight_id: insight.id
    });

    console.log('Resultado do envio:', emailResult);

    if (emailResult.success) {
      console.log('✅ E-mail enviado com sucesso!');
      console.log('Message ID:', emailResult.messageId);
      
      // Atualizar status no banco
      const { error: updateError } = await supabaseAdmin
        .from('generated_insight_emails')
        .update({ 
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', insight.id);

      if (updateError) {
        console.error('⚠️  Erro ao atualizar status:', updateError.message);
      } else {
        console.log('✅ Status atualizado para "sent"');
      }

    } else {
      console.log('❌ Falha no envio:', emailResult.error);
    }

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testDirectSend().then(() => {
  console.log('\n🏁 Teste direto concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});