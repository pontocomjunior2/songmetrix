# 🚀 Guia Completo de Deploy - Sistema de Backup no EasyPanel

## 📋 Pré-requisitos

### No EasyPanel
- ✅ Conta ativa no EasyPanel
- ✅ Servidor com Docker habilitado
- ✅ Acesso SSH ao servidor (opcional)

### No Servidor
- ✅ PostgreSQL rodando (porta 5433)
- ✅ MinIO configurado (console.files.songmetrix.com.br)
- ✅ Credenciais de acesso prontas

### Arquivos Necessários
- ✅ `docker-compose.backup.yml`
- ✅ `Dockerfile.backup`
- ✅ `backup-cron`
- ✅ `.env.backup.example`

---

## 🎯 Método 1: Deploy via Interface Web (Recomendado)

### **Passo 1: Acesse o EasyPanel**
```bash
# Abra seu navegador e acesse:
https://seu-easypanel.com
```

### **Passo 2: Criar Novo Serviço**
1. **Clique em "Add Service"**
2. **Selecione "Docker Compose"**
3. **Nome do serviço:** `songmetrix-backup`

### **Passo 3: Upload dos Arquivos**
```bash
# No painel do EasyPanel, faça upload de:
✅ docker-compose.backup.yml
✅ Dockerfile.backup
✅ backup-cron
```

### **Passo 4: Configurar Variáveis de Ambiente**
```bash
# No EasyPanel, vá para "Environment Variables" e adicione:

# PostgreSQL
POSTGRES_HOST=104.234.173.96
POSTGRES_PORT=5433
POSTGRES_DB=music_log
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha_real_aqui

# Supabase (opcional)
SUPABASE_URL=https://aylxcqaddelwxfukerhr.supabase.co
SUPABASE_SERVICE_KEY=sua_chave_real_aqui

# MinIO
MINIO_ENDPOINT=console.files.songmetrix.com.br
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=sua_access_key
MINIO_SECRET_KEY=sua_secret_key
MINIO_BUCKET=songmetrix-backups

# Configurações
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=12
BACKUP_COMPRESSION_LEVEL=9

# Monitoramento
MONITORING_ENABLED=true
ALERT_EMAIL=admin@songmetrix.com.br
ALERT_WEBHOOK=https://api.songmetrix.com.br/webhook/backup-alert
```

### **Passo 5: Configurar Volumes**
```yaml
# No EasyPanel, configure os volumes:

backup_logs:
  driver: local
  path: /opt/easypanel/data/songmetrix-backup/logs

backup_temp:
  driver: local
  path: /opt/easypanel/data/songmetrix-backup/temp

backup_config:
  driver: local
  path: /opt/easypanel/data/songmetrix-backup/config
```

### **Passo 6: Configurar Rede**
```yaml
# Permita acesso externo para conectar ao PostgreSQL
networks:
  backup-network:
    external: true
    name: songmetrix-backup-network
```

### **Passo 7: Deploy**
1. **Clique em "Deploy"**
2. **Aguarde a construção da imagem**
3. **Verifique os logs de inicialização**

---

## 🎯 Método 2: Deploy via Terminal (Avançado)

### **Passo 1: Conectar ao Servidor**
```bash
# Conecte via SSH ao servidor do EasyPanel
ssh user@seu-servidor-easypanel

# Navegue até o diretório do projeto
cd /opt/easypanel/projects/songmetrix-backup
```

### **Passo 2: Criar Estrutura**
```bash
# Criar diretório do projeto
mkdir -p /opt/easypanel/projects/songmetrix-backup
cd /opt/easypanel/projects/songmetrix-backup

# Criar subdiretórios
mkdir -p logs temp config
```

### **Passo 3: Upload dos Arquivos**
```bash
# Via SCP (do seu computador local)
scp docker-compose.backup.yml user@servidor:/opt/easypanel/projects/songmetrix-backup/
scp Dockerfile.backup user@servidor:/opt/easypanel/projects/songmetrix-backup/
scp backup-cron user@servidor:/opt/easypanel/projects/songmetrix-backup/

# Ou via SFTP/FTP do seu computador
```

### **Passo 4: Configurar .env**
```bash
# Copiar arquivo de exemplo
cp .env.backup.example .env

# Editar com dados reais
nano .env

# Conteúdo do .env (com dados reais):
NODE_ENV=production
TZ=America/Sao_Paulo
POSTGRES_HOST=104.234.173.96
POSTGRES_PORT=5433
POSTGRES_DB=music_log
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Conquista@@2
# ... resto das configurações
```

### **Passo 5: Deploy via Docker Compose**
```bash
# Fazer deploy
docker-compose -f docker-compose.backup.yml up -d

# Verificar se está rodando
docker ps | grep songmetrix-backup

# Ver logs
docker logs -f songmetrix-backup-service
```

---

## 🔧 Configurações Avançadas no EasyPanel

### **1. Health Checks**
```yaml
# Configure no EasyPanel:
healthcheck:
  test: ["CMD", "node", "-e", "require('fs').accessSync('/app/package.json')"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### **2. Resource Limits**
```yaml
# Configure limites de recursos:
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

