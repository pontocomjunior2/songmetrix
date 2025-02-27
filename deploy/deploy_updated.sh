#!/bin/bash

# Função para verificar erros
check_error() {
    if [ $? -ne 0 ]; then
        echo "Erro: $1"
        exit 1
    fi
}

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "Por favor, execute como root (sudo)"
    exit 1
fi

echo "Iniciando deploy do SONGMETRIX..."

# Backup do banco de dados
echo "Realizando backup do banco de dados..."
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres music_log > "/var/backups/songmetrix_${BACKUP_DATE}.sql"
check_error "Falha ao criar backup do banco de dados"

# Navegar para o diretório do projeto
cd /var/www/songmetrix || exit
check_error "Falha ao acessar diretório do projeto"

# Copiar arquivos de configuração
echo "Copiando arquivos de configuração..."
cp deploy/config/.env.production .env
check_error "Falha ao copiar arquivo .env"

# Instalar dependências
echo "Instalando dependências..."
npm install
check_error "Falha ao instalar dependências"

# Build do frontend
echo "Realizando build do frontend..."
npm run build
check_error "Falha no build do frontend"

# Configurar Nginx
echo "Configurando Nginx..."
cp deploy/nginx/songmetrix.conf /etc/nginx/sites-available/songmetrix
ln -sf /etc/nginx/sites-available/songmetrix /etc/nginx/sites-enabled/
nginx -t
check_error "Configuração do Nginx inválida"

# Reiniciar Nginx
systemctl restart nginx
check_error "Falha ao reiniciar Nginx"

# Configurar e iniciar PM2
echo "Configurando PM2..."
pm2 delete songmetrix-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
check_error "Falha ao iniciar PM2"

# Salvar configuração do PM2
pm2 save
check_error "Falha ao salvar configuração do PM2"

# Configurar PM2 para iniciar com o sistema
pm2 startup
check_error "Falha ao configurar PM2 startup"

# Verificar status
echo "Verificando status dos serviços..."
pm2 status
nginx -v

echo "Deploy concluído com sucesso!"
echo "Acesse: https://songmetrix.com.br"
