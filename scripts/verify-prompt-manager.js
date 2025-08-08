console.log('🔍 Verificando PromptManagerPage...');

// Verificar se o arquivo existe e tem export default
import fs from 'fs';
import path from 'path';

const filePath = 'src/pages/Admin/PromptManagerPage.tsx';

try {
  // Verificar se o arquivo existe
  if (!fs.existsSync(filePath)) {
    console.error('❌ Arquivo não encontrado:', filePath);
    process.exit(1);
  }

  // Ler o conteúdo do arquivo
  const content = fs.readFileSync(filePath, 'utf8');

  // Verificações
  const checks = [
    {
      name: 'Export default presente',
      test: content.includes('export default PromptManagerPage'),
      required: true
    },
    {
      name: 'Imports corretos',
      test: content.includes("import { apiGet, apiPost, apiPut, apiDelete } from '@/services/api'"),
      required: true
    },
    {
      name: 'Componente definido',
      test: content.includes('const PromptManagerPage: React.FC = () => {'),
      required: true
    },
    {
      name: 'Interfaces definidas',
      test: content.includes('interface PromptTemplate') && content.includes('interface PromptForm'),
      required: true
    },
    {
      name: 'Funções principais',
      test: content.includes('loadPrompts') && content.includes('handleSave') && content.includes('handleActivate'),
      required: true
    }
  ];

  console.log('\n📋 Resultados da verificação:');
  let allPassed = true;

  checks.forEach(check => {
    const status = check.test ? '✅' : '❌';
    console.log(`   ${status} ${check.name}`);
    
    if (!check.test && check.required) {
      allPassed = false;
    }
  });

  // Estatísticas do arquivo
  const lines = content.split('\n').length;
  const imports = (content.match(/^import/gm) || []).length;
  const functions = (content.match(/const \w+ = /g) || []).length;

  console.log('\n📊 Estatísticas do arquivo:');
  console.log(`   📄 Linhas: ${lines}`);
  console.log(`   📦 Imports: ${imports}`);
  console.log(`   🔧 Funções: ${functions}`);

  if (allPassed) {
    console.log('\n🎉 Arquivo PromptManagerPage está correto e pronto para uso!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Reinicie o servidor: Ctrl+C e npm run dev:all');
    console.log('   2. Acesse: http://localhost:5173/admin/prompts');
    console.log('   3. Faça login como administrador');
  } else {
    console.log('\n❌ Há problemas no arquivo que precisam ser corrigidos.');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Erro ao verificar arquivo:', error.message);
  process.exit(1);
}

console.log('\n✅ Verificação concluída!');