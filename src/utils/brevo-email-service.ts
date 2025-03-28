// Interface para dados de email
export interface EmailData {
  to: string;
  templateId: string;
  name?: string;
  variables?: Record<string, any>;
}

// Interface para resposta de envio de email
export interface EmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Envia um email usando o Brevo via SMTP
 */
export async function sendEmailWithBrevo(emailData: EmailData): Promise<EmailResponse> {
  try {
    console.log('Enviando email com Brevo SMTP:', emailData);
    
    // Enviar dados para o endpoint do servidor de email
    const response = await fetch('/api/email/send-brevo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': localStorage.getItem('userId') || '',
        'X-User-Role': localStorage.getItem('userRole') || ''
      },
      body: JSON.stringify({
        email: emailData.to,
        templateId: emailData.templateId,
        variables: emailData.variables
      })
    });

    // Verificar o tipo de conteúdo da resposta
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      // Se a resposta contém JSON, fazemos o parse
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Erro ao enviar email com Brevo (JSON):', data);
        return {
          success: false,
          error: data.error || `Erro na API: ${response.status} ${response.statusText}`
        };
      }
      
      return data;
    } else {
      // Se a resposta não é JSON, lemos como texto
      const textResponse = await response.text();
      console.error('Resposta não-JSON ao enviar email com Brevo:', textResponse);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Erro na API (${response.status}): ${response.statusText}`
        };
      }
      
      // Se por algum motivo recebemos uma resposta de sucesso sem JSON, criamos um objeto de sucesso
      return {
        success: true,
        message: 'Email enviado com sucesso'
      };
    }
  } catch (error) {
    console.error('Exceção ao enviar email com Brevo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Envia um email de teste usando o template especificado
 */
export async function sendTestEmail(email: string, templateId: string): Promise<EmailResponse> {
  return sendEmailWithBrevo({
    to: email,
    templateId,
    variables: {
      name: 'Usuário de Teste',
      radioName: 'Rádio Teste',
      appUrl: window.location.origin,
      currentDate: new Date().toLocaleDateString('pt-BR')
    }
  });
}

/**
 * Envia um email de boas-vindas
 */
export async function sendWelcomeEmail(email: string, name?: string): Promise<EmailResponse> {
  try {
    console.log('Enviando email de boas-vindas com Brevo:', { email, name });
    
    // Enviar requisição para enviar email de boas-vindas
    const welcomeResponse = await fetch('/api/email/send-welcome-brevo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': localStorage.getItem('userId') || '',
        'X-User-Role': localStorage.getItem('userRole') || ''
      },
      body: JSON.stringify({
        email,
        name: name || 'Usuário',
      })
    });

    const data = await welcomeResponse.json();
    
    if (!welcomeResponse.ok) {
      console.error('Erro ao enviar email de boas-vindas:', data);
      return {
        success: false,
        error: data.error || `Erro na API: ${welcomeResponse.status} ${welcomeResponse.statusText}`
      };
    }
    
    return {
      success: true,
      message: data.message || 'Email de boas-vindas enviado com sucesso',
      data: data.result
    };
  } catch (error) {
    console.error('Exceção ao enviar email de boas-vindas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
} 