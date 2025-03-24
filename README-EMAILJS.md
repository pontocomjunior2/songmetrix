# Configuração do EmailJS no SongMetrix

Este documento explica como configurar o EmailJS para o envio de emails no sistema SongMetrix.

## O que é o EmailJS?

EmailJS é um serviço que permite enviar emails diretamente do cliente usando apenas JavaScript, sem a necessidade de um servidor próprio para processamento de emails. Isto simplifica a infraestrutura e permite um envio mais confiável de emails.

## Benefícios do EmailJS

1. **Simplicidade**: Envio de emails sem a necessidade de um servidor SMTP próprio
2. **Confiabilidade**: Serviço especializado em entrega de emails
3. **Analytics**: Acompanhamento de métricas de entrega e abertura
4. **Templates**: Gerenciamento de templates de email pelo painel do EmailJS
5. **Segurança**: Nenhuma credencial sensível exposta no frontend

## Passo a Passo para Configuração

### 1. Criar uma conta no EmailJS

1. Acesse [EmailJS](https://www.emailjs.com/) e crie uma conta gratuita
2. Confirme seu email e faça login no painel administrativo

### 2. Configurar um Serviço de Email

1. No painel do EmailJS, vá para "Email Services" (Serviços de Email)
2. Clique em "Add New Service" (Adicionar Novo Serviço)
3. Escolha seu provedor de email (Gmail, Outlook, etc.) ou selecione "Other" para SMTP personalizado
4. Siga as instruções para configurar suas credenciais do serviço de email
5. Anote o `Service ID` gerado, você vai precisar dele

### 3. Criar um Template de Email

1. No painel do EmailJS, vá para "Email Templates" (Templates de Email)
2. Clique em "Create New Template" (Criar Novo Template)
3. Crie o design do seu template usando o editor visual ou o modo HTML
4. Certifique-se de incluir as variáveis de template abaixo:
   - `{{to_email}}`: Email do destinatário
   - `{{to_name}}`: Nome do destinatário
   - `{{subject}}`: Assunto do email
   - `{{message}}`: Corpo do email (conteúdo HTML)
5. Salve o template e anote o `Template ID` gerado

### 4. Obter a Chave Pública da API

1. No painel do EmailJS, vá para "Account" (Conta)
2. Na seção "API Keys" (Chaves de API), você encontrará sua "Public Key"
3. Anote esta chave pública

### 5. Configurar o Arquivo .env

Abra o arquivo `.env` do projeto e atualize as seguintes variáveis:

```
# EmailJS Configuration (Server-side)
EMAILJS_PUBLIC_KEY=sua_chave_publica_aqui
EMAILJS_SERVICE_ID=seu_service_id_aqui
EMAILJS_TEMPLATE_ID=seu_template_id_aqui

# EmailJS Client-side Configuration
VITE_EMAILJS_PUBLIC_KEY=sua_chave_publica_aqui
VITE_EMAILJS_SERVICE_ID=seu_service_id_aqui
VITE_EMAILJS_TEMPLATE_ID=seu_template_id_aqui
```

## Testando o Envio de Emails

Após a configuração, você pode testar o envio de emails utilizando o componente "Testar Envio de Email" no painel administrativo:

1. Acesse o painel administrativo
2. Vá para "Gerenciar Emails" > "Testar Envio"
3. Informe um email de destino válido e selecione um template
4. Clique em "Enviar Email de Teste"

## Solução de Problemas

Se você encontrar problemas no envio de emails, verifique:

1. **Verificação de Chaves**: Certifique-se de que todas as chaves do EmailJS estão corretas no arquivo `.env`
2. **Limite de Envios**: A conta gratuita do EmailJS tem limites de envio mensais
3. **Template Configurado**: Verifique se o template contém todas as variáveis necessárias
4. **Logs do Console**: Verifique os logs do navegador para possíveis erros de JavaScript
5. **Logs do Servidor**: Verifique os logs do servidor para erros relacionados ao EmailJS

## Configurando o Modo de Fallback

O sistema está configurado para usar o EmailJS diretamente no cliente quando possível, mas cairá no modo de fallback usando o servidor em caso de problemas:

1. Se as variáveis de ambiente do cliente (`VITE_EMAILJS_*`) estiverem configuradas, o sistema tentará enviar emails diretamente do cliente
2. Se falhar ou se as variáveis não estiverem disponíveis, o sistema usará o servidor como fallback

## Segurança e Considerações

- O EmailJS usa sua chave pública que é segura para expor no frontend
- As credenciais do serviço de email são armazenadas com segurança nos servidores do EmailJS
- Mesmo que alguém acesse sua chave pública, eles só poderão enviar emails através dos seus templates configurados 