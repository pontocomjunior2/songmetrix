# 🚀 Deploy do Sistema de Backup - EasyPanel

## 📋 Arquivos Criados

- ✅ [`docker-compose.backup.yml`](docker-compose.backup.yml) - Compose para EasyPanel
- ✅ [`Dockerfile.backup`](Dockerfile.backup) - Imagem otimizada
- ✅ [`backup-cron`](backup-cron) - Script de automação
- ✅ [`.env.backup.example`](.env.backup.example) - Variáveis de ambiente
- ✅ [`.gitignore.backup`](.gitignore.backup) - Regras Git seguras
- ✅ [`SECURITY.md`](SECURITY.md) - Guia de segurança completo

## 🎯 Deploy em 4 Passos

### **Passo 1: Upload dos Arquivos**
```bash
# Criar diretório no servidor EasyPanel
mkdir -p /opt/songmetrix-backup
cd /opt/songmetrix-backup

# Upload dos arquivos via SCP, FTP ou Git
# docker-compose.backup.yml
# Dockerfile.backup
# backup-cron
# .env.backup.example
```

### **Passo 2: Configurar Variáveis**
```bash
# Copiar arquivo de exemplo
cp .env.backup.example .env

# Editar com suas configurações
nano .env
```

**Variáveis críticas:**
```bash
# PostgreSQL
POSTGRES_HOST=your_postgres_host
POSTGRES_PORT=5432
POSTGRES_PASSWORD=your_database_password

# MinIO
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
```

### **Passo 3: EasyPanel**
1. **Acesse o EasyPanel**
2. **Clique "Add Service"**
3. **Selecione "Docker Compose"**
4. **Upload do `docker-compose.backup.yml`**
5. **Configure as variáveis de ambiente**
6. **Defina os volumes persistentes**
7. **Inicie o serviço**

### **Passo 4: Validação**
```bash
# Verificar se container está rodando
docker ps | grep songmetrix-backup

# Ver logs
docker logs songmetrix-backup-service

# Testar backup manual
docker exec songmetrix-backup-service node scripts/backup-orchestrator.js
```

## 📊 Monitoramento

### **Logs em Tempo Real**
```bash
# Via EasyPanel ou terminal
docker logs -f songmetrix-backup-service
```

### **Status do Serviço**
```bash
# Verificar saúde
curl http://localhost:3000/health

# Ver métricas
docker stats songmetrix-backup-service
```

## 🔧 Configurações de Rede

### **Conexão PostgreSQL**
- ✅ **Host:** `your_postgres_host:5432`
- ✅ **Database:** `your_database_name`
- ✅ **User:** `your_database_user`

### **Conexão MinIO**
- ✅ **Endpoint:** `your_minio_endpoint`
- ✅ **Bucket:** `your_backup_bucket`
- ✅ **SSL:** Habilitado

## ⏰ Agendamento Automático

| Tipo | Horário | Descrição |
|------|---------|-----------|
| **Diário** | 02:00 AM | Backup completo |
| **Semanal** | Domingo 03:00 AM | Backup otimizado |
| **Mensal** | Dia 1 04:00 AM | Backup compressão máxima |
| **Monitoramento** | A cada 6h | Status e alertas |

## 📁 Estrutura Final

```
/opt/songmetrix-backup/
├── docker-compose.backup.yml
├── Dockerfile.backup
├── backup-cron
├── .env
├── logs/           # Volume persistente
├── temp/           # Volume persistente
└── config/         # Volume persistente
```

## 🚨 Troubleshooting

### **Container não inicia**
```bash
# Ver logs detalhados
docker logs songmetrix-backup-service

# Verificar variáveis
docker exec songmetrix-backup-service env
```

### **Erro de conexão PostgreSQL**
```bash
# Testar conectividade
docker exec songmetrix-backup-service psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB
```

### **Erro MinIO**
```bash
# Testar conexão
docker exec songmetrix-backup-service mc ping console.files.songmetrix.com.br
```

## 🎉 Sucesso!

Após o deploy, o sistema irá:
- ✅ **Fazer backup automático** todos os dias
- ✅ **Enviar para MinIO** automaticamente
- ✅ **Monitorar saúde** continuamente
- ✅ **Enviar alertas** se houver problemas
- ✅ **Limpar backups antigos** automaticamente

**🎊 Sistema de backup totalmente automatizado e monitorado!**