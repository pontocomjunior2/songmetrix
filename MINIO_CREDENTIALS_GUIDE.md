# 🔑 Guia para Obter Credenciais MinIO

## 🔍 **IMPORTANTE: PORTAS DO MINIO**

### **Diferença entre Console e API:**
- **Console Web:** `https://console.files.songmetrix.com.br` (porta 443/HTTPS)
- **API S3:** `https://console.files.songmetrix.com.br:9000` (porta 9000)

**⚠️ Para o MinIO Client (mc), sempre use a porta da API S3 (geralmente 9000), não a porta do console!**

### **Portas comuns do MinIO:**
- **Console:** 9443 (HTTPS) ou 9001 (HTTP)
- **API S3:** 9000 (HTTPS) ou 9000 (HTTP)
- **Seu caso específico:** HTTP na porta 9000 (sem SSL)
- **Se não souber:** Teste 9000 primeiro

---

## 🎯 **SUAS CREDENCIAIS MINIO (PRONTO PARA USAR):**

Baseado nas variáveis que você forneceu, use estas configurações:

```bash
# Credenciais corretas para o seu MinIO:
MINIO_ENDPOINT=93.127.141.215:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=Conquista@@2
MINIO_USE_SSL=false
MINIO_BUCKET=songmetrix-bkp

# Comando para configurar MinIO client:
mc alias set songmetrix-bkp https://files.songmetrix.com.br/ admin Conquista@@2

# Testar conexão:
mc ls songmetrix-bkp

# Criar bucket para backups:
mc mb songmetrix-bkp/songmetrix-backups

# Testar upload:
echo "test backup" | mc pipe songmetrix-bkp/songmetrix-backups/test.txt
```

**✅ Com essas credenciais você pode fazer o deploy imediatamente!**

---

## 📋 Métodos para Obter MINIO_ACCESS_KEY e MINIO_SECRET_KEY

### Método 0: Usar Credenciais de Admin (MAIS SIMPLES)

#### **Para começar rapidamente:**
```bash
# Use as credenciais padrão do MinIO (se não foram alteradas):
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=[sua_senha_admin_do_minio]

# Ou se você sabe as credenciais atuais:
MINIO_ACCESS_KEY=[access_key_atual]
MINIO_SECRET_KEY=[secret_key_atual]
```

**⚠️ Importante:** Para produção, crie um usuário específico usando os métodos abaixo.

---

### Método 1: Via MinIO Client (mc) - RECOMENDADO

#### **Passo 1: Instalar MinIO Client**
```bash
# Linux
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# macOS
brew install minio/stable/mc

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile "mc.exe"
```

#### **Passo 2: Configurar Alias (Importante: Use a porta API, não console)**
```bash
# ⚠️ IMPORTANTE: Use a porta da API S3, não a porta do console!
# Se o console é https://console.files.songmetrix.com.br (porta 443)
# A API S3 geralmente está na porta 9000

# Para console na porta 443/HTTPS, API geralmente na porta 9000
mc alias set songmetrix https://console.files.songmetrix.com.br:9000 minioadmin [sua_senha_admin]

# Ou se for HTTP na porta 9000
mc alias set songmetrix http://console.files.songmetrix.com.br:9000 minioadmin [sua_senha_admin]

# Verificar conexão
mc admin info songmetrix
```

#### **Passo 3: Criar Service Account (Método Atual)**
```bash
# Criar service account para backup (método mais seguro)
mc admin user svcacct add songmetrix-bkp admin \
  --access-key "songmetrix_backup_key" \
  --secret-key "sua_secret_key_aqui" \
  --description "Songmetrix Backup Service Account"

# Verificar service accounts criados
mc admin user svcacct ls songmetrix minioadmin
```

#### **Passo 4: Testar Credenciais**
```bash
# Configurar alias com as novas credenciais
mc alias set songmetrix-backup https://console.files.songmetrix.com.br songmetrix_backup_key sua_secret_key_aqui

# Testar listando buckets
mc ls songmetrix-backup

# Criar bucket de teste
mc mb songmetrix-backup/test-bucket

# Testar upload
echo "test backup" | mc pipe songmetrix-backup/test-bucket/test.txt
```

