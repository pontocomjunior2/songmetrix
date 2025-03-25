import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obter diretório atual para ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivo original
const serverFile = path.join(__dirname, 'server.js');

// Ler o conteúdo do arquivo
const content = fs.readFileSync(serverFile, 'utf8');

// Substituir a segunda ocorrência da rota
const fixedContent = content.replace(
  /app\.post\('\/api\/brevo\/sync-users', verifyToken, async \(req, res\) => {[\s\S]*?res\.end\(\);\s*}\s*}\);/,
  "// Endpoint removido para evitar duplicação"
);

// Verificar se a substituição foi realizada
if (content === fixedContent) {
  console.log('AVISO: Não foi possível encontrar o código para substituir.');
  process.exit(1);
}

// Criar um backup do arquivo original
const backupFile = path.join(__dirname, 'server.js.bak_' + Date.now());
fs.writeFileSync(backupFile, content, 'utf8');
console.log(`Backup criado em: ${backupFile}`);

// Salvar o conteúdo corrigido
fs.writeFileSync(serverFile, fixedContent, 'utf8');
console.log('Arquivo server.js corrigido com sucesso!');

// Verificar se existe a definição do middleware authenticateUser
if (!content.includes('authenticateUser')) {
  console.log('AVISO: Não foi encontrada a definição do middleware authenticateUser.');
}

console.log('Concluído! Reinicie o servidor para aplicar as alterações.'); 