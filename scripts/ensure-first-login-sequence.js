import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função principal
async function main() {
  try {
    console.log('Verificando existência de sequência de primeiro login...');
    
    // Verificar se existem sequências de primeiro login ativas
    const { data: existingSequences, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, name, template_id, send_type')
      .eq('send_type', 'AFTER_FIRST_LOGIN')
      .eq('active', true);
      
    if (seqError) {
      console.error('Erro ao verificar sequências de email:', seqError);
      process.exit(1);
    }
    
    if (existingSequences && existingSequences.length > 0) {
      console.log(`Encontrada(s) ${existingSequences.length} sequência(s) de primeiro login:`);
      existingSequences.forEach(seq => {
        console.log(`- ${seq.name} (ID: ${seq.id})`);
      });
      
      // Verificar templates associados
      for (const seq of existingSequences) {
        const { data: template, error: templateError } = await supabase
          .from('email_templates')
          .select('id, name, active')
          .eq('id', seq.template_id)
          .single();
          
        if (templateError) {
          console.error(`Erro ao verificar template da sequência ${seq.name}:`, templateError);
          continue;
        }
        
        if (!template) {
          console.warn(`⚠️ Sequência ${seq.name} referencia um template que não existe (ID: ${seq.template_id})`);
          continue;
        }
        
        if (!template.active) {
          console.warn(`⚠️ Template ${template.name} associado à sequência ${seq.name} está inativo!`);
        } else {
          console.log(`✓ Template ${template.name} (ID: ${template.id}) está ativo`);
        }
      }
      
      console.log('✓ Sequências de primeiro login estão configuradas corretamente');
      process.exit(0);
    }
    
    // Se não existir, verificar se existe template de boas-vindas
    console.log('Nenhuma sequência de primeiro login encontrada. Criando uma...');
    
    // Verificar se existe template de boas-vindas
    const { data: templates, error: templError } = await supabase
      .from('email_templates')
      .select('id, name, subject')
      .ilike('name', '%bem%vindo%')
      .eq('active', true)
      .order('created_at', { ascending: false });
      
    if (templError) {
      console.error('Erro ao buscar templates de boas-vindas:', templError);
      process.exit(1);
    }
    
    let templateId;
    
    if (templates && templates.length > 0) {
      templateId = templates[0].id;
      console.log(`Usando template existente: ${templates[0].name} (ID: ${templateId})`);
    } else {
      // Criar um template de boas-vindas básico
      console.log('Criando template de boas-vindas básico...');
      
      const defaultTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bem-vindo ao Songmetrix</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .content { margin-bottom: 30px; }
    .footer { font-size: 12px; text-align: center; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bem-vindo ao Songmetrix!</h1>
    </div>
    <div class="content">
      <p>Olá {{fullName}},</p>
      <p>Seja muito bem-vindo(a) à plataforma Songmetrix! Estamos felizes em tê-lo(a) conosco.</p>
      <p>Agora você tem acesso a todas as funcionalidades da nossa plataforma de gestão musical:</p>
      <ul>
        <li>Monitoramento de execuções musicais em tempo real</li>
        <li>Relatórios detalhados de performance</li>
        <li>Análise de tendências musicais</li>
        <li>Gestão completa do seu catálogo</li>
      </ul>
      <p>Se tiver qualquer dúvida, nossa equipe está à disposição para ajudar!</p>
      <p>Atenciosamente,<br>Equipe Songmetrix</p>
    </div>
    <div class="footer">
      <p>Este email foi enviado para {{email}} em {{date}}.</p>
    </div>
  </div>
</body>
</html>`;

      const { data: newTemplate, error: createError } = await supabase
        .from('email_templates')
        .insert({
          name: 'Bem-vindo ao Songmetrix',
          subject: 'Bem-vindo ao Songmetrix',
          body: defaultTemplate,
          active: true
        })
        .select('id')
        .single();
        
      if (createError) {
        console.error('Erro ao criar template de boas-vindas:', createError);
        process.exit(1);
      }
      
      templateId = newTemplate.id;
      console.log(`Template de boas-vindas criado com ID: ${templateId}`);
    }
    
    // Criar sequência de primeiro login
    const { data: newSequence, error: createSeqError } = await supabase
      .from('email_sequences')
      .insert({
        name: 'Email de Boas-vindas - Primeiro Login',
        template_id: templateId,
        days_after_signup: 0, // Não é relevante para o tipo AFTER_FIRST_LOGIN
        send_type: 'AFTER_FIRST_LOGIN',
        active: true,
        send_hour: 0 // Não é relevante para o tipo AFTER_FIRST_LOGIN
      })
      .select('id')
      .single();
      
    if (createSeqError) {
      console.error('Erro ao criar sequência de primeiro login:', createSeqError);
      process.exit(1);
    }
    
    console.log(`✓ Sequência de primeiro login criada com sucesso (ID: ${newSequence.id})`);
    console.log('Sistema preparado para enviar emails de boas-vindas no primeiro login!');
    
  } catch (error) {
    console.error('Erro não tratado:', error);
    process.exit(1);
  }
}

// Executar script
main(); 