#### **Passo 5: Definir Política de Acesso**
```bash
# Criar política para backup (opcional)
cat > backup-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::songmetrix-backups/*",
        "arn:aws:s3:::songmetrix-backups"
      ]
    }
  ]
}
EOF

# Aplicar política ao service account
mc admin policy create songmetrix backup-policy backup-policy.json
mc admin policy attach songmetrix backup-policy --user songmetrix_backup_key
```

---

### Método 2: Via MinIO Client (mc)

#### **Passo 1: Instalar MinIO Client**
```bash
# Linux
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# macOS
brew install minio/stable/mc

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile "mc.exe"
```

#### **Passo 2: Configurar Alias**
```bash
# Adicionar servidor MinIO
mc alias set songmetrix https://console.files.songmetrix.com.br minioadmin [senha_admin]

# Verificar conexão
mc admin info songmetrix
```

#### **Passo 3: Criar Access Key**
```bash
# Criar access key para usuário existente
mc admin user svcacct add songmetrix minioadmin --access-key "songmetrix_backup_key" --secret-key "sua_secret_key_aqui"

# Ou listar usuários existentes
mc admin user list songmetrix

# Listar access keys
mc admin user svcacct ls songmetrix minioadmin
```

#### **Passo 4: Testar Credenciais**
```bash
# Testar com as novas credenciais
mc alias set songmetrix-backup https://console.files.songmetrix.com.br songmetrix_backup_key sua_secret_key_aqui

# Listar buckets
mc ls songmetrix-backup

# Criar bucket de teste
mc mb songmetrix-backup/test-bucket
```

---

### Método 3: Via Arquivo de Configuração

#### **Passo 1: Localizar Arquivo de Configuração**
```bash
# No servidor onde o MinIO está rodando:

# Docker
docker exec -it minio-container cat /root/.minio/config.json

# Linux
cat ~/.minio/config.json

# Ou verificar variáveis de ambiente
env | grep MINIO
```

#### **Passo 2: Ver Configuração**
```json
{
  "version": "1",
  "credential": {
    "accessKey": "minioadmin",
    "secretKey": "sua_senha_admin_real"
  },
  "region": "us-east-1"
}
```

#### **Passo 3: Usar Credenciais do Admin**
```bash
# Para produção, use as credenciais do admin
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=sua_senha_admin_real
```

---

### Método 4: Via Docker Environment (se MinIO estiver em Docker)

#### **Passo 1: Verificar Container MinIO**
```bash
# Listar containers
docker ps | grep minio

# Ver variáveis de ambiente
docker exec minio-container env | grep MINIO
```

#### **Passo 2: Ver Docker Compose**
```bash
# Se usar docker-compose
cat docker-compose.yml | grep -A 10 environment

# Exemplo de configuração:
environment:
  - MINIO_ACCESS_KEY=minioadmin
  - MINIO_SECRET_KEY=sua_senha_real
```

---

### Método 5: Via API do MinIO

#### **Passo 1: Usar cURL para API**
```bash
# Criar service account via API
curl -X POST "https://console.files.songmetrix.com.br/minio/admin/v3/add-service-account" \
  -H "Authorization: Bearer [token_admin]" \
  -H "Content-Type: application/json" \
  -d '{
    "accessKey": "songmetrix_backup",
    "secretKey": "sua_secret_key_aqui",
    "description": "Backup service account"
  }'
```

---

## 🔐 Boas Práticas de Segurança

### **1. Criar Usuário Específico**
```bash
# NÃO use credenciais de admin em produção
# ✅ Crie usuário específico para backup
# ✅ Use permissões mínimas necessárias
# ✅ Rotacione chaves periodicamente
```

