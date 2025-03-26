# Instruções para Migração do Brevo para o SendPulse

Este documento contém as instruções passo a passo para realizar a migração do serviço de email marketing Brevo para o SendPulse.

## 1. Configuração da Conta SendPulse

1. Crie uma conta no SendPulse se ainda não tiver: [https://sendpulse.com/register](https://sendpulse.com/register)
2. Após criar a conta, vá até as configurações da API:
   - No painel de controle, clique em seu nome de usuário no canto superior direito
   - Selecione "Configurações"
   - Navegue até a seção "API"
3. Anote o "ID da API" e o "Segredo da API":
   - ID da API: `a0a1382e3277ea7e04b1e532aa967541`
   - Segredo da API: `9d6c11ce51069ac1a7a5afe3ef1fcead`

## 2. Criação de Listas de Contatos no SendPulse

1. No painel do SendPulse, navegue até "Email" > "Lista de Contatos"
2. Crie as seguintes listas (anote os IDs das listas):
   - Lista TRIAL - para usuários com status TRIAL
   - Lista ATIVO - para usuários com status ATIVO
   - Lista INATIVO - para usuários com status INATIVO

3. **Importante:** Anote os IDs das listas criadas. Você precisará desses valores para atualizar as configurações.

## 3. Atualização do Arquivo .env

1. Atualize o arquivo `.env` do projeto com as credenciais do SendPulse:

```
# Configurações do SendPulse
SENDPULSE_CLIENT_ID=a0a1382e3277ea7e04b1e532aa967541
SENDPULSE_CLIENT_SECRET=9d6c11ce51069ac1a7a5afe3ef1fcead
SENDPULSE_SENDER_NAME=Songmetrix
SENDPULSE_SENDER_EMAIL=noreply@songmetrix.com.br
SENDPULSE_TRIAL_LIST_ID=1  # Substitua pelo ID real da lista TRIAL 
SENDPULSE_ACTIVE_LIST_ID=2  # Substitua pelo ID real da lista ATIVO
SENDPULSE_INACTIVE_LIST_ID=3  # Substitua pelo ID real da lista INATIVO
```

2. Reinicie o servidor para aplicar as novas variáveis de ambiente.

## 4. Inicialização das Tabelas do SendPulse

1. Execute o script SQL `init-sendpulse-lists.sql` no banco de dados:
   - Acesse o painel do Supabase
   - Vá para a seção "SQL Editor"
   - Copie e cole o conteúdo do arquivo `init-sendpulse-lists.sql`
   - Atualize os valores dos `external_id` para os IDs reais das listas criadas no SendPulse
   - Execute o script

## 5. Migração dos Contatos do Brevo para o SendPulse

Para migrar os contatos existentes do Brevo para o SendPulse, siga as etapas abaixo:

1. Exporte os contatos do Brevo:
   - Acesse o painel do Brevo
   - Navegue até "Contatos" > "Listas"
   - Para cada lista, clique em "Exportar" e salve o arquivo CSV

2. Importe os contatos para o SendPulse:
   - Acesse o painel do SendPulse
   - Navegue até "Email" > "Lista de Contatos"
   - Selecione a lista correspondente (TRIAL, ATIVO ou INATIVO)
   - Clique em "Importar" e carregue o arquivo CSV exportado do Brevo
   - Mapeie os campos conforme necessário durante a importação

## 6. Teste da Nova Integração

Após concluir a migração, teste a integração para garantir que tudo esteja funcionando corretamente:

1. Crie um novo usuário com status TRIAL:
   - O usuário deve ser adicionado automaticamente à lista TRIAL no SendPulse

2. Teste o botão "Sincronizar com SendPulse" no painel de administração:
   - Acesse o painel de administração
   - Vá para a seção "Usuários"
   - Clique no botão "Sincronizar com SendPulse" para um usuário
   - Verifique se o usuário foi adicionado à lista correta no SendPulse

3. Atualize o status de um usuário:
   - O usuário deve ser movido para a lista correspondente no SendPulse

## 7. Resolução de Problemas

Se encontrar algum problema durante a migração, verifique as seguintes áreas:

1. Logs do servidor:
   - Verifique os logs do servidor para identificar erros de API ou autenticação

2. Variáveis de ambiente:
   - Verifique se as variáveis de ambiente do SendPulse estão configuradas corretamente

3. IDs das listas:
   - Confirme se os IDs das listas no arquivo `.env` correspondem aos IDs reais no SendPulse

4. Permissões da API:
   - Verifique se o ID e o Segredo da API do SendPulse têm permissões suficientes

## 8. Informações Adicionais

A migração do Brevo para o SendPulse inclui as seguintes alterações:

1. Novos endpoints de API:
   - `/api/sendpulse/sync-user` - para sincronizar um único usuário
   - `/api/sendpulse/sync-users` - para sincronizar todos os usuários (apenas para administradores)

2. Novos serviços implementados:
   - `sendpulse-service-esm.js` - implementação principal da integração com o SendPulse
   - `sendpulse-service.ts` - versão TypeScript para uso no frontend

3. Compatibilidade:
   - Os aliases para as funções do Brevo foram mantidos para compatibilidade com código existente
   - Os endpoints do Brevo serão descontinuados no futuro

## 9. Pós-migração

Após confirmar que a integração com o SendPulse está funcionando corretamente, você pode:

1. Remover as variáveis de ambiente do Brevo do arquivo `.env` (opcional, pode manter para compatibilidade)
2. Cancelar sua assinatura do Brevo, se aplicável

Don't forget to commit - Feat(api): migrate from Brevo to SendPulse email marketing service 