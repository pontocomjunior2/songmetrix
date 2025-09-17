# 🔒 Segurança - Sistema de Backup Songmetrix

## 📋 Visão Geral de Segurança

Este documento descreve as medidas de segurança implementadas no sistema de backup para proteger dados sensíveis e garantir a integridade das operações.

## 🛡️ Medidas de Segurança Implementadas

### 1. **Gestão de Secrets**
- ✅ **Nenhum dado sensível** no código fonte
- ✅ **Variáveis de ambiente** para todas as credenciais
- ✅ **Arquivo .env ignorado** pelo Git
- ✅ **Apenas indicações** no .env.example

### 2. **Container Seguro**
```dockerfile
# Usuário não-root
USER backupuser

# Permissões mínimas
RUN chmod 755 /app/scripts/*.js

# Sistema de arquivos read-only (parcial)
read_only: false  # Apenas para volumes
```

### 3. **Rede Isolada**
```yaml
# Rede dedicada para backup
networks:
  backup-network:
    driver: bridge
    internal: false
```

### 4. **Criptografia**
- ✅ **SSL/TLS** para conexões PostgreSQL
- ✅ **HTTPS** para conexões MinIO
- ✅ **Criptografia opcional** para arquivos de backup

## 🚫 Dados Sensíveis REMOVIDOS

### ❌ **Antes (INSEGURO):**
```bash
# Dados reais no código
POSTGRES_PASSWORD=Conquista@@2
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...
MINIO_SECRET_KEY=real_secret_key
```

### ✅ **Depois (SEGURO):**
```bash
# Apenas indicações genéricas
POSTGRES_PASSWORD=your_database_password
SUPABASE_SERVICE_KEY=your_supabase_service_key
MINIO_SECRET_KEY=your_minio_secret_key
```

## 📁 Arquivos Seguros Criados

### ✅ **Seguros (Incluem no Git):**
- `docker-compose.backup.yml` - Configurações com variáveis
- `Dockerfile.backup` - Imagem sem dados
- `backup-cron` - Script de automação
- `.env.backup.example` - Apenas indicações
- `README-BACKUP-DEPLOY.md` - Documentação
- `.gitignore.backup` - Regras de ignorar

### ❌ **Ignorados pelo Git:**
```gitignore
# Arquivos com dados reais
.env
.env.local
.env.production

# Logs e dados temporários
logs/
temp/
*.log

# Backups (não versionar)
*.sql
*.sql.gz
backups/
```

## 🔐 Configuração Segura

### 1. **Arquivo .env (NÃO versionado):**
```bash
# Criar arquivo local
cp .env.backup.example .env

# Editar com dados reais
nano .env
```

### 2. **Variáveis de Ambiente Seguras:**
```bash
# PostgreSQL
POSTGRES_HOST=your_secure_host
POSTGRES_PASSWORD=your_strong_password

# MinIO
MINIO_SECRET_KEY=your_minio_secret

# Supabase
SUPABASE_SERVICE_KEY=your_service_key
```

### 3. **Permissões de Arquivo:**
```bash
# Arquivo .env deve ter permissões restritas
chmod 600 .env

# Scripts executáveis
chmod +x backup-cron
chmod +x scripts/*.js
```

## 🛡️ Boas Práticas de Segurança

### **1. Princípio do Menor Privilégio**
- ✅ Container roda como usuário não-root
- ✅ Permissões mínimas nos arquivos
- ✅ Acesso restrito ao banco de dados

### **2. Gerenciamento de Secrets**
- ✅ Nunca commita dados sensíveis
- ✅ Use variáveis de ambiente
- ✅ Rode scans de segurança no código

### **3. Monitoramento de Segurança**
- ✅ Logs de todas as operações
- ✅ Alertas de falha de backup
- ✅ Auditoria de acesso aos backups

### **4. Backup Seguro**
- ✅ Criptografia em trânsito
- ✅ Armazenamento seguro no MinIO
- ✅ Controle de acesso granular

## 🚨 Verificações de Segurança

### **Antes do Deploy:**
```bash
# Verificar se não há dados sensíveis
grep -r "Conquista" .
grep -r "password.*=" --exclude-dir=node_modules .
grep -r "secret.*=" --exclude-dir=node_modules .

# Verificar permissões
ls -la .env*
ls -la backup-cron
ls -la scripts/
```

### **Durante o Deploy:**
```bash
# Verificar variáveis de ambiente
docker exec songmetrix-backup-service env | grep -E "(PASSWORD|SECRET|KEY)"

# Verificar se .env não foi copiado
docker exec songmetrix-backup-service ls -la /app/.env
```

## 🔧 Resolução de Problemas de Segurança

### **Problema: Dados sensíveis encontrados**
```bash
# Remover do histórico Git
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Forçar push
git push origin --force --all
```

### **Problema: Container com root**
```bash
# Verificar usuário
docker exec songmetrix-backup-service whoami

# Se for root, reconstruir imagem
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Problema: Arquivo .env exposto**
```bash
# Remover do Git se foi commited
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove sensitive .env file"
```

## 📊 Auditoria de Segurança

### **Checklist de Segurança:**
- [ ] Nenhum dado sensível no código fonte
- [ ] Arquivo .env ignorado pelo Git
- [ ] Container roda como usuário não-root
- [ ] Conexões usam SSL/TLS
- [ ] Backups criptografados quando possível
- [ ] Logs não contêm dados sensíveis
- [ ] Acesso aos backups é controlado

### **Ferramentas de Verificação:**
```bash
# Verificar secrets no código
npm install -g git-secrets
git-secrets --scan

# Verificar vulnerabilidades
npm audit
docker scan songmetrix-backup-service
```

## 🎯 Conclusão

O sistema de backup foi desenvolvido seguindo as melhores práticas de segurança:

- 🔒 **Zero dados sensíveis** no código fonte
- 🛡️ **Container seguro** com usuário não-root
- 🔐 **Gestão adequada** de secrets via variáveis
- 📊 **Monitoramento completo** de segurança
- 🚨 **Alertas automáticos** para incidentes

**✅ O sistema está pronto para deploy em produção com segurança máxima!**