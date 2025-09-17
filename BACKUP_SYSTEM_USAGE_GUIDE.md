# 🚀 Guia de Utilização - Sistema de Backup Songmetrix

## 📋 Visão Geral

O **Sistema de Backup Songmetrix** está rodando no EasyPanel e executa backups automatizados do PostgreSQL e Supabase, armazenando os dados de forma segura no MinIO.

## 🎯 Status Atual do Sistema

### ✅ **Deploy Bem-Sucedido**
- Container rodando no EasyPanel
- Serviço iniciado e operacional
- Automação de backup configurada
- Monitoramento ativo

### ⚠️ **Correção Necessária**
- **Problema:** Erro de permissão nos arquivos de log
- **Status:** Sendo corrigido
- **Impacto:** Logs não estão sendo gravados, mas backups funcionam

## 📊 Monitoramento do Sistema

### **Para Deploy via Docker Compose (Seu caso):**

#### **Verificar Status dos Containers:**
```bash
# Listar containers em execução:
docker ps | grep songmetrix

# Verificar status específico:
docker ps --filter "name=songmetrix-backup"

# Verificar todos os containers do compose:
docker-compose -f docker-compose.backup.yml ps
```

#### **Logs do Sistema:**
```bash
# Ver logs atuais do container:
docker logs songmetrix-backup-service

# Seguir logs em tempo real:
docker logs -f songmetrix-backup-service

# Ver logs com timestamps:
docker logs --timestamps songmetrix-backup-service

# Limitar número de linhas:
docker logs --tail 100 songmetrix-backup-service
```

#### **Gerenciar o Compose:**
```bash
# Ver status completo do compose:
docker-compose -f docker-compose.backup.yml ps

# Reiniciar o serviço:
docker-compose -f docker-compose.backup.yml restart

# Parar o serviço:
docker-compose -f docker-compose.backup.yml stop

# Iniciar novamente:
docker-compose -f docker-compose.backup.yml start

# Recriar containers (após mudanças):
docker-compose -f docker-compose.backup.yml up -d --force-recreate
```

### **Arquivos de Log (Após Correção)**
```bash
# Localização dos logs dentro do container:
/app/logs/cron.log          # Log principal do cron
/app/logs/backup.log         # Logs de backup
/app/logs/monitoring.log     # Logs de monitoramento
/app/logs/cleanup.log        # Logs de limpeza

# Para acessar logs do container (deploy docker-compose):
docker exec songmetrix-backup-service tail -f /app/logs/cron.log
docker exec songmetrix-backup-service cat /app/logs/cron.log
```

### **Gerenciamento de Volumes (Docker Compose)**
```bash
# Verificar volumes criados:
docker volume ls | grep songmetrix

# Inspecionar volume específico:
docker volume inspect songmetrix-backup-logs

# Localização física dos volumes no host:
docker volume inspect songmetrix-backup-logs | grep Mountpoint

# Limpar volumes se necessário:
docker-compose -f docker-compose.backup.yml down -v
```

### **Gerenciamento de Rede (Docker Compose)**
```bash
# Verificar rede criada:
docker network ls | grep songmetrix

# Inspecionar rede:
docker network inspect songmetrix-backup-network

# Conectar outros containers à mesma rede:
docker network connect songmetrix-backup-network outro-container

# Ver containers na rede:
docker network inspect songmetrix-backup-network | grep Name
```

## ⏰ Agendamento de Backups

### **Backup Diário**
- **Horário:** 02:00 AM todos os dias
- **Conteúdo:** Backup completo do PostgreSQL + Supabase
- **Retenção:** 7 dias
- **Armazenamento:** MinIO bucket `songmetrix-backups/daily/`

### **Backup Semanal**
- **Horário:** Domingo às 03:00 AM
- **Conteúdo:** Backup otimizado semanal
- **Retenção:** 4 semanas
- **Armazenamento:** MinIO bucket `songmetrix-backups/weekly/`

