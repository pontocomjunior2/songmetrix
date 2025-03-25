import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import SibApiV3Sdk from 'sib-api-v3-sdk';

// Carregar variáveis de ambiente
dotenv.config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configurar cliente Brevo (Sendinblue)
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

if (!process.env.BREVO_API_KEY) {
  console.error('API Key do Brevo não configurada no arquivo .env');
  process.exit(1);
}

const apiInstance = new SibApiV3Sdk.SMTPApi();

/**
 * Função para sincronizar templates do Supabase com o Brevo
 */
async function syncTemplates() {
  try {
    console.log('🔄 Sincronizando templates de email com o Brevo...');
    
    // Buscar templates ativos no Supabase
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('active', true);
      
    if (error) {
      console.error('❌ Erro ao buscar templates:', error.message);
      process.exit(1);
    }
    
    if (!templates || templates.length === 0) {
      console.log('⚠️ Nenhum template ativo encontrado no banco de dados.');
      process.exit(0);
    }
    
    console.log(`📋 Encontrados ${templates.length} templates ativos.`);
    
    // Iniciar sincronização de cada template
    for (const template of templates) {
      console.log(`\n🔄 Processando template "${template.name}" (ID: ${template.id})...`);
      
      try {
        // Verificar se o template já existe no Brevo pelo nome
        let existingTemplates;
        try {
          const limit = 50;
          const offset = 0;
          const result = await apiInstance.getSmtpTemplates(limit, offset, template.name);
          existingTemplates = result.templates;
        } catch (listError) {
          console.log('⚠️ Não foi possível verificar templates existentes:', listError.message);
          existingTemplates = [];
        }
        
        // Filtrar para encontrar um template com nome exato
        const existingTemplate = existingTemplates.find(t => t.name === template.name);
        
        if (existingTemplate) {
          console.log(`📝 Atualizando template "${template.name}" no Brevo...`);
          
          // Atualizar template existente
          const updateTemplate = new SibApiV3Sdk.UpdateSmtpTemplate();
          updateTemplate.subject = template.subject;
          updateTemplate.htmlContent = template.body;
          updateTemplate.isActive = true;
          
          await apiInstance.updateSmtpTemplate(existingTemplate.id, updateTemplate);
          console.log(`✅ Template "${template.name}" atualizado com sucesso (ID Brevo: ${existingTemplate.id})`);
          
          // Atualizar id_brevo no Supabase
          await supabase
            .from('email_templates')
            .update({ id_brevo: existingTemplate.id })
            .eq('id', template.id);
        } else {
          console.log(`📝 Criando novo template "${template.name}" no Brevo...`);
          
          // Criar novo template
          const createTemplate = new SibApiV3Sdk.CreateSmtpTemplate();
          createTemplate.templateName = template.name;
          createTemplate.subject = template.subject;
          createTemplate.htmlContent = template.body;
          createTemplate.isActive = true;
          
          const result = await apiInstance.createSmtpTemplate(createTemplate);
          console.log(`✅ Template "${template.name}" criado com sucesso (ID Brevo: ${result.id})`);
          
          // Atualizar id_brevo no Supabase
          await supabase
            .from('email_templates')
            .update({ id_brevo: result.id })
            .eq('id', template.id);
        }
      } catch (templateError) {
        console.error(`❌ Erro ao processar template "${template.name}":`, templateError.message);
      }
    }
    
    console.log('\n✅ Sincronização concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a sincronização:', error.message);
    process.exit(1);
  }
}

// Executar a sincronização
syncTemplates(); 