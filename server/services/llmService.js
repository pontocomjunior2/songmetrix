import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import winston from 'winston';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(dirname(__dirname)), '.env.production'),
  path.join(dirname(dirname(__dirname)), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('[LlmService] Loaded environment variables from:', envPath);
    break;
  }
}

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Required environment variables are missing: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configuração do logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Serviço LLM para geração de conteúdo de e-mails
 * Versão JavaScript para uso no backend Node.js
 */
export class LlmService {
  /**
   * Método público principal para gerar conteúdo de e-mail
   * @param {Object} insightData Dados do insight para gerar o e-mail
   * @returns {Promise<{subject: string, body_html: string}>} Promise com subject e body_html do e-mail
   */
  async generateEmailContent(insightData) {
    try {
      logger.info('[LlmService] Iniciando geração de conteúdo de e-mail', {
        insightType: insightData.insightType,
        userId: insightData.userId
      });

      // Buscar provedor ativo na tabela llm_provider_settings
      const { data: providerSettings, error: providerError } = await supabase
        .from('llm_provider_settings')
        .select('provider_name, api_key, api_url, model_name, max_tokens, temperature')
        .eq('is_active', true)
        .single();

      if (providerError || !providerSettings) {
        const errorMsg = 'Nenhum provedor LLM ativo encontrado na configuração';
        logger.error('[LlmService] Erro ao buscar provedor ativo', {
          error: providerError?.message,
          code: providerError?.code
        });
        throw new Error(errorMsg);
      }

      logger.info('[LlmService] Provedor ativo encontrado', {
        provider: providerSettings.provider_name,
        model: providerSettings.model_name
      });

      // Usar estrutura switch baseada no provider_name
      switch (providerSettings.provider_name) {
        case 'OpenAI':
          return await this._callOpenAiApi(providerSettings.api_key, insightData, providerSettings);
        
        case 'Anthropic':
          throw new Error('Provedor Anthropic ainda não implementado');
        
        case 'Google':
          throw new Error('Provedor Google ainda não implementado');
        
        case 'Azure':
          throw new Error('Provedor Azure ainda não implementado');
        
        default:
          throw new Error(`Provedor LLM não suportado: ${providerSettings.provider_name}`);
      }

    } catch (error) {
      logger.error('[LlmService] Erro na geração de conteúdo de e-mail', {
        error: error.message,
        stack: error.stack,
        insightData: insightData
      });
      throw error;
    }
  }

  /**
   * Método privado para chamada da API da OpenAI
   * @param {string} apiKey Chave da API da OpenAI
   * @param {Object} insightData Dados do insight
   * @param {Object} settings Configurações do provedor
   * @returns {Promise<{subject: string, body_html: string}>} Promise com subject e body_html do e-mail
   */
  async _callOpenAiApi(apiKey, insightData, settings) {
    try {
      logger.info('[LlmService] Iniciando chamada para API da OpenAI', {
        model: settings.model_name || 'gpt-4o',
        maxTokens: settings.max_tokens || 1000,
        temperature: settings.temperature || 0.7
      });

      // Buscar template de prompt ativo na tabela prompt_templates
      const { data: promptTemplate, error: promptError } = await supabase
        .from('prompt_templates')
        .select('content')
        .eq('is_active', true)
        .single();

      if (promptError || !promptTemplate) {
        const errorMsg = 'Nenhum template de prompt ativo encontrado';
        logger.error('[LlmService] Erro ao buscar template de prompt ativo', {
          error: promptError?.message,
          code: promptError?.code
        });
        throw new Error(errorMsg);
      }

      logger.info('[LlmService] Template de prompt ativo encontrado', {
        contentLength: promptTemplate.content.length
      });

      // Instanciar cliente da OpenAI
      const openai = new OpenAI({ apiKey });

      // Injetar dados do insight no template de prompt
      const prompt = promptTemplate.content.replace('{{INSIGHT_DATA}}', JSON.stringify(insightData));

      logger.debug('[LlmService] Prompt criado com template do banco', {
        promptLength: prompt.length,
        insightType: insightData.insightType,
        templateUsed: true
      });

      // Fazer chamada para a API da OpenAI
      const response = await openai.chat.completions.create({
        model: settings.model_name || 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: settings.max_tokens || 1000,
        temperature: settings.temperature || 0.7,
        response_format: { type: 'json_object' }
      });

      logger.info('[LlmService] Resposta recebida da OpenAI', {
        usage: response.usage,
        model: response.model,
        finishReason: response.choices[0]?.finish_reason
      });

      // Parse do conteúdo JSON
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Resposta vazia da API da OpenAI');
      }

      const parsedContent = JSON.parse(content);

      // Validar estrutura da resposta
      if (!parsedContent.subject || !parsedContent.body_html) {
        throw new Error('Resposta da API não contém as chaves necessárias (subject, body_html)');
      }

      logger.info('[LlmService] Conteúdo de e-mail gerado com sucesso', {
        subjectLength: parsedContent.subject.length,
        bodyLength: parsedContent.body_html.length
      });

      return {
        subject: parsedContent.subject,
        body_html: parsedContent.body_html
      };

    } catch (error) {
      logger.error('[LlmService] Erro na chamada da API da OpenAI', {
        error: error.message,
        stack: error.stack,
        apiKeyPresent: !!apiKey,
        settings: {
          model: settings.model_name,
          maxTokens: settings.max_tokens,
          temperature: settings.temperature
        }
      });

      // Lançar erro padronizado
      throw new Error(`Erro na API da OpenAI: ${error.message}`);
    }
  }
}