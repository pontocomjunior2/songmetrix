// Script para atualizar status de usuário diretamente via Supabase REST API
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(dirname(__dirname), '.env')
];

for (const envPath of envPaths) {
  if (dotenv.config({ path: envPath }).error === undefined) {
    console.log('Variáveis de ambiente carregadas de:', envPath);
    break;
  }
}

// Valores que você precisa configurar
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const userId = '0b671175-c282-4e3b-b53d-e82468d315e5'; // Substitua pelo ID do usuário
const newStatus = 'ADMIN'; // Status desejado (ADMIN, ATIVO, INATIVO, TRIAL)

async function updateUserStatus() {
  try {
    console.log(`Atualizando status do usuário ${userId} para ${newStatus}`);
    
    // Etapa 1: Verificar status atual
    console.log('Verificando status atual...');
    
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation'
      }
    });
    
    if (!checkResponse.ok) {
      const errorData = await checkResponse.text();
      throw new Error(`Erro ao verificar usuário: ${checkResponse.status} ${errorData}`);
    }
    
    const userData = await checkResponse.json();
    if (!userData || userData.length === 0) {
      throw new Error(`Usuário não encontrado: ${userId}`);
    }
    
    console.log(`Status atual: ${userData[0].status}`);
    
    // Etapa 2: Atualizar status via REST API
    console.log(`Atualizando para ${newStatus}...`);
    
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      throw new Error(`Erro ao atualizar status: ${updateResponse.status} ${errorData}`);
    }
    
    // Etapa 3: Verificar se a atualização foi bem-sucedida
    console.log('Verificando atualização...');
    
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    
    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.text();
      throw new Error(`Erro ao verificar atualização: ${verifyResponse.status} ${errorData}`);
    }
    
    const updatedData = await verifyResponse.json();
    if (!updatedData || updatedData.length === 0) {
      throw new Error(`Não foi possível verificar atualização: usuário não encontrado`);
    }
    
    console.log(`Status após atualização: ${updatedData[0].status}`);
    
    if (updatedData[0].status === newStatus) {
      console.log('✅ Status atualizado com sucesso!');
    } else {
      console.log('❌ Falha na atualização de status!');
      
      // Tentar método alternativo: SQL direto
      console.log('Tentando método alternativo usando SQL direto...');
      
      // Usar a API REST para executar SQL direto
      const sqlQuery = `
        BEGIN;
        -- Desativar restrições RLS
        SET session_replication_role = 'replica';
        
        -- Atualizar status
        UPDATE public.users 
        SET status = '${newStatus}', 
            updated_at = NOW() 
        WHERE id = '${userId}';
        
        -- Reativar restrições RLS
        SET session_replication_role = 'origin';
        COMMIT;
      `;
      
      const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({
          query: sqlQuery
        })
      });
      
      if (!sqlResponse.ok) {
        const errorData = await sqlResponse.text();
        console.error(`Erro ao executar SQL direto: ${sqlResponse.status} ${errorData}`);
      } else {
        console.log('SQL direto executado. Verificando resultado...');
        
        // Verificar novamente
        const finalVerifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          }
        });
        
        if (finalVerifyResponse.ok) {
          const finalData = await finalVerifyResponse.json();
          if (finalData && finalData.length > 0) {
            console.log(`Status final após SQL direto: ${finalData[0].status}`);
            
            if (finalData[0].status === newStatus) {
              console.log('✅ Status atualizado com sucesso via SQL direto!');
            } else {
              console.log('❌ Ambos os métodos falharam em atualizar o status.');
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

// Executar a função principal
updateUserStatus().then(() => {
  console.log('Script concluído.');
}); 