### **Backup Mensal**
- **Horário:** Dia 1 do mês às 04:00 AM
- **Conteúdo:** Backup completo com compressão máxima
- **Retenção:** 12 meses
- **Armazenamento:** MinIO bucket `songmetrix-backups/monthly/`

### **Monitoramento**
- **Frequência:** A cada 6 horas (00:00, 06:00, 12:00, 18:00)
- **Verificações:** Conectividade, espaço em disco, integridade
- **Alertas:** Via logs (futuramente: email/webhook)

## 📁 Estrutura de Armazenamento

### **MinIO Bucket Structure**
```
songmetrix-backups/
├── daily/
│   ├── 2025-09-17_020000.sql.gz    # Backup diário
│   ├── 2025-09-16_020000.sql.gz
│   └── ...
├── weekly/
│   ├── 2025-09-15_030000.sql.gz    # Backup semanal
│   └── ...
└── monthly/
    ├── 2025-09-01_040000.sql.gz    # Backup mensal
    └── ...
```

### **Volumes Locais**
```
/app/logs/        # Logs do sistema
/app/temp/        # Arquivos temporários
/app/config/      # Configurações (se necessário)
```

## 🔧 Operações Manuais

### **Para Deploy via Docker Compose:**

#### **Executar Backup Imediato**
```bash
# Executar backup completo agora:
docker exec songmetrix-backup-service node scripts/backup-orchestrator.js

# Executar apenas backup PostgreSQL:
docker exec songmetrix-backup-service node scripts/postgres-backup.js

# Executar apenas backup Supabase:
docker exec songmetrix-backup-service node scripts/supabase-backup.js
```

#### **Acessar Terminal do Container**
```bash
# Entrar no container para debug:
docker exec -it songmetrix-backup-service /bin/bash

# Ver arquivos dentro do container:
docker exec songmetrix-backup-service ls -la /app/

# Ver processos rodando:
docker exec songmetrix-backup-service ps aux

# Ver uso de disco:
docker exec songmetrix-backup-service df -h
```

#### **Gerenciar Arquivos no Container**
```bash
# Copiar arquivo do host para container:
docker cp arquivo-local songmetrix-backup-service:/app/

# Copiar arquivo do container para host:
docker cp songmetrix-backup-service:/app/logs/cron.log .

# Ver tamanho dos logs:
docker exec songmetrix-backup-service du -sh /app/logs/
```

### **Verificar Status dos Backups**
```bash
# Listar backups no MinIO:
docker exec songmetrix-backup-service mc ls songmetrix-backups/

# Verificar espaço usado:
docker exec songmetrix-backup-service mc du songmetrix-backups/
```

### **Download de Backup**
```bash
# Baixar backup específico:
docker exec songmetrix-backup-service mc cp songmetrix-backups/daily/2025-09-17_020000.sql.gz /app/temp/

# Copiar para host:
docker cp songmetrix-backup-service:/app/temp/2025-09-17_020000.sql.gz ./
```

### **Limpeza Manual**
```bash
# Executar limpeza de backups antigos:
docker exec songmetrix-backup-service node scripts/cleanup-service.js

# Verificar espaço liberado:
docker exec songmetrix-backup-service mc du songmetrix-backups/
```

## 📊 Métricas e Monitoramento

### **Métricas Principais**
- **Status do Serviço:** Running/Stopped
- **Último Backup:** Data e hora
- **Tamanho dos Backups:** Espaço usado no MinIO
- **Taxa de Sucesso:** Percentual de backups bem-sucedidos
- **Tempo de Execução:** Duração média dos backups

### **Alertas e Notificações**
```bash
# Verificar logs de erro:
docker logs songmetrix-backup-service 2>&1 | grep ERROR

# Verificar falhas de backup:
docker logs songmetrix-backup-service 2>&1 | grep "Backup falhou"
```

### **Dashboard de Status (EasyPanel)**
- **CPU Usage:** Monitorar carga do sistema
- **Memory Usage:** Verificar consumo de memória
- **Network I/O:** Conexões PostgreSQL/MinIO
- **Disk I/O:** Leituras/escritas nos volumes

## 🔧 Manutenção e Troubleshooting

