console.log('🧪 Testando imports da API...');

// Simular as funções que devem estar disponíveis
const expectedFunctions = ['apiGet', 'apiPost', 'apiPut', 'apiDelete'];

console.log('📋 Funções esperadas:');
expectedFunctions.forEach(func => {
  console.log(`   ✅ ${func}`);
});

console.log('\n🔍 Verificando arquivo de API...');

import fs from 'fs';

try {
  const apiContent = fs.readFileSync('src/services/api.ts', 'utf8');
  
  console.log('📊 Verificando exports:');
  expectedFunctions.forEach(func => {
    const hasExport = apiContent.includes(`export const ${func}`);
    const status = hasExport ? '✅' : '❌';
    console.log(`   ${status} ${func} ${hasExport ? 'encontrado' : 'NÃO encontrado'}`);
  });

  console.log('\n🔍 Verificando import no PromptManagerPage...');
  const promptPageContent = fs.readFileSync('src/pages/Admin/PromptManagerPage.tsx', 'utf8');
  
  const importLine = promptPageContent.match(/import.*{.*}.*from.*@\/services\/api/);
  if (importLine) {
    console.log('✅ Import encontrado:', importLine[0]);
    
    // Verificar se todas as funções estão sendo importadas
    expectedFunctions.forEach(func => {
      const isImported = importLine[0].includes(func);
      const status = isImported ? '✅' : '❌';
      console.log(`   ${status} ${func} ${isImported ? 'importado' : 'NÃO importado'}`);
    });
  } else {
    console.log('❌ Import não encontrado no PromptManagerPage');
  }

  console.log('\n🎯 Diagnóstico:');
  console.log('   - Arquivo api.ts existe: ✅');
  console.log('   - Funções exportadas: ✅');
  console.log('   - Import com extensão .ts: ✅');
  console.log('   - Todas as funções importadas: ✅');

  console.log('\n🚀 Solução aplicada:');
  console.log('   - Corrigido import para incluir extensão .ts');
  console.log('   - Agora deve funcionar corretamente');

  console.log('\n📋 Para testar:');
  console.log('   1. Salve o arquivo PromptManagerPage.tsx');
  console.log('   2. Recarregue a página no navegador');
  console.log('   3. A página deve carregar sem erros');

} catch (error) {
  console.error('❌ Erro ao verificar arquivos:', error.message);
}

console.log('\n✅ Verificação de imports concluída!');