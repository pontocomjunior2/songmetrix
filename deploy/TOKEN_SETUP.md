# Configuração do Token do GitHub

## Passo a Passo para Criar um Token com as Permissões Corretas

1. **Acesse as Configurações do GitHub**
   - Vá para https://github.com/settings/tokens
   - Clique em "Generate new token (classic)"
   - Ou acesse diretamente: https://github.com/settings/tokens/new

2. **Configure o Token**
   - Em "Note", coloque um nome como "SONGMETRIX_DEPLOY"
   - Em "Expiration", escolha a duração do token (recomendado: 90 dias)
   
3. **Selecione as Permissões**
   Marque as seguintes caixas:
   - [x] `repo` (todas as opções abaixo)
     - [x] `repo:status`
     - [x] `repo_deployment`
     - [x] `public_repo`
     - [x] `repo:invite`
     - [x] `security_events`
   - [x] `workflow`

4. **Gere o Token**
   - Role até o final da página
   - Clique em "Generate token"
   - **IMPORTANTE**: Copie o token gerado imediatamente! 
   - Você só verá o token uma vez

5. **Teste o Token**
   ```bash
   # No servidor, teste o acesso com curl:
   curl -H "Authorization: token SEU_TOKEN" https://api.github.com/user
   ```
   - Se funcionar, você verá suas informações do GitHub
   - Se falhar, verifique se copiou o token corretamente

## Observações Importantes

- Guarde o token em um local seguro
- Nunca compartilhe o token
- Se precisar revogar o acesso:
  1. Acesse https://github.com/settings/tokens
  2. Encontre o token "SONGMETRIX_DEPLOY"
  3. Clique em "Delete"

## Próximos Passos

Após gerar o token com as permissões corretas:
1. Execute o script de configuração do Git novamente
2. Cole o novo token quando solicitado
3. O script deve funcionar corretamente agora

## Solução de Problemas

Se ainda encontrar erro 403:
1. Verifique se o token está correto
2. Confirme se todas as permissões foram marcadas
3. Tente gerar um novo token
4. Verifique se você tem acesso ao repositório
