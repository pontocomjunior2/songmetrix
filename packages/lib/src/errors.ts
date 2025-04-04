/**
 * Classe base para erros específicos da aplicação.
 * Permite identificar erros conhecidos e tratá-los de forma diferenciada.
 */
export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly originalError?: unknown // Para rastrear o erro original, se houver

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    originalError?: unknown,
  ) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.originalError = originalError
    // Mantém o stack trace correto para onde o erro foi instanciado (disponível apenas em V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
    // Garante que o nome da classe seja AppError
    this.name = 'AppError'
  }
}

/**
 * Coleção de erros pré-definidos da aplicação.
 */
export const appErrors = {
  // --- Erros Gerais ---
  UNEXPECTED_ERROR: new AppError(
    'general/unexpected',
    'Ocorreu um erro inesperado.',
    500,
  ),
  INVALID_INPUT: new AppError(
    'general/invalid-input',
    'Dados de entrada inválidos.',
    400,
  ),
  // --- Erros de Autenticação ---
  AUTH_INVALID_CREDENTIALS: new AppError(
    'auth/invalid-credentials',
    'Credenciais inválidas.',
    401,
  ),
  AUTH_USER_NOT_FOUND: new AppError(
    'auth/user-not-found',
    'Usuário não encontrado.',
    404,
  ),
  AUTH_EMAIL_ALREADY_EXISTS: new AppError(
    'auth/email-already-exists',
    'Este e-mail já está em uso.',
    409, // Conflict
  ),
  AUTH_SESSION_EXPIRED: new AppError(
    'auth/session-expired',
    'Sessão expirada. Por favor, faça login novamente.',
    401,
  ),
  AUTH_UNAUTHORIZED: new AppError(
    'auth/unauthorized',
    'Acesso não autorizado.',
    403, // Forbidden
  ),
  AUTH_PASSWORD_RESET_INVALID_TOKEN: new AppError(
    'auth/password-reset-invalid-token',
    'Token de redefinição de senha inválido ou expirado.',
    400,
  ),
  AUTH_PASSWORD_UPDATE_FAILED: new AppError(
    'auth/password-update-failed',
    'Falha ao atualizar a senha.',
    500,
  ),

  // --- Erros de Serviço Externo ---
  EXTERNAL_SERVICE_ERROR: new AppError(
    'service/external-error',
    'Erro ao comunicar com um serviço externo.',
    502, // Bad Gateway
  ),

  // --- Erros do WhatsApp Service (Evolution API) ---
  WHATSAPP_SERVICE_NOT_CONFIGURED: new AppError(
    'whatsapp/evolution-not-configured',
    'Serviço do WhatsApp (Evolution API) não configurado corretamente nas variáveis de ambiente.',
    503, // Service Unavailable
  ),
  WHATSAPP_SEND_FAILED: new AppError(
    'whatsapp/evolution-send-failed',
    'Falha ao enviar mensagem via Evolution API.',
    500, // Ou código mais específico se a API retornar
  ),

  // --- Erros Específicos da Aplicação ---
  // Adicione outros erros específicos conforme necessário
  RESOURCE_NOT_FOUND: (resource: string = 'Recurso') =>
    new AppError(
      'app/resource-not-found',
      `${resource} não encontrado.`,
      404,
    ),
}

/**
 * Verifica se um erro é uma instância de AppError.
 * Útil para type guards em blocos catch.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
} 