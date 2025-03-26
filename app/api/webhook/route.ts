import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { addUserToBrevoList } from '@/utils/brevo';

// Tipos para o payload recebido do trigger
interface WebhookPayload {
  id: string;
  email: string;
  status: string;
  name: string | null;
  updated_at: string;
  event_type: 'new_trial_user' | string;
}

/**
 * Processa webhooks acionados pelos triggers do PostgreSQL
 * Especificamente para sincronizar novos usuários TRIAL com o Brevo
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (adicionar verificação mais robusta em produção)
    // const authHeader = request.headers.get('authorization');
    // if (!authHeader || !validateAuth(authHeader)) {
    //   return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    // }

    // Obter dados do corpo da requisição
    const payload = await request.json() as WebhookPayload;
    
    // Validar payload
    if (!payload || !payload.email || !payload.status) {
      console.error('Payload inválido recebido no webhook:', payload);
      return NextResponse.json(
        { error: 'Payload inválido' }, 
        { status: 400 }
      );
    }

    console.log(`Webhook recebido: ${payload.event_type} para ${payload.email}`);

    // Processar com base no tipo de evento
    if (payload.event_type === 'new_trial_user' && payload.status === 'TRIAL') {
      // Adicionar usuário à lista TRIAL do Brevo
      const result = await addUserToBrevoList({
        email: payload.email,
        status: payload.status,
        name: payload.name || '',
      });

      if (result.success) {
        console.log(`Usuário ${payload.email} adicionado à lista TRIAL do Brevo`);
        return NextResponse.json({ 
          success: true, 
          message: `Usuário ${payload.email} sincronizado com sucesso` 
        });
      } else {
        console.error(`Erro ao adicionar usuário ${payload.email} à lista TRIAL:`, result.error);
        return NextResponse.json(
          { success: false, error: result.error }, 
          { status: 500 }
        );
      }
    }

    // Para outros tipos de eventos, retornar sucesso sem ação
    return NextResponse.json({ 
      success: true, 
      message: 'Evento recebido, mas nenhuma ação necessária' 
    });
  } catch (error) {
    console.error('Erro no processamento do webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Erro no processamento do webhook' }, 
      { status: 500 }
    );
  }
} 