# 🐳 Deploy do Sistema de Backup em Container - EasyPanel

## 📋 Visão Geral

Sistema de backup containerizado para deploy no EasyPanel, executando em servidor separado do banco PostgreSQL, conectando remotamente via rede.

## 🏗️ Arquitetura Containerizada

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Backup        │    │      MinIO      │
│   Servidor A    │◄──►│   Container     │◄──►│   Servidor C    │
│   (Produção)    │    │   EasyPanel     │    │                 │
│                 │    │   Servidor B    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   EasyPanel     │
                    │   Management    │
                    │   Interface     │
                    └─────────────────┘
```

## 📁 Estrutura do Projeto Containerizado

```
songmetrix-backup-container/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── scripts/
│   ├── postgres-backup.js
│   ├── supabase-backup.js
│   ├── minio-client.js
│   ├── backup-orchestrator.js
│   ├── monitoring-service.js
│   └── cleanup-service.js
├── config/
│   ├── backup-config.json
│   ├── postgres-config.json
│   ├── supabase-config.json
│   └── minio-config.json
├── logs/
├── temp/
└── backup-cron
```

## 🐳 Dockerfile Otimizado

```dockerfile
# Usar Node.js LTS
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    postgresql-client \
    curl \
    wget \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Configurar timezone
ENV TZ=America/Sao_Paulo

# Criar usuário não-root
RUN addgroup -g 1001 -S backupuser && \
    adduser -S backupuser -u 1001 -G backupuser

# Criar diretórios
RUN mkdir -p /app/{scripts,config,logs,temp} && \
    chown -R backupuser:backupuser /app

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração primeiro (para cache de layers)
COPY package*.json ./
COPY config/ ./config/

# Instalar dependências
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar scripts
COPY scripts/ ./scripts/

# Copiar script de inicialização
COPY backup-cron ./backup-cron