### **3. Restart Policy**
```yaml
# Política de reinício:
restart: unless-stopped
```

### **4. Environment Variables via UI**
```bash
# No EasyPanel, você pode configurar via interface:
# Services → songmetrix-backup → Environment
```

---

## 📊 Monitoramento no EasyPanel

### **1. Status do Container**
```bash
# No EasyPanel Dashboard:
✅ Container Status: Running
✅ Health Check: Passing
✅ CPU Usage: ~5%
✅ Memory Usage: ~150MB
```

### **2. Logs em Tempo Real**
```bash
# Acesse via EasyPanel:
Services → songmetrix-backup → Logs

# Ou via terminal:
docker logs -f songmetrix-backup-service
```

### **3. Métricas de Performance**
```bash
# Monitore:
- Uso de CPU e memória
- Rede (conexões PostgreSQL/MinIO)
- I/O de disco (leituras/escritas)
- Status de health checks
```

---

## 🚨 Troubleshooting

### **Problema: Container não inicia**
```bash
# Verificar logs detalhados
docker logs songmetrix-backup-service

# Verificar variáveis de ambiente
docker exec songmetrix-backup-service env | grep POSTGRES

# Verificar conectividade
docker exec songmetrix-backup-service psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1;"
```

### **Problema: Erro de conexão PostgreSQL**
```bash
# Testar conectividade manual
docker exec songmetrix-backup-service nc -zv 104.234.173.96 5433

# Verificar credenciais
docker exec songmetrix-backup-service env | grep POSTGRES

# Testar com psql
docker exec songmetrix-backup-service psql postgresql://postgres:Conquista@@2@104.234.173.96:5433/music_log -c "SELECT COUNT(*) FROM streams;"
```

### **Problema: Erro MinIO**
```bash
# Testar conectividade
docker exec songmetrix-backup-service curl -k https://console.files.songmetrix.com.br

# Verificar credenciais MinIO
docker exec songmetrix-backup-service env | grep MINIO

# Testar upload manual
docker exec songmetrix-backup-service echo "test" > test.txt
docker exec songmetrix-backup-service mc cp test.txt songmetrix-backups/test.txt
```

### **Problema: Backup não executa**
```bash
# Verificar se cron está rodando
docker exec songmetrix-backup-service ps aux | grep backup-cron

# Verificar logs do cron
docker exec songmetrix-backup-service tail -f /app/logs/cron.log

# Executar backup manual
docker exec songmetrix-backup-service node scripts/backup-orchestrator.js
```

---

## 📋 Checklist de Deploy

### **Pré-Deploy**
- [ ] Arquivos uploaded para o servidor
- [ ] Credenciais PostgreSQL configuradas
- [ ] Credenciais MinIO configuradas
- [ ] Variáveis de ambiente definidas
- [ ] Volumes criados e configurados

### **Durante Deploy**
- [ ] Container iniciou sem erros
- [ ] Health check passando
- [ ] Conectividade PostgreSQL OK
- [ ] Conectividade MinIO OK
- [ ] Logs sem erros críticos

### **Pós-Deploy**
- [ ] Primeiro backup executado
- [ ] Arquivos no MinIO verificados
- [ ] Monitoramento configurado
- [ ] Alertas testados

---

## 🎯 Comandos Úteis

### **Gerenciamento Básico**
```bash
# Ver status
docker ps | grep songmetrix-backup

# Ver logs
docker logs -f songmetrix-backup-service

# Reiniciar
docker restart songmetrix-backup-service

# Parar
docker stop songmetrix-backup-service

# Remover
docker rm songmetrix-backup-service
```

### **Debugging Avançado**
```bash
# Acessar container
docker exec -it songmetrix-backup-service /bin/bash

# Ver processos
docker exec songmetrix-backup-service ps aux

# Ver uso de recursos
docker stats songmetrix-backup-service

# Ver rede
docker exec songmetrix-backup-service netstat -tlnp
```

### **Backup Manual**
```bash
# Executar backup imediato
docker exec songmetrix-backup-service node scripts/backup-orchestrator.js

# Verificar arquivos gerados
docker exec songmetrix-backup-service ls -la /app/temp/

# Verificar upload MinIO
docker exec songmetrix-backup-service mc ls songmetrix-backups/daily/
```

---

## 🎉 Deploy Concluído!

Após seguir este guia, você terá:

- ✅ **Sistema de backup automatizado** rodando
- ✅ **Container seguro** no EasyPanel
- ✅ **Monitoramento em tempo real** via dashboard
- ✅ **Backups diários** executados automaticamente
- ✅ **Alertas configurados** para falhas
- ✅ **Armazenamento seguro** no MinIO

**🚀 Seu sistema de backup está protegendo os dados do Songmetrix 24/7!**

---

## 📞 Suporte

Em caso de problemas:

1. **Verifique os logs** no EasyPanel
2. **Teste conectividade** com PostgreSQL/MinIO
3. **Consulte o SECURITY.md** para questões de segurança
4. **Verifique o README-BACKUP-DEPLOY.md** para troubleshooting

**🎯 O sistema está pronto para uso em produção!**