#!/bin/bash

# Função para verificar erros
check_error() {
    if [ $? -ne 0 ]; then
        echo "Erro: $1"
        exit 1
    fi
}

echo "Iniciando configuração do Git..."

# Verificar se é um repositório Git
if [ ! -d ".git" ]; then
    echo "Este diretório não é um repositório Git."
    
    # Fazer backup do diretório atual se existir conteúdo
    if [ "$(ls -A /var/www/songmetrix)" ]; then
        echo "Fazendo backup do diretório atual..."
        backup_dir="/var/www/songmetrix_backup_$(date +%Y%m%d_%H%M%S)"
        mv /var/www/songmetrix $backup_dir
        mkdir -p /var/www/songmetrix
        cd /var/www/songmetrix || exit
        echo "Backup realizado em: $backup_dir"
    fi
    
    # Solicitar token do GitHub
    echo "Para clonar o repositório, você precisa de um token de acesso pessoal do GitHub."
    echo "Você pode criar um em: https://github.com/settings/tokens"
    echo "Certifique-se de dar permissão 'repo' ao token."
    read -p "Cole seu token de acesso pessoal do GitHub: " GIT_TOKEN
    
    # Configurar Git global
    echo "Configurando Git..."
    git config --global credential.helper store
    
    # Clonar repositório usando token
    echo "Clonando repositório..."
    git clone https://${GIT_TOKEN}@github.com/pontocomjunior2/songmetrix.git .
    check_error "Falha ao clonar repositório"
    
    # Configurar remote
    git remote set-url origin https://${GIT_TOKEN}@github.com/pontocomjunior2/songmetrix.git
    check_error "Falha ao configurar remote"
else
    echo "Repositório Git já existe."
    
    # Solicitar token do GitHub
    echo "Para atualizar o repositório, você precisa de um token de acesso pessoal do GitHub."
    read -p "Cole seu token de acesso pessoal do GitHub: " GIT_TOKEN
    
    # Atualizar URL do remote com o novo token
    git remote set-url origin https://${GIT_TOKEN}@github.com/pontocomjunior2/songmetrix.git
    check_error "Falha ao atualizar remote"
    
    # Atualizar repositório
    echo "Atualizando repositório..."
    git pull origin main
    check_error "Falha ao atualizar repositório"
fi

# Verificar status
echo "Status do repositório:"
git status

echo "Configuração do Git concluída com sucesso!"
echo "Agora você pode usar 'git pull' e 'git push' normalmente."
