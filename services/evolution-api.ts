import { AppError, appErrors } from '@/lib/errors'; // Supondo que você tenha um sistema de erros definido

interface EvolutionApiSuccessResponse {
  // Defina a estrutura esperada para uma resposta de sucesso da API
  // Exemplo baseado na documentação de /message/sendText (pode precisar de ajuste)
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation: string;
  };
  messageTimestamp: number;
  status: string; // Ex: "PENDING"
}

interface EvolutionApiErrorResponse {
  // Defina a estrutura esperada para uma resposta de erro da API
  message: string;
  // ... outros campos de erro, se houver
}

type EvolutionApiResponse = EvolutionApiSuccessResponse | EvolutionApiErrorResponse;

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

/**
 * Envia uma mensagem de texto usando a Evolution API.
 * @param to - O número de telefone do destinatário (formato internacional, ex: 5511999999999).
 * @param text - O conteúdo da mensagem.
 * @returns A resposta da API Evolution.
 * @throws {AppError} Se as variáveis de ambiente não estiverem configuradas ou ocorrer um erro na API.
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<EvolutionApiResponse> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    console.error('Variáveis de ambiente da Evolution API não configuradas.');
    throw appErrors.EVOLUTION_API_CONFIG_ERROR; // Certifique-se que appErrors e EVOLUTION_API_CONFIG_ERROR estão definidos
  }

  // Remove caracteres não numéricos do número de telefone
  const phoneNumber = to.replace(/\D/g, '');
  // Assume DDI 55 (Brasil) se não especificado explicitamente no formato internacional
  const remoteJid = phoneNumber.length > 11 ? `${phoneNumber}@s.whatsapp.net` : `55${phoneNumber}@s.whatsapp.net`;


  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: remoteJid,
        options: {
          delay: 1200,
          presence: 'composing',
        },
        textMessage: {
          text: text,
        },
      }),
    });

    const responseData: EvolutionApiResponse = await response.json();

    if (!response.ok) {
       console.error('Erro na API Evolution:', responseData);
       // Tenta extrair uma mensagem de erro mais específica se disponível
       const errorMessage = (responseData as EvolutionApiErrorResponse)?.message || `Erro ${response.status}`;
       throw new AppError('EVOLUTION_API_ERROR', `Falha ao enviar mensagem: ${errorMessage}`); // Certifique-se que AppError está definido
    }

    return responseData;

  } catch (error) {
    console.error('Erro ao enviar mensagem via Evolution API:', error);
    if (error instanceof AppError) {
      throw error; // Re-lança erros AppError conhecidos
    }
    // Envolve erros inesperados (fetch, JSON parse, etc.) em AppError
    throw new AppError('EVOLUTION_API_REQUEST_FAILED', 'Não foi possível conectar à API de mensagens.'); // Certifique-se que AppError está definido
  }
}

// Exemplo de como definir AppError e appErrors (coloque em um arquivo apropriado como lib/errors.ts)
/*
export class AppError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const appErrors = {
  EVOLUTION_API_CONFIG_ERROR: new AppError('EVOLUTION_API_CONFIG_ERROR', 'Configuração da API de mensagens incompleta.'),
  EVOLUTION_API_ERROR: new AppError('EVOLUTION_API_ERROR', 'Erro ao comunicar com a API de mensagens.'),
  EVOLUTION_API_REQUEST_FAILED: new AppError('EVOLUTION_API_REQUEST_FAILED', 'Falha na requisição para a API de mensagens.'),
  DATABASE_ERROR: new AppError('DATABASE_ERROR', 'Erro ao acessar o banco de dados.'),
  NOT_FOUND: new AppError('NOT_FOUND', 'Registro não encontrado.'),
  UNAUTHORIZED: new AppError('UNAUTHORIZED', 'Acesso não autorizado.'),
  INVALID_INPUT: new AppError('INVALID_INPUT', 'Dados de entrada inválidos.'),
  UNEXPECTED_ERROR: new AppError('UNEXPECTED_ERROR', 'Ocorreu um erro inesperado.'),
};
*/ 