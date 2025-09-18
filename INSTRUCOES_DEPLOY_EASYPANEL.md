# Instruções de Deploy da Aplicação SongMetrix via EasyPanel

## 📋 Pré-requisitos

Antes de iniciar o deploy, certifique-se de que você tem:

1. **Conta no EasyPanel** - Plataforma de hospedagem com suporte a Docker
2. **Repositório Git** - Com o código da aplicação (GitHub, GitLab, etc.)
3. **Variáveis de Ambiente** - Arquivo `.env.production` configurado
4. **Banco de Dados** - PostgreSQL (recomendado: Supabase ou similar)

## 🚀 Passo 1: Preparação do Projeto

### 1.1 Arquivos Necessários

Certifique-se de que os seguintes arquivos estão no repositório:

- `Dockerfile` (já criado)
- `.dockerignore` (já criado)
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `server/server.js`
- `src/` (código fonte do frontend)
- `public/` (arquivos estáticos)
- `.env.example` (template das variáveis)

### 1.2 Configuração das Variáveis de Ambiente

Crie um arquivo `.env.production` com as seguintes variáveis essenciais:

```bash
# Banco de Dados
POSTGRES_HOST=seu-host-postgres
POSTGRES_USER=seu-usuario
POSTGRES_PASSWORD=sua-senha
POSTGRES_DB=nome-do-banco
POSTGRES_PORT=5432

# Supabase
VITE_SUPABASE_URL=sua-url-supabase
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

# JWT e Autenticação
JWT_SECRET=sua-chave-jwt-secreta

# Email (opcional)
EMAIL_HOST=smtp.seu-provedor.com
EMAIL_PORT=587
EMAIL_USER=seu-email
EMAIL_PASS=sua-senha

# Porta da aplicação
PORT=3001

# Ambiente
NODE_ENV=production
```

## 🐳 Passo 2: Configuração no EasyPanel

### 2.1 Criar Novo Projeto

1. Acesse seu painel do EasyPanel
2. Clique em **"New Project"**
3. Escolha **"Docker Compose"** como método de deploy
4. Conecte seu repositório Git

### 2.2 Configurar Docker Compose

Crie um arquivo `docker-compose.yml` na raiz do projeto:

```yaml
version: '3.8'

services:
  songmetrix:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    volumes:
      - uploads:/app/server/public/uploads
    networks:
      - songmetrix-network

  # Banco PostgreSQL (opcional - se não usar Supabase)
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=songmetrix
      - POSTGRES_USER=songmetrix_user
      - POSTGRES_PASSWORD=sua_senha_segura
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - songmetrix-network
    restart: unless-stopped

  # Redis para cache (opcional)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - songmetrix-network
    restart: unless-stopped

volumes:
  uploads:
  postgres_data:
  redis_data:

networks:
  songmetrix-network:
    driver: bridge
```

### 2.3 Configurar Domínio

1. No EasyPanel, vá para **"Domains"**
2. Adicione seu domínio personalizado
3. Configure SSL (Let's Encrypt)
4. Pinte o domínio para o serviço `songmetrix`

## 🔧 Passo 3: Configurações Avançadas

### 3.1 Health Check

Adicione uma rota de health check no seu servidor:

```javascript
// server/server.js - adicionar esta rota
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### 3.2 Configuração de Logs

No EasyPanel, configure os logs para monitoramento:

1. Vá para **"Services"** > **"songmetrix"**
2. Acesse **"Logs"**
3. Configure retenção de logs (recomendado: 7-30 dias)

### 3.3 Backup Automático

Configure backups automáticos:

1. Vá para **"Backups"**
2. Configure backup diário dos volumes
3. Configure backup do banco de dados

## 📊 Passo 4: Monitoramento

### 4.1 Métricas da Aplicação

Configure monitoramento básico:

1. **CPU e Memória**: Monitore uso de recursos
2. **Logs de Erro**: Configure alertas para erros críticos
3. **Uptime**: Configure monitoramento de disponibilidade

### 4.2 Database Monitoring

Se usar PostgreSQL próprio:

1. Configure monitoring de conexões
2. Monitore queries lentas
3. Configure alertas de espaço em disco

## 🔄 Passo 5: Deploy e Atualizações

### 5.1 Primeiro Deploy

1. Faça push do código para o repositório
2. No EasyPanel, clique em **"Deploy"**
3. Monitore os logs durante o build
4. Verifique se a aplicação está respondendo

### 5.2 Atualizações

Para atualizar a aplicação:

1. Faça as mudanças no código
2. Commit e push para o repositório
3. No EasyPanel, vá para **"Deployments"**
4. Clique em **"Redeploy"** ou configure auto-deploy

### 5.3 Rollback

Em caso de problemas:

1. Vá para **"Deployments"**
2. Selecione um deploy anterior estável
3. Clique em **"Rollback"**

## 🚨 Passo 6: Troubleshooting

### 6.1 Problemas Comuns

**Aplicação não inicia:**
- Verifique logs do container
- Confirme variáveis de ambiente
- Verifique conexão com banco de dados

**Erro 502/503:**
- Aplicação pode estar reiniciando
- Verifique health check
- Confirme porta correta (3001)

**Problemas de performance:**
- Monitore uso de CPU/memória
- Verifique queries do banco
- Considere otimização do Dockerfile

### 6.2 Logs Essenciais

```bash
# Ver logs da aplicação
docker logs songmetrix

# Ver logs em tempo real
docker logs -f songmetrix

# Ver logs do banco (se aplicável)
docker logs postgres
```

## 🔒 Passo 7: Segurança

### 7.1 Configurações de Segurança

1. **Firewall**: Configure apenas portas necessárias
2. **SSL/TLS**: Sempre use HTTPS
3. **Variáveis de Ambiente**: Nunca commite secrets
4. **Updates**: Mantenha imagens atualizadas

### 7.2 Backup de Segurança

1. Configure backups automáticos
2. Teste restauração periodicamente
3. Mantenha múltiplas cópias de backup

## 📞 Suporte

Para problemas específicos:

1. **EasyPanel**: Consulte documentação oficial
2. **Docker**: Verifique logs e configuração
3. **Aplicação**: Verifique código e configurações

## ✅ Checklist Final

- [ ] Repositório configurado
- [ ] Arquivos Docker criados
- [ ] Variáveis de ambiente configuradas
- [ ] Domínio configurado
- [ ] SSL habilitado
- [ ] Backup configurado
- [ ] Monitoramento ativo
- [ ] Primeiro deploy realizado
- [ ] Aplicação testada
- [ ] Documentação atualizada

---

**Nota**: Esta configuração é otimizada para produção. Ajuste conforme suas necessidades específicas de infraestrutura e segurança.