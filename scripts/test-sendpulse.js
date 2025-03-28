import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

async function getAccessToken() {
  try {
    console.log('Obtendo token de acesso do SendPulse...');
    
    const clientId = process.env.SENDPULSE_CLIENT_ID;
    const clientSecret = process.env.SENDPULSE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do SendPulse não configuradas');
    }
    
    const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    
    console.log(`Status da resposta de autenticação: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro na API: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('Token de acesso não encontrado na resposta');
    }
    
    console.log('Token de acesso obtido com sucesso');
    return data.access_token;
  } catch (error) {
    console.error('Erro ao obter token:', error);
    throw error;
  }
}

async function sendDirectEmail() {
  try {
    console.log('Iniciando envio de email com SendPulse...');
    
    // Obter token de acesso
    const accessToken = await getAccessToken();
    
    // Configurar dados do email
    const emailData = {
      email: {
        subject: 'Teste direto da API',
        html: '<h1>Olá!</h1><p>Este é um email de teste direto da API do SendPulse.</p>',
        from: {
          name: 'Songmetrix',
          email: 'contato@songmetrix.com.br'
        },
        to: [
          {
            name: 'Teste',
            email: 'teste@example.com'
          }
        ]
      }
    };
    
    console.log('Dados do email:', JSON.stringify(emailData, null, 2));
    
    // Enviar o email diretamente para a API do SendPulse
    const response = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    console.log(`Status da resposta: ${response.status}`);
    
    // Obter o resultado como texto primeiro para debug
    const responseText = await response.text();
    console.log('Resposta em texto:', responseText);
    
    // Tentar fazer o parse da resposta
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta:', parseError);
      return { success: false, error: 'Erro ao processar resposta JSON' };
    }
    
    console.log('Resultado do envio:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      console.error('Erro na API:', result.message || response.statusText);
      return { success: false, error: `Erro na API (${response.status}): ${result.message || response.statusText}` };
    }
    
    console.log('Email enviado com sucesso!');
    return { success: true, data: result };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
}

sendDirectEmail(); 