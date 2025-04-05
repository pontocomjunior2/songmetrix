/**
 * Classe base para erros específicos da aplicação.
 */
export class AppError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    // Mantém a cadeia de protótipos correta para instanceof funcionar
    Object.setPrototypeOf(this, AppError.prototype);
    // Captura o stack trace (opcional, mas útil para debug no servidor)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
    this.name = 'AppError'; // Nome do erro
  }
}

/**
 * Coleção de erros pré-definidos da aplicação.
 */
export const appErrors = {
  // Erros da Evolution API
  EVOLUTION_API_CONFIG_ERROR: new AppError('EVOLUTION_API_CONFIG_ERROR', 'Configuração da API de mensagens externa incompleta.'),
  EVOLUTION_API_ERROR: new AppError('EVOLUTION_API_ERROR', 'Erro ao comunicar com a API de mensagens externa.'),
  EVOLUTION_API_REQUEST_FAILED: new AppError('EVOLUTION_API_REQUEST_FAILED', 'Falha na requisição para a API de mensagens externa.'),

  // Erros de Banco de Dados
  DATABASE_ERROR: new AppError('DATABASE_ERROR', 'Erro ao acessar o banco de dados.'),
  QUERY_ERROR: new AppError('QUERY_ERROR', 'Erro ao executar a consulta no banco de dados.'),

  // Erros Gerais
  NOT_FOUND: new AppError('NOT_FOUND', 'Registro não encontrado.'),
  USER_NOT_FOUND: new AppError('USER_NOT_FOUND', 'Usuário não encontrado.'),
  TEMPLATE_NOT_FOUND: new AppError('TEMPLATE_NOT_FOUND', 'Modelo de mensagem não encontrado.'),
  UNAUTHORIZED: new AppError('UNAUTHORIZED', 'Acesso não autorizado.'),
  FORBIDDEN: new AppError('FORBIDDEN', 'Acesso proibido.'),
  INVALID_INPUT: new AppError('INVALID_INPUT', 'Dados de entrada inválidos.'),
  MISSING_WHATSAPP: new AppError('MISSING_WHATSAPP', 'Número de WhatsApp não cadastrado para este usuário.'),
  UNEXPECTED_ERROR: new AppError('UNEXPECTED_ERROR', 'Ocorreu um erro inesperado.'),
}; 