### **2. Permissões Recomendadas**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::songmetrix-backups/*",
        "arn:aws:s3:::songmetrix-backups"
      ]
    }
  ]
}
```

### **3. Armazenamento Seguro**
```bash
# Guarde as credenciais em:
# ✅ Arquivo .env (não versionado)
# ✅ Secrets do EasyPanel
# ✅ Gerenciador de secrets (Vault, AWS Secrets Manager)
# ❌ NUNCA no código fonte
```

---

## 🧪 Teste das Credenciais

### **Teste 1: Conexão Básica**
```bash
# Testar conectividade
curl -k https://console.files.songmetrix.com.br/minio/health/ready
```

### **Teste 2: Autenticação**
```bash
# Testar com MinIO client
mc alias set test-minio https://console.files.songmetrix.com.br $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Listar buckets
mc ls test-minio

# Criar bucket de teste
mc mb test-minio/test-backup-bucket

# Upload de teste
echo "test backup" | mc pipe test-minio/test-backup-bucket/test.txt
```

### **Teste 3: Permissões**
```bash
# Verificar permissões
mc ls test-minio/songmetrix-backups/

# Testar upload
mc cp test.txt test-minio/songmetrix-backups/test.txt

# Testar download
mc cat test-minio/songmetrix-backups/test.txt

# Limpar teste
mc rm test-minio/test-backup-bucket/test.txt
mc rb test-minio/test-backup-bucket
```

---

## 🚨 Troubleshooting

### **Erro: Access Denied**
```bash
# Possíveis causas:
1. Credenciais incorretas
2. Usuário sem permissões no bucket
3. Bucket não existe
4. SSL/TLS não configurado corretamente

# Soluções:
mc admin policy attach songmetrix readwrite --user songmetrix_backup
```

### **Erro: Connection Refused**
```bash
# Possíveis causas:
1. URL incorreta
2. Porta bloqueada
3. Firewall
4. SSL obrigatório mas não configurado

# Testar conectividade básica:
telnet console.files.songmetrix.com.br 443
curl -k https://console.files.songmetrix.com.br
```

### **Erro: Invalid Access Key**
```bash
# Possíveis causas:
1. Access Key não existe
2. Access Key desabilitado
3. Case sensitive (verificar maiúsculas/minúsculas)

# Verificar usuários:
mc admin user list songmetrix
```

### **Erro: "S3 API Requests must be made to API port"**
```bash
# ❌ ERRADO - Usando HTTPS quando deveria ser HTTP:
mc alias set songmetrix https://console.files.songmetrix.com.br admin password

# ✅ CERTO - Usando HTTP na porta 9000 (seu caso):
mc alias set songmetrix http://93.127.141.215:9000 admin Conquista@@2

# Ou com o domínio:
mc alias set songmetrix http://console.files.songmetrix.com.br:9000 admin Conquista@@2
```

### **Para o seu caso específico:**
```bash
# Baseado nas suas variáveis de ambiente:
mc alias set songmetrix-bkp http://93.127.141.215:9000 admin Conquista@@2

# Testar conexão:
mc ls songmetrix-bkp

# Criar bucket para backups:
mc mb songmetrix-bkp/songmetrix-backups

# Testar upload:
echo "test backup" | mc pipe songmetrix-bkp/songmetrix-backups/test.txt
```

---

## 📋 Checklist para Credenciais MinIO

### **Para Produção:**
- [ ] Credenciais de usuário específico (não admin)
- [ ] Permissões mínimas no bucket songmetrix-backups
- [ ] SSL/TLS habilitado
- [ ] Credenciais testadas e funcionais
- [ ] Backup das credenciais em local seguro

### **Para Desenvolvimento:**
- [ ] Credenciais de teste isoladas
- [ ] Bucket separado para testes
- [ ] Limitação de recursos
- [ ] Monitoramento de uso

---

## 🎯 Resumo Rápido

### **Credenciais Básicas (Admin):**
```bash
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=[sua_senha_admin_real]
```

### **Credenciais Recomendadas (Usuário Específico):**
```bash
MINIO_ACCESS_KEY=songmetrix_backup
MINIO_SECRET_KEY=[secret_key_gerado]
```

### **Configuração Completa:**
```bash
MINIO_ENDPOINT=console.files.songmetrix.com.br
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_BUCKET=songmetrix-backups
```

**🎉 Com essas credenciais, o sistema de backup estará pronto para armazenar backups de forma segura no MinIO!**