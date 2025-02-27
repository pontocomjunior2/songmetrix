#!/bin/bash

# Função para verificar erros
check_error() {
    if [ $? -ne 0 ]; then
        echo "Erro: $1"
        exit 1
    fi
}

echo "Iniciando configuração do repositório Songmetrix..."

# Verificar se o token foi fornecido
if [ -z "$1" ]; then
    echo "Por favor, forneça o token do GitHub como parâmetro."
    echo "Uso: ./setup_repo.sh SEU_TOKEN"
    exit 1
fi

GIT_TOKEN=$1

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
