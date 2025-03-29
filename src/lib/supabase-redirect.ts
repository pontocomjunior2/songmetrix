/**
 * Utilitário para configuração de redirecionamento do Supabase
 * Usado para garantir que as confirmações de email e recuperação de senha
 * redirecionem para o caminho correto.
 */

// Interface para as opções de redirecionamento
export interface RedirectConfig {
  emailRedirectTo: string;
  passwordResetRedirectTo: string;
}

// Interface para as opções de autenticação
export interface AuthRedirectOptions {
  emailRedirectTo: string;
  data: Record<string, any>;
}

// Configuração padrão para redirecionamentos de autenticação
export const REDIRECT_CONFIG: RedirectConfig = {
  // URL para redirecionamento após confirmação de email
  emailRedirectTo: 'https://songmetrix.com.br/login',
  
  // URL para redirecionamento após recuperação de senha
  passwordResetRedirectTo: 'https://songmetrix.com.br/login',
};

// Função auxiliar para gerar opções de autenticação com redirecionamento
export function getAuthRedirectOptions(additionalData: Record<string, any> = {}): AuthRedirectOptions {
  return {
    emailRedirectTo: REDIRECT_CONFIG.emailRedirectTo,
    data: {
      ...additionalData
    }
  };
}

// Log para debug
console.log('Configuração de redirecionamento carregada:', REDIRECT_CONFIG);

// Exportar como default para facilitar importação
export default REDIRECT_CONFIG; 