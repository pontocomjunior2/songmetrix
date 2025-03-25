// Script para criar sequência de email para primeiro login
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createFirstLoginSequence() {
  try {
    console.log('Iniciando verificação e criação de sequência de email para primeiro login...');

    // Verificar se já existe alguma sequência para primeiro login
    console.log('Verificando sequências existentes...');
    const { data: existingSequences, error: searchError } = await supabase
      .from('email_sequences')
      .select('id, name, send_type, active')
      .eq('send_type', 'AFTER_FIRST_LOGIN');

    if (searchError) {
      throw new Error(`Erro ao verificar sequências existentes: ${searchError.message}`);
    }

    // Se já existe uma sequência ativa para primeiro login, não criar nova
    const hasActiveSequence = existingSequences?.some(seq => seq.active);
    if (hasActiveSequence) {
      console.log('Sequência ativa para primeiro login já existe. Não será criada uma nova.');
      console.log('Sequências encontradas:');
      existingSequences.forEach(seq => {
        console.log(`- ID: ${seq.id}, Nome: ${seq.name}, Ativa: ${seq.active}`);
      });
      return;
    }

    // Buscar o template de boas-vindas para usar na sequência
    console.log('Buscando template de boas-vindas...');
    const { data: welcomeTemplates, error: templateError } = await supabase
      .from('email_templates')
      .select('id, name')
      .eq('active', true)
      .or('name.eq.welcome_email,name.ilike.%boas%vindas%');

    if (templateError) {
      throw new Error(`Erro ao buscar templates: ${templateError.message}`);
    }

    if (!welcomeTemplates || welcomeTemplates.length === 0) {
      throw new Error('Nenhum template de boas-vindas encontrado. Crie um template antes de criar a sequência.');
    }

    // Usar o primeiro template encontrado
    const templateId = welcomeTemplates[0].id;
    console.log(`Template encontrado: ${welcomeTemplates[0].name} (ID: ${templateId})`);

    // Criar a sequência para primeiro login
    console.log('Criando sequência para primeiro login...');
    const { data: newSequence, error: insertError } = await supabase
      .from('email_sequences')
      .insert({
        name: 'Email Após Primeiro Login',
        template_id: templateId,
        days_after_signup: 0, // Não é relevante para o tipo AFTER_FIRST_LOGIN
        send_type: 'AFTER_FIRST_LOGIN',
        active: true,
        send_hour: 0 // Não é relevante para o tipo AFTER_FIRST_LOGIN
      })
      .select();

    if (insertError) {
      throw new Error(`Erro ao criar sequência: ${insertError.message}`);
    }

    console.log('Sequência para primeiro login criada com sucesso!');
    console.log(`ID: ${newSequence[0].id}`);
    console.log(`Nome: ${newSequence[0].name}`);
    console.log(`Template ID: ${newSequence[0].template_id}`);
    console.log(`Tipo: ${newSequence[0].send_type}`);
    console.log(`Ativa: ${newSequence[0].active}`);

  } catch (error) {
    console.error('Erro ao criar sequência para primeiro login:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

// Executar a função principal
createFirstLoginSequence()
  .then(() => {
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  }); 