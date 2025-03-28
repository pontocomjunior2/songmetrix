// scripts/verify-module-paths.js
// Script para verificar e corrigir caminhos de módulos na aplicação

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Cores para as mensagens no console
const colors = {
  error: '\x1b[31m%s\x1b[0m', // Vermelho
  success: '\x1b[32m%s\x1b[0m', // Verde
  warning: '\x1b[33m%s\x1b[0m', // Amarelo
  info: '\x1b[34m%s\x1b[0m', // Azul
  reset: '\x1b[0m'
};

// Função para exibir mensagens formatadas
function log(type, message) {
  const color = colors[type] || colors.info;
  console.log(color, message);
}

// Função para verificar se um arquivo existe
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

// Função para verificar importações em um arquivo
function checkImports(filePath) {
  try {
    if (!fileExists(filePath)) {
      log('error', `Arquivo não encontrado: ${filePath}`);
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    
    const moduleReferences = [];
    let match;
    
    while (match = importRegex.exec(content)) {
      const importPath = match[1];
      
      // Ignorar módulos do node
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }
      
      moduleReferences.push({
        reference: importPath,
        position: match.index,
        length: match[0].length
      });
    }
    
    return moduleReferences;
  } catch (error) {
    log('error', `Erro ao analisar o arquivo ${filePath}: ${error.message}`);
    return [];
  }
}

// Função para resolver o caminho completo de um módulo
function resolveModulePath(basePath, importPath) {
  // Resolver caminho completo
  let resolvedPath = path.resolve(path.dirname(basePath), importPath);
  
  // Verificar variações com extensões comuns
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
  
  // Se o caminho resolvido existe diretamente
  if (fileExists(resolvedPath)) {
    return { exists: true, path: resolvedPath };
  }
  
  // Verificar se adicionando extensões funciona
  for (const ext of extensions) {
    const pathWithExt = `${resolvedPath}${ext}`;
    if (fileExists(pathWithExt)) {
      return { exists: true, path: pathWithExt };
    }
  }
  
  // Verificar se é um diretório com index
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fileExists(indexPath)) {
        return { exists: true, path: indexPath };
      }
    }
  }
  
  return { exists: false, path: resolvedPath };
}

// Função para sugerir caminhos alternativos
function suggestAlternativePaths(importPath) {
  // Remover qualquer extensão existente
  const pathWithoutExt = importPath.replace(/\.[^/.]+$/, '');
  
  // Se caminho começa com ./
  if (pathWithoutExt.startsWith('./')) {
    return [
      `../utils/${path.basename(pathWithoutExt)}.js`,
      `../utils/${path.basename(pathWithoutExt)}.ts`
    ];
  } 
  
  // Se caminho começa com ../
  if (pathWithoutExt.startsWith('../')) {
    return [
      `./utils/${path.basename(pathWithoutExt)}.js`,
      `./utils/${path.basename(pathWithoutExt)}.ts`
    ];
  }
  
  // Para caminhos absolutos, sugerimos tanto /utils quanto /server
  return [
    `../utils/${path.basename(pathWithoutExt)}.js`,
    `../utils/${path.basename(pathWithoutExt)}.ts`,
    `../server/${path.basename(pathWithoutExt)}.js`,
    `../server/${path.basename(pathWithoutExt)}.ts`
  ];
}

// Função para verificar e corrigir as importações nos arquivos
async function checkAndFixImports() {
  // Arquivos principais a verificar
  const filesToCheck = [
    path.join(rootDir, 'server', 'sendpulse-email-service.js'),
    path.join(rootDir, 'server-email.js')
  ];
  
  let foundIssues = false;
  
  for (const filePath of filesToCheck) {
    log('info', `\nVerificando importações em: ${filePath}`);
    
    const moduleReferences = checkImports(filePath);
    
    for (const moduleRef of moduleReferences) {
      const { reference, position } = moduleRef;
      const resolved = resolveModulePath(filePath, reference);
      
      if (!resolved.exists) {
        foundIssues = true;
        log('error', `❌ Módulo não encontrado: ${reference}`);
        
        // Sugerir caminhos alternativos
        const suggestions = suggestAlternativePaths(reference);
        
        for (const suggestion of suggestions) {
          const suggested = resolveModulePath(filePath, suggestion);
          if (suggested.exists) {
            log('success', `✅ Sugestão encontrada: ${suggestion}`);
            
            // Perguntar se deseja corrigir a importação
            const shouldFix = process.argv.includes('--fix') || process.argv.includes('-f');
            
            if (shouldFix) {
              log('info', `🔧 Corrigindo importação em ${filePath}`);
              
              // Ler conteúdo do arquivo
              const content = fs.readFileSync(filePath, 'utf8');
              
              // Substituir a importação
              const newContent = content.replace(
                new RegExp(`import\\s+([\\w\\s{},*]+)\\s+from\\s+['"]${reference.replace(/\./g, '\\.').replace(/\//g, '\\/')}['"]`),
                `import $1 from '${suggestion}'`
              );
              
              // Escrever de volta ao arquivo
              fs.writeFileSync(filePath, newContent, 'utf8');
              
              log('success', `✅ Importação corrigida para: ${suggestion}`);
            } else {
              log('warning', `⚠️ Use --fix ou -f para corrigir automaticamente`);
            }
            
            break;
          }
        }
      } else {
        log('success', `✅ Importação válida: ${reference}`);
      }
    }
  }
  
  return foundIssues;
}

// Executar o script
(async () => {
  log('info', '🔍 Verificando caminhos de módulos na aplicação...');
  
  const foundIssues = await checkAndFixImports();
  
  if (!foundIssues) {
    log('success', '✅ Todos os caminhos de módulos estão corretos!');
  } else if (!process.argv.includes('--fix') && !process.argv.includes('-f')) {
    log('warning', '⚠️ Foram encontrados problemas. Execute com --fix para corrigir automaticamente.');
  }
})(); 