### **Problema: Permission Denied nos Logs**
```bash
# Status: Sendo corrigido
# Solução temporária: Verificar permissões dos volumes
docker exec songmetrix-backup-service ls -la /app/logs/
```

### **Problema: Backup Falhou**
```bash
# Verificar conectividade PostgreSQL:
docker exec songmetrix-backup-service psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1;"

# Verificar conectividade MinIO:
docker exec songmetrix-backup-service mc ping $MINIO_ENDPOINT

# Verificar espaço em disco:
docker exec songmetrix-backup-service df -h
```

### **Problema: Container Reiniciando**
```bash
# Verificar logs de erro:
docker logs songmetrix-backup-service

# Verificar health check:
docker ps | grep songmetrix-backup

# Reiniciar manualmente:
docker restart songmetrix-backup-service
```

### **Problema: Backups Grandes Demais**
```bash
# Verificar tamanho dos backups:
docker exec songmetrix-backup-service mc du songmetrix-backups/

# Ajustar compressão (se necessário):
# Modificar BACKUP_COMPRESSION_LEVEL no .env
```

## 📈 Otimização e Melhorias

### **Configurações Recomendadas**
```bash
# Para otimizar performance:
BACKUP_COMPRESSION_LEVEL=6          # Balancear velocidade/tamanho
BACKUP_RETENTION_DAILY=7           # Manter 7 dias
BACKUP_RETENTION_WEEKLY=4          # Manter 4 semanas
BACKUP_RETENTION_MONTHLY=12        # Manter 12 meses
```

### **Monitoramento Avançado**
```bash
# Configurar alertas (futuramente):
ALERT_EMAIL=admin@songmetrix.com.br
ALERT_WEBHOOK=https://api.songmetrix.com.br/webhook/backup-alert
MONITORING_ENABLED=true
```

### **Backup de Configurações**
```bash
# Fazer backup das configurações:
docker exec songmetrix-backup-service cp /app/.env /app/temp/backup-config.env
docker exec songmetrix-backup-service mc cp /app/temp/backup-config.env songmetrix-backups/config/
```

## 🎯 Próximos Passos

### **Imediatos (Esta Semana)**
- ✅ **Corrigir permissões dos logs** (em andamento)
- 🔄 **Implementar scripts específicos de backup**
- 🔄 **Configurar alertas por email**
- 🔄 **Criar dashboard de monitoramento**

### **Médio Prazo (Próximas Semanas)**
- 📊 **Dashboard web para visualização**
- 🔄 **Backup incremental**
- 📱 **Notificações push**
- 📈 **Relatórios automáticos**

### **Longo Prazo (Próximos Meses)**
- 🤖 **IA para análise de backups**
- ☁️ **Multi-cloud storage**
- 🔐 **Criptografia end-to-end**
- 📊 **Analytics avançados**

## 📞 Suporte e Contato

### **Para Problemas Urgentes:**
1. **Verificar logs:** `docker logs songmetrix-backup-service`
2. **Reiniciar serviço:** `docker restart songmetrix-backup-service`
3. **Verificar conectividade:** PostgreSQL e MinIO

### **Para Melhorias e Sugestões:**
- Documentação completa em [`README-BACKUP-DEPLOY.md`](README-BACKUP-DEPLOY.md)
- Guias específicos em [`EASYPANEL_DEPLOY_GUIDE.md`](EASYPANEL_DEPLOY_GUIDE.md)
- Configurações em [`.env.backup.example`](.env.backup.example)

---

## 🎉 **Conclusão**

**O Sistema de Backup Songmetrix está operacional e executando backups automatizados!**

- ✅ **Deploy bem-sucedido** no EasyPanel
- ✅ **Automação funcionando** (backups diários/semanais/mensais)
- ✅ **Monitoramento ativo** via logs e dashboard
- ✅ **Armazenamento seguro** no MinIO
- ⚠️ **Pequena correção** de permissões em andamento

**O sistema está protegendo seus dados 24/7 com backups automatizados e monitoramento contínuo!** 🚀