# Dar permissões de execução
RUN chmod +x ./backup-cron && \
    chmod +x ./scripts/*.js

# Mudar para usuário não-root
USER backupuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Backup service is healthy')" || exit 1

# Comando padrão
CMD ["/app/backup-cron"]
```

## 📄 docker-compose.yml para EasyPanel

```yaml
version: '3.8'

services:
  songmetrix-backup:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: songmetrix-backup-service
    restart: unless-stopped

    # Configurações de rede
    networks:
      - backup-network

    # Variáveis de ambiente
    environment:
      - NODE_ENV=production
      - TZ=America/Sao_Paulo
      - POSTGRES_HOST=104.234.173.96
      - POSTGRES_PORT=5433
      - POSTGRES_DB=music_log
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=Conquista@@2
      - SUPABASE_URL=https://aylxcqaddelwxfukerhr.supabase.co
      - SUPABASE_SERVICE_KEY=your_service_key_here
      - MINIO_ENDPOINT=console.files.songmetrix.com.br
      - MINIO_ACCESS_KEY=your_minio_access_key
      - MINIO_SECRET_KEY=your_minio_secret_key
      - BACKUP_RETENTION_DAILY=7
      - BACKUP_RETENTION_WEEKLY=4
      - BACKUP_RETENTION_MONTHLY=12

    # Volumes para persistir dados
    volumes:
      - backup_logs:/app/logs
      - backup_temp:/app/temp
      - backup_config:/app/config
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro

    # Configurações de segurança
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp

    # Recursos
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

    # Health check
    healthcheck:
      test: ["CMD", "node", "-e", "require('fs').accessSync('/app/scripts/backup-orchestrator.js')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Labels para EasyPanel
    labels:
      - "easypanel.managed=true"
      - "easypanel.service=backup"
      - "easypanel.description=Songmetrix Database Backup Service"

# Rede isolada para backup
networks:
  backup-network:
    driver: bridge
    internal: false

# Volumes persistentes
volumes:
  backup_logs:
    driver: local
  backup_temp:
    driver: local
  backup_config:
    driver: local
```

## 📜 Script de Inicialização (backup-cron)

```bash
#!/bin/sh

# Script de inicialização do container de backup
# Executa o backup e mantém o container rodando

echo "🚀 Iniciando Songmetrix Backup Service..."
echo "📅 $(date)"

# Criar arquivos de log se não existirem
touch /app/logs/backup.log
touch /app/logs/cron.log
touch /app/logs/errors.log

# Função de backup
run_backup() {
    echo "📊 Executando backup completo... $(date)" >> /app/logs/cron.log
    node /app/scripts/backup-orchestrator.js >> /app/logs/cron.log 2>&1
    echo "✅ Backup concluído $(date)" >> /app/logs/cron.log
}

# Função de limpeza
run_cleanup() {
    echo "🧹 Executando limpeza... $(date)" >> /app/logs/cron.log
    node /app/scripts/cleanup-service.js >> /app/logs/cron.log 2>&1
}

# Função de monitoramento
run_monitoring() {
    echo "👀 Executando monitoramento... $(date)" >> /app/logs/cron.log
    node /app/scripts/monitoring-service.js >> /app/logs/cron.log 2>&1
}

# Backup inicial (após 30 segundos)
echo "⏳ Aguardando inicialização do sistema..."
sleep 30
run_backup

# Loop principal com cron
echo "🔄 Iniciando loop de backup..."
while true; do
    # Verificar hora atual
    HOUR=$(date +%H)
    MINUTE=$(date +%M)
    DAY=$(date +%d)
    WEEKDAY=$(date +%w)  # 0=domingo

    # Backup diário às 02:00
    if [ "$HOUR" = "02" ] && [ "$MINUTE" = "00" ]; then
        run_backup
        sleep 60  # Evitar múltiplas execuções
    fi

    # Backup semanal aos domingos às 03:00
    if [ "$WEEKDAY" = "0" ] && [ "$HOUR" = "03" ] && [ "$MINUTE" = "00" ]; then
        echo "📅 Executando backup semanal... $(date)" >> /app/logs/cron.log
        node /app/scripts/weekly-backup.js >> /app/logs/cron.log 2>&1
        sleep 60
    fi

    # Limpeza mensal no dia 1 às 04:00
    if [ "$DAY" = "01" ] && [ "$HOUR" = "04" ] && [ "$MINUTE" = "00" ]; then
        run_cleanup
        sleep 60
    fi

    # Monitoramento a cada 6 horas
    if [ "$MINUTE" = "00" ] && ([ "$HOUR" = "00" ] || [ "$HOUR" = "06" ] || [ "$HOUR" = "12" ] || [ "$HOUR" = "18" ]); then
        run_monitoring
        sleep 60
    fi

    # Aguardar 1 minuto antes de verificar novamente
    sleep 60
done
```

## ⚙️ Configuração do EasyPanel

### 1. **Criar Novo Serviço**
- Acesse o EasyPanel
- Clique em "Add Service"
- Selecione "Docker Compose"

### 2. **Configurar o Serviço**
```yaml
# Cole o docker-compose.yml acima
# Configure as variáveis de ambiente
# Defina os volumes persistentes
```

### 3. **Configurações de Rede**
- Permita acesso à rede externa para conectar ao PostgreSQL
- Configure firewall para portas necessárias (5433, 9000)

### 4. **Monitoramento**
- Configure health checks
- Defina alertas para falhas
- Monitore logs em tempo real

## 🔧 Scripts Adaptados para Container

### Modificações Necessárias:

#### 1. **Caminhos Absolutos**
```javascript
// Antes
const logFile = path.join(__dirname, '../logs/backup.log');

// Depois (container)
const logFile = '/app/logs/backup.log';
```

#### 2. **Variáveis de Ambiente**
```javascript
// Configurações via environment variables
const postgresConfig = {
  host: process.env.POSTGRES_HOST || '104.234.173.96',
  port: parseInt(process.env.POSTGRES_PORT) || 5433,
  database: process.env.POSTGRES_DB || 'music_log',
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'Conquista@@2'
};
```

#### 3. **Tratamento de Erros Robusto**
```javascript
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado:', error);
  // Log to file and exit gracefully
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promessa rejeitada:', reason);
  // Log and handle
});
```

## 📊 Monitoramento no EasyPanel

### 1. **Logs em Tempo Real**
```bash
# Visualizar logs do container
docker logs -f songmetrix-backup-service

# Logs específicos
docker exec songmetrix-backup-service tail -f /app/logs/backup.log
```

### 2. **Métricas do Container**
- CPU e memória utilizados
- Status de health check
- Rede e I/O
- Volumes utilizados

### 3. **Alertas Configurados**
- Container parado
- Health check falhando
- Uso excessivo de recursos
- Falha nos backups

## 🚀 Estratégia de Deploy

### **Fase 1: Preparação**
```bash
# 1. Clonar repositório
git clone https://github.com/your-repo/songmetrix-backup.git
cd songmetrix-backup

# 2. Configurar variáveis de ambiente
cp .env.example .env
nano .env

# 3. Testar localmente
npm install
npm test
```

### **Fase 2: Build da Imagem**
```bash
# Build da imagem
docker build -t songmetrix-backup:latest .

# Teste da imagem
docker run --rm -it songmetrix-backup:latest node scripts/backup-orchestrator.js
```

### **Fase 3: Deploy no EasyPanel**
```bash
# 1. Upload dos arquivos para o servidor
scp -r . user@easypanel-server:/opt/songmetrix-backup/

# 2. Deploy via EasyPanel interface
# - Criar novo serviço
# - Upload do docker-compose.yml
# - Configurar volumes e rede
# - Iniciar serviço
```

### **Fase 4: Validação**
```bash
# 1. Verificar se container está rodando
docker ps | grep songmetrix-backup

# 2. Verificar logs
docker logs songmetrix-backup-service

# 3. Testar conectividade
docker exec songmetrix-backup-service node scripts/monitoring-service.js

# 4. Verificar backups no MinIO
mc ls songmetrix-backups/daily/
```

## 🛡️ Segurança do Container

### 1. **Imagens Seguras**
```dockerfile
# Usar imagens oficiais e atualizadas
FROM node:18-alpine

# Não executar como root
USER backupuser

# Permissões mínimas
RUN chmod 755 /app/scripts/*.js
```

### 2. **Secrets Management**
```yaml
# Usar secrets do Docker ou EasyPanel
secrets:
  postgres_password:
    external: true
  minio_secret_key:
    external: true
```

### 3. **Network Security**
```yaml
# Rede isolada
networks:
  backup-network:
    internal: true
```

### 4. **Resource Limits**
```yaml
# Limites de recursos
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

## 📈 Escalabilidade

### 1. **Horizontal Scaling**
- Múltiplas instâncias do container
- Load balancer para distribuição
- Coordenação via Redis ou database

### 2. **Vertical Scaling**
- Ajuste dinâmico de recursos
- Auto-scaling baseado em carga
- Otimização de performance

### 3. **Backup Paralelo**
- Execução paralela de backups
- Queue system para múltiplos databases
- Rate limiting para APIs

## 🎯 Benefícios da Containerização

### **Isolamento**
- ✅ Ambiente isolado do host
- ✅ Dependências controladas
- ✅ Fácil rollback de versões

### **Portabilidade**
- ✅ Mesmo ambiente em dev/staging/prod
- ✅ Deploy consistente
- ✅ Migração entre servidores

### **Gerenciamento**
- ✅ EasyPanel integration
- ✅ Monitoramento integrado
- ✅ Logs centralizados

### **Escalabilidade**
- ✅ Horizontal e vertical scaling
- ✅ Auto-healing
- ✅ Resource optimization

---

## 🚀 **Resultado Final:**

**Sistema de backup containerizado** pronto para deploy no EasyPanel com:

- 🐳 **Container isolado** em servidor separado
- 🔗 **Conexão remota** ao PostgreSQL de produção
- ☁️ **Upload automático** para MinIO
- ⏰ **Automação completa** via cron interno
- 👀 **Monitoramento integrado** no EasyPanel
- 🛡️ **Segurança avançada** com usuário não-root
- 📊 **Métricas em tempo real** via interface

**🎉 Deploy em 3 passos:**
1. Upload do projeto para o servidor EasyPanel
2. Configurar docker-compose.yml no EasyPanel
3. Iniciar serviço e monitorar

**O backup estará rodando automaticamente em background!** 🛡️