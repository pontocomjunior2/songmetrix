#!/usr/bin/env node

/**
 * Script para testar o serviço de e-mail diretamente
 */

import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

async function testEmailService() {
  try {
    console.log('📧 Testando serviço de e-mail...\n');

    // Verificar se as variáveis de ambiente estão definidas
    console.log('🔧 Verificando configurações SMTP...');
    console.log('SMTP_HOST:', process.env.SMTP_HOST ? '✅ Definido' : '❌ Não definido');
    console.log('SMTP_PORT:', process.env.SMTP_PORT ? '✅ Definido' : '❌ Não definido');
    console.log('SMTP_USER:', process.env.SMTP_USER ? '✅ Definido' : '❌ Não definido');
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✅ Definido (oculto)' : '❌ Não definido');

    // Tentar importar o serviço
    console.log('\n📦 Importando serviço de e-mail...');
    const { sendEmail } = await import('../server/smtp-email-service.js');
    console.log('✅ Serviço importado com sucesso!');

    // Testar envio
    console.log('\n📤 Testando envio de e-mail...');
    const emailResult = await sendEmail({
      to: 'junior@pontocomaudio.net',
      subject: 'Teste do Serviço de E-mail',
      html: '<h1>Teste</h1><p>Este é um teste do serviço de e-mail.</p>',
      user_id: '59ad79e3-9510-440c-bfc2-d10f48c8e276',
      email_type: 'test',
      insight_id: 'test-123'
    });

    console.log('Resultado do envio:', emailResult);

    if (emailResult.success) {
      console.log('✅ E-mail enviado com sucesso!');
    } else {
      console.log('❌ Falha no envio:', emailResult.error);
    }

  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testEmailService().then(() => {
  console.log('\n🏁 Teste do serviço de e-mail concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});