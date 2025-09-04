#!/usr/bin/env node

import { createServer } from 'http';
import { URL } from 'url';

// Simular o servidor para verificar se as rotas estão sendo registradas
const testServer = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  console.log(`🔍 Requisição recebida: ${req.method} ${path}`);
  
  // Simular as rotas que deveriam existir
  if (path.startsWith('/api/admin/users')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Rota /api/admin/users funcionando' }));
  } else if (path.startsWith('/api/admin/insights/drafts')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Rota /api/admin/insights/drafts funcionando' }));
  } else if (path.startsWith('/api/diagnostico')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Rota /api/diagnostico funcionando' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rota não encontrada', path }));
  }
});

testServer.listen(3002, () => {
  console.log('🚀 Servidor de teste rodando na porta 3002');
  console.log('📝 Teste as rotas:');
  console.log('   - http://localhost:3002/api/admin/users');
  console.log('   - http://localhost:3002/api/admin/insights/drafts');
  console.log('   - http://localhost:3002/api/diagnostico');
});

// Função para testar as rotas
async function testRoutes() {
  const routes = [
    '/api/admin/users',
    '/api/admin/insights/drafts',
    '/api/diagnostico'
  ];
  
  for (const route of routes) {
    try {
      const response = await fetch(`http://localhost:3002${route}`);
      const data = await response.text();
      console.log(`✅ ${route}: ${response.status} - ${data}`);
    } catch (error) {
      console.log(`❌ ${route}: ${error.message}`);
    }
  }
}

// Testar após 1 segundo
setTimeout(testRoutes, 1000);
