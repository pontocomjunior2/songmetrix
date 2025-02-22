#!/bin/bash

# Navegar para o diretório do projeto
cd /var/www/songmetrix || exit

# Instalar dependências
npm install

# Build do frontend
npm run build

# Iniciar o servidor com PM2
pm2 start ecosystem.config.js --env production

# Exibir status do PM2
pm2 status
