import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import winston from 'winston';

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

// Interfaces
interface EmailContent {
  subject: string;
  body_html: string;
}

interface LlmProviderSettings {
  provider_name: string;
  api_key: string;
  api_url?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
}

/**
 * Serviço LLM para geração de conteúdo de e-mails
 * Adaptador para comunicação com diferentes APIs de LLM
 */
export class LlmService {
  /**
   * Método público principal para gerar conteúdo de e-mail
   * @param insightData Dados do insight para gerar o e-mail
   * @returns Promise com subject e body_html do e-mail
   */
  public async generateEmailContent(insightData: any): Promise<EmailContent> {
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
        
        // Casos futuros para outros provedores
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
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        insightData: insightData
      });
      throw error;
    }
  }

  /**
   * Método privado para chamada da API da OpenAI
   * @param apiKey Chave da API da OpenAI
   * @param insightData Dados do insight
   * @param settings Configurações do provedor
   * @returns Promise com subject e body_html do e-mail
   */
  private async _callOpenAiApi(
    apiKey: string, 
    insightData: any, 
    settings: LlmProviderSettings
  ): Promise<EmailContent> {
    try {
      logger.info('[LlmService] Iniciando chamada para API da OpenAI', {
        model: settings.model_name || 'gpt-4o',
        maxTokens: settings.max_tokens || 1000,
        temperature: settings.temperature || 0.7
      });

      // Instanciar cliente da OpenAI
      const openai = new OpenAI({ apiKey });

      // Criar prompt detalhado
      const prompt = `Você é um especialista em marketing e análise de dados para a indústria de rádio no Brasil. Sua tarefa é criar um e-mail curto e impactante para um programador musical baseado nos seguintes dados de insight: ${JSON.stringify(insightData)}. O e-mail deve despertar curiosidade e o desejo de agir. Responda APENAS com um objeto JSON válido contendo duas chaves: 'subject' (o assunto do e-mail) e 'body_html' (o corpo do e-mail em HTML, use tags como <h1>, <p>, <strong>).`;

      logger.debug('[LlmService] Prompt criado', {
        promptLength: prompt.length,
        insightType: insightData.insightType
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
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        apiKeyPresent: !!apiKey,
        settings: {
          model: settings.model_name,
          maxTokens: settings.max_tokens,
          temperature: settings.temperature
        }
      });

      // Lançar erro padronizado
      throw new Error(`Erro na API da OpenAI: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
}