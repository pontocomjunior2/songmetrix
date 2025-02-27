# Configuração do Git para Deploy

## Pré-requisitos

1. **Token de Acesso Pessoal do GitHub**
   - Acesse: https://github.com/settings/tokens
   - Clique em "Generate new token (classic)"
   - Marque as seguintes permissões:
     - `repo` (acesso completo ao repositório)
     - `workflow` (opcional, se usar GitHub Actions)
   - Copie o token gerado (você só verá ele uma vez)

## Passos para Configuração

1. **Executar Script de Configuração**
   ```bash
   cd /var/www/songmetrix
   sudo bash deploy/git_setup.sh
   ```
   - Cole o token quando solicitado
   - O script irá:
     - Fazer backup do diretório atual (se necessário)
     - Clonar o repositório
     - Configurar as credenciais do Git

2. **Verificar a Configuração**
   ```bash
   git status
   ```
   - Deve mostrar o status atual do repositório

## Ordem de Execução dos Scripts

1. Primeiro, configure o Git:
   ```bash
   sudo bash deploy/git_setup.sh
   ```

2. Depois, execute o deploy:
   ```bash
   sudo bash deploy/deploy_with_git.sh
   ```

## Solução de Problemas

Se encontrar erros de autenticação:

1. **Verificar configuração do remote**:
   ```bash
   git remote -v
   ```
   - Deve mostrar a URL com o formato: `https://<token>@github.com/pontocomjunior2/songmetrix.git`

2. **Reconfigurar token**:
   - Execute o script git_setup.sh novamente
   - Forneça um novo token se necessário

3. **Limpar credenciais armazenadas**:
   ```bash
   git config --global --unset credential.helper
   git config --global credential.helper store
   ```

## Observações

- Mantenha seu token seguro
- Não compartilhe o token em logs ou mensagens
- O token é armazenado de forma segura pelo Git
- Se precisar revogar o acesso, você pode deletar o token no GitHub e gerar um novo
