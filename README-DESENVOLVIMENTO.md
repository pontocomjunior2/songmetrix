# Instruções para Desenvolvimento

Este documento contém instruções detalhadas para configurar e executar o ambiente de desenvolvimento do Songmetrix.

## Pré-requisitos

- Node.js (v18.x ou superior)
- npm (v9.x ou superior)
- PostgreSQL (configurado conforme as variáveis de ambiente)

## Configuração do Ambiente

1. Clone o repositório:

```bash
git clone [URL_DO_REPOSITORIO]
cd songmetrix
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente:
   - Copie o arquivo `.env.example` para `.env`
   - Preencha as variáveis necessárias, especialmente:
     - Conexão com o banco de dados PostgreSQL
     - Credenciais do Supabase
     - Credenciais do SendPulse

## Inicialização do Ambiente de Desenvolvimento

### Método Simplificado (Recomendado)

O comando a seguir iniciará todos os serviços simultaneamente:

```bash
npm run dev:all
```

Este comando utiliza o `concurrently` para iniciar:
- O servidor frontend (Vite)
- O servidor principal Node.js (API)
- O servidor de email SendPulse

Os logs de cada serviço serão exibidos com cores diferentes para facilitar a identificação.

### Gerenciamento Automático de Portas

O script `start-servers.js` agora inclui gerenciamento automático de portas:

1. **Detecção de Portas em Uso**: O script verifica automaticamente se as portas padrão (3001 para o servidor principal e 3002 para o servidor de email) já estão em uso.

2. **Atribuição Dinâmica de Portas**: Se uma porta estiver ocupada, o script automaticamente:
   - Procurará a próxima porta disponível
   - Configurará a aplicação para usar essa porta alternativa
   - Informará ao usuário sobre a mudança

3. **Logs de Portas**: Ao iniciar, o script mostrará claramente quais portas estão sendo utilizadas:
   ```
   [INFO] 🔌 Servidor principal na porta: 3001
   [INFO] 📧 Servidor de email na porta: 3002
   ```

Isso resolve problemas comuns como "EADDRINUSE: address already in use", que ocorrem quando algum processo já está usando as portas padrão.

### Execução Manual (Para Debugging)

Se preferir iniciar os serviços separadamente para um melhor controle:

**Terminal 1 - Frontend (Vite)**:
```bash
npm run dev
```

**Terminal 2 - Servidores Backend (Principal e Email)**:
```bash
npm run server:all
```

Ou, para ainda mais controle, inicie cada servidor individualmente:

**Terminal 1 - Frontend (Vite)**:
```bash
npm run dev
```

**Terminal 2 - Servidor Principal**:
```bash
npm run server
```

**Terminal 3 - Servidor de Email**:
```bash
npm run email-server
```

## Estrutura do Projeto

- `src/` - Código fonte do frontend (React/TypeScript)
- `server/` - API principal e rotas do backend
- `utils/` - Utilitários e serviços compartilhados
- `server-email.js` - Servidor dedicado para envio de emails

## Arquitetura de Email

O sistema utiliza uma arquitetura de dois servidores para o envio de emails:

1. **Servidor Principal** - Gerencia a aplicação web e outras funcionalidades
2. **Servidor de Email** - Dedicado exclusivamente ao processamento e envio de emails via SendPulse

Esta separação permite:
- Melhor escalabilidade (o servidor principal não é bloqueado por operações de email)
- Maior robustez (falhas no sistema de email não afetam o resto da aplicação)
- Facilidade de manutenção (os serviços podem ser atualizados independentemente)

## Resolução de Problemas

### Erro de Conexão com o Banco de Dados

Verifique:
- As credenciais no arquivo `.env`
- Se o PostgreSQL está em execução
- Se o firewall permite conexões na porta configurada

### Erro 404 ao Testar Envio de Email

Verifique:
- Se o servidor de email está em execução
- Se as rotas de API no frontend estão configuradas corretamente:
  - Deve apontar para `/api/email/send-test` em vez de `/api/sendpulse/send-email`
  - Deve apontar para `/api/email/send-welcome` em vez de `/api/sendpulse/send-welcome`

### Erro "EADDRINUSE: address already in use"

Este erro ocorre quando as portas 3001 ou 3002 já estão sendo utilizadas por outros processos.

Soluções:
1. O script `start-servers.js` agora resolve isso automaticamente encontrando portas disponíveis
2. Se estiver iniciando os servidores manualmente, você pode especificar portas alternativas:
   ```bash
   SERVER_PORT=3005 npm run server
   EMAIL_SERVER_PORT=3006 npm run email-server
   ```
3. Alternativamente, encerre os processos que estão usando essas portas:
   - Windows: `netstat -ano | findstr 3001` e depois `taskkill /F /PID NUMERO_DO_PROCESSO`
   - Linux/Mac: `lsof -i :3001` e depois `kill -9 NUMERO_DO_PROCESSO`

### Outros Problemas

Consulte os logs de cada serviço para obter mais detalhes sobre eventuais erros. 