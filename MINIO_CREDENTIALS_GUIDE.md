# 🔑 Guia para Obter Credenciais MinIO

## 📋 Métodos para Obter MINIO_ACCESS_KEY e MINIO_SECRET_KEY

### Método 1: Via Console Web do MinIO (Recomendado)

#### **Passo 1: Acesse o Console MinIO**
```bash
# Abra o navegador e acesse:
https://console.files.songmetrix.com.br

# Ou se for HTTP:
http://console.files.songmetrix.com.br
```

#### **Passo 2: Login no MinIO**
```bash
# Use as credenciais de administrador:
Username: minioadmin (ou seu usuário admin)
Password: [sua senha de admin do MinIO]
```

#### **Passo 3: Acesse Identity → Users**
```bash
# No menu lateral esquerdo:
1. Clique em "Identity"
2. Clique em "Users"
3. Veja a lista de usuários existentes
```

#### **Passo 4: Criar ou Ver Usuário**
```bash
# Se já existe um usuário para backup:
- Clique no usuário
- Vá para "Access Keys"
- Copie o Access Key e Secret Key

# Se precisar criar um novo usuário:
1. Clique "Create User"
2. Username: songmetrix_backup
3. Password: [senha forte]
4. Clique "Save"
5. Vá para "Access Keys" do usuário
6. Clique "Create Access Key"
7. Copie Access Key e Secret Key
```

#### **Passo 5: Verificar Permissões**
```bash
# Certifique-se que o usuário tem permissões:
- ReadWrite no bucket songmetrix-backups
- Ou permissões de admin se for usuário admin
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