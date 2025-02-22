# Configuração do Repositório Songmetrix

## Passos para Configuração Local

1. **Inicializar Git Local**
   ```bash
   cd /var/www/songmetrix
   git init
   ```

2. **Configurar Remote**
   ```bash
   # Substitua SEU_TOKEN pelo token gerado no GitHub
   git remote add origin https://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@github.com/pontocomjunior2/songmetrix.git
   ```

3. **Adicionar Arquivos**
   ```bash
   git add .
   git commit -m "Configuração inicial"
   ```

4. **Enviar para o GitHub**
   ```bash
   git push -u origin main
   ```

## Verificação da Configuração

1. **Verificar Remote**
   ```bash
   git remote -v
   ```
   Deve mostrar:
   ```
   origin  https://***@github.com/pontocomjunior2/songmetrix.git (fetch)
   origin  https://***@github.com/pontocomjunior2/songmetrix.git (push)
   ```

2. **Verificar Status**
   ```bash
   git status
   ```

## Ordem de Execução

1. Primeiro, gere o token seguindo as instruções em `TOKEN_SETUP.md`
2. Configure o repositório local usando os comandos acima
3. Execute o deploy usando `deploy_with_git.sh`

## Observações

- Certifique-se de que o token tem as permissões corretas antes de começar
- Não compartilhe o token em logs ou mensagens
- Se precisar reconfigurar o remote:
  ```bash
  git remote set-url origin https://SEU_TOKEN@github.com/pontocomjunior2/songmetrix.git
