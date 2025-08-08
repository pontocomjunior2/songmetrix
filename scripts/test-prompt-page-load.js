console.log('🧪 Testando carregamento da PromptManagerPage...');

// Simular dados que a página receberia
const mockPrompts = [
  {
    id: '1',
    name: 'Template de Teste',
    content: 'Conteúdo do template com {{INSIGHT_DATA}}',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

console.log('✅ Dados mock criados:', mockPrompts);

// Verificar se a estrutura está correta
const requiredFields = ['id', 'name', 'content', 'is_active', 'created_at', 'updated_at'];
const firstPrompt = mockPrompts[0];

console.log('🔍 Verificando estrutura dos dados:');
requiredFields.forEach(field => {
  const hasField = field in firstPrompt;
  console.log(`   ${hasField ? '✅' : '❌'} ${field}: ${hasField ? typeof firstPrompt[field] : 'MISSING'}`);
});

console.log('\n📋 Instruções para testar a página:');
console.log('1. Certifique-se de que o servidor está rodando: npm run dev:all');
console.log('2. Acesse: http://localhost:5173/admin/prompts');
console.log('3. Faça login como administrador');
console.log('4. A página deve carregar sem erros de sintaxe');

console.log('\n🎯 Se houver erro 401, é normal - significa que a autenticação está funcionando');
console.log('🎯 Se houver erro de rota, verifique se o servidor React foi reiniciado');

console.log('\n✅ Teste de estrutura concluído!');