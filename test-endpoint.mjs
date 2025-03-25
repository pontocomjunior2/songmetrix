// Arquivo para testar o endpoint de envio de email
import fetch from 'node-fetch';

async function testEndpoint() {
  try {
    console.log('Testando a conexão com o servidor de email...');
    const testResponse = await fetch('http://localhost:3002/api/email/test-connection');
    console.log('Status da conexão:', testResponse.status);
    
    console.log('\nTestando OPTIONS para o endpoint de email...');
    const optionsResponse = await fetch('http://localhost:3002/api/email/send-test', {
      method: 'OPTIONS'
    });
    console.log('Status OPTIONS:', optionsResponse.status);
    
    // Tentativa de envio de email (sem autenticação, deve falhar com 401)
    console.log('\nTestando POST para o endpoint de email (sem autenticação)...');
    const emailResponse = await fetch('http://localhost:3002/api/email/send-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'teste@example.com',
        templateId: 'template-id-teste'
      })
    });
    
    console.log('Status do envio:', emailResponse.status);
    const responseText = await emailResponse.text();
    console.log('Resposta:', responseText);
    
  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

testEndpoint(); 