/**
 * Interface para representar dados do usuário
 */
export interface UserData {
  id: string;
  email: string;
  name?: string;
  status: string;
  whatsapp?: string;
}

/**
 * Interface de resposta das operações do Brevo
 */
export interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

/**
 * Sincroniza um usuário com o SendPulse
 */
export async function syncUserWithSendPulse(userData: UserData): Promise<SyncResponse> {
  try {
    // Enviar dados para o endpoint do servidor
    const response = await fetch('/api/sendpulse/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': localStorage.getItem('userId') || '',
        'X-User-Role': localStorage.getItem('userRole') || ''
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || `Erro na API: ${response.status} ${response.statusText}`
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao sincronizar com SendPulse:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Alias para compatibilidade com o código existente
export const syncUserWithBrevo = syncUserWithSendPulse; 