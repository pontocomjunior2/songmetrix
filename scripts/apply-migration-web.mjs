// Servidor web simples para aplicar a migração SQL
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Obter o caminho absoluto da raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Carregar o arquivo .env da raiz do projeto
dotenv.config({ path: resolve(rootDir, '.env') });

const app = express();
const PORT = 3030;

// Criar pasta de logs se não existir
const logsDir = resolve(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Middleware para parsear JSON e encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Função para aplicar a migração
async function applyMigration(supabaseUrl, supabaseKey) {
  // Criar cliente Supabase
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Carregar o arquivo SQL
  const migrationFile = resolve(rootDir, 'supabase/migrations/20250316000003_fix_trial_status_manual.sql');
  const fixNewErrorFile = resolve(rootDir, 'supabase/migrations/20250316000004_fix_new_reference_error.sql');
  
  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Arquivo de migração não encontrado: ${migrationFile}`);
  }
  
  if (!fs.existsSync(fixNewErrorFile)) {
    throw new Error(`Arquivo de correção de erro NEW não encontrado: ${fixNewErrorFile}`);
  }

  const sqlContent = fs.readFileSync(migrationFile, 'utf8');
  const fixNewErrorContent = fs.readFileSync(fixNewErrorFile, 'utf8');

  // Executar o SQL principal
  console.log('Aplicando migração principal...');
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: sqlContent });
    if (error) {
      console.log(`Erro ao executar SQL principal: ${error.message}`);
      console.log('Tentando aplicar correção para erro de referência NEW...');
      
      // Se falhar, tentar aplicar a correção específica para o erro NEW
      const { error: fixError } = await supabaseAdmin.rpc('exec_sql', { sql: fixNewErrorContent });
      if (fixError) {
        throw new Error(`Erro ao aplicar correção NEW: ${fixError.message}`);
      } else {
        console.log('Correção para erro de referência NEW aplicada com sucesso!');
      }
    } else {
      console.log('Migração principal aplicada com sucesso!');
    }
  } catch (sqlError) {
    console.log(`Erro ao executar SQL: ${sqlError.message}`);
    console.log('Tentando aplicar correção para erro de referência NEW...');
    
    // Tentar a correção específica
    const { error: fixError } = await supabaseAdmin.rpc('exec_sql', { sql: fixNewErrorContent });
    if (fixError) {
      throw new Error(`Erro ao aplicar correção NEW: ${fixError.message}`);
    } else {
      console.log('Correção para erro de referência NEW aplicada com sucesso!');
    }
  }

  // Atualizar status de usuários recentes
  const { data: updatedUsers, error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      status: 'TRIAL'
    })
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .eq('status', 'INATIVO')
    .select();

  if (updateError) {
    throw new Error(`Erro ao atualizar usuários: ${updateError.message}`);
  }

  // Buscar usuários mais recentes para verificar
  const { data: recentUsers, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, email, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (fetchError) {
    throw new Error(`Erro ao buscar usuários recentes: ${fetchError.message}`);
  }

  // Registrar as informações em um arquivo de log
  const logFile = resolve(logsDir, `migration-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  const logContent = `
Migração aplicada com sucesso em ${new Date().toISOString()}
Número de usuários atualizados para TRIAL: ${updatedUsers?.length || 0}

Usuários mais recentes após a migração:
${recentUsers ? recentUsers.map(user => `- ${user.email}: ${user.status} (criado em ${new Date(user.created_at).toLocaleString()})`).join('\n') : 'Nenhum'}
`;

  fs.writeFileSync(logFile, logContent);

  return {
    success: true,
    usersUpdated: updatedUsers?.length || 0,
    recentUsers
  };
}

// Rota principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Migração SQL para Supabase</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .card { border: 1px solid #ddd; border-radius: 5px; padding: 20px; margin-bottom: 20px; }
        button { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background-color: #45a049; }
        input[type=text] { width: 100%; padding: 12px 20px; margin: 8px 0; box-sizing: border-box; border: 2px solid #ccc; border-radius: 4px; }
        .error { color: red; }
        .success { color: green; }
        .info { margin-top: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; }
        .user-list { margin-top: 20px; }
        .user-item { border-bottom: 1px solid #eee; padding: 10px 0; }
      </style>
    </head>
    <body>
      <h1>Aplicar Migração TRIAL Status</h1>
      <div class="card">
        <h2>Configuração</h2>
        <form id="migration-form">
          <label for="supabaseUrl">URL do Supabase:</label>
          <input type="text" id="supabaseUrl" name="supabaseUrl" value="${process.env.SUPABASE_URL || ''}" required>
          
          <label for="supabaseKey">Chave de Serviço do Supabase:</label>
          <input type="text" id="supabaseKey" name="supabaseKey" value="${process.env.SUPABASE_SERVICE_KEY || ''}" required>
          
          <button type="submit">Aplicar Migração</button>
        </form>
      </div>
      
      <div id="result" style="display: none;"></div>
      
      <div class="info">
        <h3>O que esta migração faz:</h3>
        <ol>
          <li>Atualiza políticas de RLS para permitir o status TRIAL</li>
          <li>Corrige as funções de validação para permitir TRIAL</li>
          <li>Configura triggers para definir novos usuários como TRIAL</li>
          <li>Atualiza usuários recentes de INATIVO para TRIAL</li>
          <li>Sincroniza metadados para garantir consistência</li>
          <li>Corrige erros de referência à tabela "NEW" nas políticas RLS</li>
        </ol>
        <p><strong>Nota:</strong> Se você encontrar o erro <code>42P01: missing FROM-clause entry for table "new"</code>, 
        esta migração inclui uma correção específica para este problema, que ocorre devido ao uso incorreto da 
        referência NEW nas políticas RLS.</p>
      </div>
      
      <script>
        document.getElementById('migration-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const result = document.getElementById('result');
          result.innerHTML = '<p>Aplicando migração. Por favor, aguarde...</p>';
          result.style.display = 'block';
          
          const formData = new FormData(e.target);
          const data = {
            supabaseUrl: formData.get('supabaseUrl'),
            supabaseKey: formData.get('supabaseKey')
          };
          
          try {
            const response = await fetch('/apply-migration', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            
            const responseData = await response.json();
            
            if (responseData.success) {
              let html = '<div class="success">';
              html += '<h3>Migração aplicada com sucesso!</h3>';
              html += '<p>Número de usuários atualizados para TRIAL: ' + responseData.usersUpdated + '</p>';
              
              if (responseData.recentUsers && responseData.recentUsers.length > 0) {
                html += '<div class="user-list">';
                html += '<h4>Usuários mais recentes após a migração:</h4>';
                
                responseData.recentUsers.forEach(function(user) {
                  html += '<div class="user-item">';
                  html += '<p><strong>Email:</strong> ' + user.email + '</p>';
                  html += '<p><strong>Status:</strong> ' + user.status + '</p>';
                  html += '<p><strong>Criado em:</strong> ' + new Date(user.created_at).toLocaleString() + '</p>';
                  html += '</div>';
                });
                
                html += '</div>';
              }
              
              html += '</div>';
              result.innerHTML = html;
            } else {
              result.innerHTML = '<div class="error"><h3>Erro ao aplicar migração</h3><p>' + responseData.error + '</p></div>';
            }
          } catch (error) {
            result.innerHTML = '<div class="error"><h3>Erro ao enviar requisição</h3><p>' + error.message + '</p></div>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Rota para aplicar a migração
app.post('/apply-migration', async (req, res) => {
  const { supabaseUrl, supabaseKey } = req.body;
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL do Supabase e chave de serviço são necessários' 
    });
  }
  
  try {
    const result = await applyMigration(supabaseUrl, supabaseKey);
    res.json(result);
  } catch (error) {
    console.error('Erro ao aplicar migração:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Use este endereço no navegador para aplicar a migração SQL');
}); 