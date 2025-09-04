# 🚀 Instruções de Deploy - Correção de Token de Autenticação

## 📋 Resumo da Correção

**Problema**: Usuários sendo deslogados após 15 minutos, necessitando F5 ou novo login.

**Solução**: Implementação de sessão de 2 horas com refresh automático de token.

## 🔧 Arquivos Modificados

1. **`src/lib/supabase-client.ts`** - Cliente Supabase otimizado
2. **`src/lib/auth.ts`** - Gerenciamento de tokens melhorado  
3. **`src/lib/api-client.ts`** - Cliente de API com tokens válidos
4. **`src/config/session.ts`** - Configurações centralizadas (novo)

## 📦 Deploy dos Arquivos

### Opção 1: Deploy Completo (Recomendado)
```bash
# 1. Fazer backup do ambiente atual
cp -r /var/www/html/songmetrix /var/www/html/songmetrix_backup_$(date +%Y%m%d_%H%M%S)

# 2. Fazer upload da pasta dist/ para o servidor
# Substituir todo o conteúdo da pasta web

# 3. Verificar permissões
chmod -R 755 /var/www/html/songmetrix
```

### Opção 2: Deploy Seletivo (Apenas JS/CSS)
```bash
# Fazer backup apenas dos assets
cp -r /var/www/html/songmetrix/assets /var/www/html/songmetrix/assets_backup

# Substituir apenas arquivos JS e CSS da pasta dist/assets/
```

## ⚙️ Configuração do Servidor Web

### Nginx (Recomendado)
```nginx
server {
    listen 80;
    server_name songmetrix.com.br;
    root /var/www/html/songmetrix;
    index index.html;

    # SPA Configuration
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Proxy (se necessário)
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Apache
```apache
<VirtualHost *:80>
    ServerName songmetrix.com.br
    DocumentRoot /var/www/html/songmetrix
    
    # SPA Configuration
    <Directory "/var/www/html/songmetrix">
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

## 🧪 Testes Pós-Deploy

### 1. Teste Básico de Funcionamento
```bash
# Verificar se o site carrega
curl -I https://songmetrix.com.br

# Deve retornar 200 OK
```

### 2. Teste de Login
1. Abrir https://songmetrix.com.br/login
2. Fazer login com credenciais válidas
3. Verificar se redireciona para dashboard
4. Navegar entre páginas
5. Aguardar 30 minutos e verificar se mantém sessão

### 3. Teste de Console (DevTools)
1. Abrir F12 > Console
2. Procurar por logs:
   - `Auth state change: SIGNED_IN`
   - `Token próximo do vencimento, fazendo refresh...`
3. **NÃO** deve aparecer:
   - `Sessão expirada por inatividade` (antes de 2 horas)
   - Erros de autenticação constantes

## 🔍 Monitoramento

### Logs Importantes no Console
```javascript
// ✅ Logs esperados (normais)
"Auth state change: SIGNED_IN"
"Auth state change: TOKEN_REFRESHED"
"Token próximo do vencimento, fazendo refresh..."

// ❌ Logs problemáticos
"Sessão expirada por inatividade" (antes de 2h)
"Erro ao atualizar token"
"Usuário não autenticado"
```

### Verificar LocalStorage
```javascript
// No DevTools > Application > Local Storage
// Deve conter chaves como:
"sb-aylxcqaddelwxfukerhr-auth-token"
"songmetrix_last_activity"
```

## 🚨 Troubleshooting

### Problema: Usuários não conseguem fazer login
**Solução**: 
1. Verificar se variáveis de ambiente estão corretas
2. Limpar cache do navegador
3. Verificar conexão com Supabase

### Problema: Logouts inesperados continuam
**Solução**:
1. Verificar console para erros
2. Confirmar se build foi deployado corretamente
3. Verificar se não há cache antigo

### Problema: Página em branco após deploy
**Solução**:
1. Verificar configuração SPA do servidor web
2. Verificar se index.html está no local correto
3. Verificar permissões de arquivo

## 📞 Rollback Rápido

Se houver problemas críticos:

```bash
# 1. Restaurar backup
rm -rf /var/www/html/songmetrix
mv /var/www/html/songmetrix_backup_* /var/www/html/songmetrix

# 2. Reiniciar servidor web
sudo systemctl restart nginx
# ou
sudo systemctl restart apache2

# 3. Limpar cache CDN (se houver)
# Seguir procedimento específico do CDN
```

## ✅ Checklist Final

- [ ] Backup do ambiente atual realizado
- [ ] Arquivos da pasta `dist/` enviados para servidor
- [ ] Configuração do servidor web verificada
- [ ] Teste de login realizado com sucesso
- [ ] Console do navegador verificado (sem erros)
- [ ] Usuários notificados sobre possível necessidade de novo login
- [ ] Monitoramento ativo por 24 horas

## 📈 Resultados Esperados

- **Antes**: Logout após 15 minutos
- **Depois**: Sessão mantida por 2 horas de inatividade
- **Benefício**: Melhor experiência do usuário, menos reclamações

---

**Data de Deploy**: ___________  
**Responsável**: ___________  
**Versão**: v1.0.1 - Correção de Autenticação  
**Status**: [ ] Concluído [ ] Pendente [ ] Rollback