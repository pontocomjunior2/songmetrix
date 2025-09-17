# 🗄️ Songmetrix Supabase Backup Service

Serviço de backup **READ-ONLY** para o banco Supabase do Songmetrix.

## ⚠️ Segurança: Read-Only Operations Only

Este serviço foi projetado para **APENAS OPERACOES DE LEITURA**. Ele **NUNCA** modifica dados do Supabase:

- ✅ **SELECT**: Apenas leitura de dados
- ✅ **pg_dump**: Export seguro via PostgreSQL
- ❌ **INSERT/UPDATE/DELETE**: Proibido
- ❌ **DROP/CREATE/ALTER**: Proibido

## 📋 O que é Backupeado

### Tabelas Incluídas
- `auth.users` - Usuários do sistema
- `auth.sessions` - Sessões ativas
- `auth.refresh_tokens` - Tokens de refresh
- `auth.audit_log_entries` - Log de auditoria
- Todas as tabelas do schema `public`

### Excluído (por segurança)
- Schemas `graphql_public` e `graphql_private`
- Tabelas de migração (`*_migration*`)
- Tabelas de seed (`*_seed*`)

## 🚀 Como Usar

### 1. Configuração das Variáveis de Ambiente

```bash
# Conexão Supabase (READ-ONLY)
SUPABASE_DB_HOST=db.aylxcqaddelwxfukerhr.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=sua_senha_aqui

# MinIO (mesmo do backup PostgreSQL)
MINIO_ENDPOINT=files.songmetrix.com.br
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=sua_chave_secreta
MINIO_BUCKET=songmetrix-backups
MINIO_USE_SSL=true
```

### 2. Executar Backup

#### Via Docker Compose
```bash
docker-compose -f docker-compose.backup.yml up supabase-backup
```

#### Via Docker Direto
```bash
docker build -f Dockerfile.supabasebkp -t songmetrix-supabase-backup .
docker run --rm --env-file .env songmetrix-supabase-backup
```

#### Via Node.js Direto
```bash
node scripts/supabase-backup.js
```

## 📁 Estrutura dos Backups

```
songmetrix-backups/
├── postgres/
│   └── postgres-backup-2025-09-17T19-51-52.dump
└── supabase/
    └── supabase-backup-2025-09-17T19-51-52.dump
```

## 🔍 Verificação de Integridade

### Listar Conteúdo do Backup
```bash
pg_restore --list supabase-backup.dump
```

### Testar Restauração (Simulação)
```bash
pg_restore --schema-only --clean --if-exists --verbose supabase-backup.dump | head -20
```

## 🛡️ Medidas de Segurança

### 1. Usuário Não-Root
- Container executa como usuário `backupuser` (não-root)
- Sem privilégios administrativos

### 2. Rede Isolada
- Conecta apenas ao Supabase e MinIO
- Sem acesso à internet geral

### 3. Operações Read-Only
- Script validado para não conter operações de escrita
- Conexão PostgreSQL com permissões apenas de leitura

### 4. Limitação de Recursos
- CPU limitada a 0.3 cores
- Memória limitada a 256MB
- Timeout de 10 minutos por backup

## 📊 Monitoramento

### Logs
```bash
# Logs do container
docker logs songmetrix-supabase-backup-service

# Arquivos de log
tail -f /app/logs/supabase-backup.log
```

### Health Check
```bash
# Verificar conectividade com Supabase
docker exec songmetrix-supabase-backup-service pg_isready -h $SUPABASE_DB_HOST
```

## ⚠️ Limitações do Dashboard MinIO

### Problema Conhecido
O **dashboard web do MinIO** tem limitações para download de arquivos grandes:

- ❌ Downloads ficam travados em ~5%
- ❌ Timeouts para arquivos >100MB
- ❌ Problemas com arquivos binários (.dump)

### ✅ Solução: Use MinIO Client (mc) ou Script Automático

#### Opção 1: Script Automático (Recomendado)
```bash
# Executar script de download automático
node scripts/download-backup.js

# O script irá:
# - Listar backups disponíveis
# - Baixar o backup mais recente
# - Verificar integridade automaticamente
```

#### Opção 2: MinIO Client Manual
```bash
# Instalar mc (se necessário)
# Windows: https://dl.min.io/client/mc/release/windows-amd64/mc.exe
# Linux: wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc

# Configurar acesso
mc alias set songmetrix https://files.songmetrix.com.br admin SUA_SECRET_KEY

# Listar backups disponíveis
mc ls songmetrix/songmetrix-backups/ --recursive

# Baixar backup PostgreSQL
mc cp songmetrix/songmetrix-backups/daily/songmetrix-backup-2025-09-17T22-19-09.dump ./backup.dump

# Baixar backup Supabase
mc cp songmetrix/songmetrix-backups/supabase/supabase-backup-2025-09-17T22-19-09.dump ./supabase-backup.dump
```

### 🔍 Verificar Integridade do Download

```bash
# Verificar tamanho
ls -lh backup.dump

# Listar conteúdo (PostgreSQL)
pg_restore --list backup.dump | head -20

# Listar conteúdo (Supabase)
pg_restore --list supabase-backup.dump | head -20
```

### 💡 Recomendação

**Para downloads de backup, sempre use o MinIO Client (`mc`) em vez do dashboard web.**

- ✅ Downloads completos e confiáveis
- ✅ Verificação automática de integridade
- ✅ Suporte total para arquivos grandes
- ✅ Funciona via linha de comando ou scripts

## 🔄 Restauração de Emergência

### Cenário: Supabase Corrompido

1. **Criar novo projeto Supabase**
2. **Restaurar backup**:
   ```bash
   pg_restore --verbose --clean --if-exists --create supabase-backup.dump
   ```
3. **Verificar integridade**:
   ```bash
   # Contar registros em tabelas críticas
   psql -c "SELECT schemaname, tablename, n_tup_ins FROM pg_stat_user_tables;"
   ```

## ⚙️ Configuração Avançada

### Personalizar Tabelas Excluídas
```javascript
// Em supabase-backup.js, modificar pg_dump command
--exclude-table='tabela_nao_desejada'
```

### Alterar Frequência de Backup
```yaml
# Em docker-compose.backup.yml
command: ["sh", "-c", "while true; do node scripts/supabase-backup.js; sleep 86400; done"]
```

## 🚨 Troubleshooting

### Erro: "Permission denied"
- Verificar credenciais Supabase
- Confirmar que usuário tem permissões de leitura

### Erro: "Connection refused"
- Verificar conectividade de rede
- Confirmar host e porta do Supabase

### Erro: "MinIO upload failed"
- Verificar credenciais MinIO
- Confirmar bucket existe

## 📞 Suporte

Para problemas específicos:
1. Verificar logs do container
2. Testar conectividade manualmente
3. Validar variáveis de ambiente

**Lembrete**: Este serviço é **100% READ-ONLY** e seguro para produção.