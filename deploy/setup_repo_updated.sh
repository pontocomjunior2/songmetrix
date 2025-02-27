#!/bin/bash

# Função para verificar erros
check_error() {
    if [ $? -ne 0 ]; then
        echo "Erro: $1"
        exit 1
    fi
}

echo "Iniciando configuração do repositório Songmetrix..."

# Verificar se os parâmetros foram fornecidos
if [ "$#" -ne 3 ]; then
    echo "Por favor, forneça todos os parâmetros necessários."
    echo "Uso: ./setup_repo_updated.sh SEU_TOKEN \"Seu Nome\" seu.email@exemplo.com"
    exit 1
fi

GIT_TOKEN=$1
GIT_NAME=$2
GIT_EMAIL=$3

# Configurar Git global
echo "Configurando Git global..."
git config --global init.defaultBranch main
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
check_error "Falha ao configurar Git global"

# Inicializar Git se necessário
if [ ! -d ".git" ]; then
    echo "Inicializando repositório Git..."
    git init
    check_error "Falha ao inicializar Git"
fi

# Configurar remote
echo "Configurando remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GIT_TOKEN}@github.com/pontocomjunior2/songmetrix.git"
check_error "Falha ao configurar remote"

# Verificar conexão
echo "Verificando conexão com GitHub..."
git ls-remote origin >/dev/null 2>&1
check_error "Falha na conexão com GitHub. Verifique seu token."

# Adicionar arquivos
echo "Adicionando arquivos..."
git add .
git commit -m "Configuração inicial do deploy"
check_error "Falha ao criar commit"

# Push para GitHub
echo "Enviando arquivos para GitHub..."
git push -u origin main
check_error "Falha ao enviar arquivos"

echo "Configuração do repositório concluída com sucesso!"
echo "Repositório disponível em: https://github.com/pontocomjunior2/songmetrix"
