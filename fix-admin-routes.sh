#!/bin/bash

echo "🔧 Diagnóstico e Correção das Rotas de Admin"
echo "=============================================="

# 1. Verificar se o servidor Node.js está rodando
echo "1. Verificando se o servidor Node.js está rodando..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Servidor Node.js está rodando"
    ps aux | grep "node.*server.js" | grep -v grep
else
    echo "❌ Servidor Node.js NÃO está rodando"
    echo "🚀 Iniciando servidor..."
    cd /path/to/songmetrix
    nohup node server/server.js > server.log 2>&1 &
    sleep 5
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "✅ Servidor iniciado com sucesso"
    else
        echo "❌ Falha ao iniciar servidor"
        exit 1
    fi
fi

# 2. Verificar configuração do Nginx
echo -e "\n2. Verificando configuração do Nginx..."
if [ -f /etc/nginx/sites-enabled/songmetrix ]; then
    echo "✅ Configuração do songmetrix encontrada"
    echo "📄 Conteúdo da configuração:"
    cat /etc/nginx/sites-enabled/songmetrix
else
    echo "❌ Configuração do songmetrix não encontrada"
    echo "🔧 Criando configuração..."
    
    cat > /etc/nginx/sites-available/songmetrix << 'EOF'
server {
    listen 80;
    server_name songmetrix.com.br www.songmetrix.com.br;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name songmetrix.com.br www.songmetrix.com.br;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/songmetrix.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/songmetrix.com.br/privkey.pem;
    
    # Frontend (React app)
    location / {
        root /path/to/songmetrix/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API routes - proxy para o servidor Node.js
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Uploads
    location /uploads/ {
        alias /path/to/songmetrix/public/uploads/;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/songmetrix /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo "✅ Configuração do Nginx criada e aplicada"
fi

# 3. Verificar se as rotas estão registradas corretamente
echo -e "\n3. Verificando registro das rotas..."
if grep -q "registerRoutes" /path/to/songmetrix/server/server.js; then
    echo "✅ registerRoutes está sendo chamado"
else
    echo "❌ registerRoutes não está sendo chamado"
fi

# 4. Testar as rotas
echo -e "\n4. Testando rotas..."
curl -s -o /dev/null -w "%{http_code}" https://songmetrix.com.br/api/diagnostico
echo " - /api/diagnostico"

curl -s -o /dev/null -w "%{http_code}" https://songmetrix.com.br/api/admin/users
echo " - /api/admin/users"

curl -s -o /dev/null -w "%{http_code}" https://songmetrix.com.br/api/admin/insights/drafts
echo " - /api/admin/insights/drafts"

# 5. Verificar logs
echo -e "\n5. Verificando logs do servidor..."
if [ -f server.log ]; then
    echo "📝 Últimas 20 linhas do log do servidor:"
    tail -20 server.log
else
    echo "📝 Log do servidor não encontrado"
fi

echo -e "\n✅ Diagnóstico concluído!"
echo "🎯 Se as rotas ainda não funcionam, verifique:"
echo "   - Se o servidor está rodando na porta 3001"
echo "   - Se o Nginx está configurado corretamente"
echo "   - Se as rotas estão registradas no server/index.js"
