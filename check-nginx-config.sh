#!/bin/bash

echo "🔍 Verificando configuração do Nginx..."

# Verificar se o nginx está rodando
echo "📊 Status do Nginx:"
systemctl status nginx --no-pager -l

echo -e "\n📁 Configurações do Nginx:"
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

echo -e "\n🔧 Configuração principal:"
cat /etc/nginx/sites-enabled/default 2>/dev/null || echo "Arquivo não encontrado"

echo -e "\n🌐 Configuração do songmetrix:"
cat /etc/nginx/sites-enabled/songmetrix 2>/dev/null || echo "Arquivo não encontrado"

echo -e "\n📝 Logs do Nginx (últimas 20 linhas):"
tail -20 /var/log/nginx/error.log

echo -e "\n🚀 Verificando se o servidor Node.js está rodando:"
ps aux | grep node | grep -v grep

echo -e "\n🔗 Verificando portas em uso:"
netstat -tlnp | grep :80
netstat -tlnp | grep :443
netstat -tlnp | grep :3001

echo -e "\n✅ Verificação concluída!"
