#!/bin/bash

# Função para verificar erros
check_error() {
    if [ $? -ne 0 ]; then
        echo "Erro: $1"
        exit 1
    fi
}

echo "Iniciando atualização do repositório Git..."

# Verificar se é um repositório Git
if [ ! -d ".git" ]; then
    echo "Este diretório não é um repositório Git."
    echo "Inicializando repositório Git..."
    git init
    check_error "Falha ao inicializar repositório Git"

    echo "Por favor, configure o repositório remoto:"
    read -p "URL do Git (ex: https://github.com/seu_usuario/songmetrix.git): " GIT_URL
    
    git remote add origin $GIT_URL
    check_error "Falha ao adicionar repositório remoto"
fi

# Verificar status do Git
echo "Status atual do Git:"
git status

# Confirmar com o usuário
read -p "Deseja continuar com o commit e push das alterações? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ]; then
    echo "Operação cancelada pelo usuário."
    exit 0
fi

# Adicionar todas as alterações
echo "Adicionando alterações..."
git add .
check_error "Falha ao adicionar alterações"

# Solicitar mensagem de commit
read -p "Digite a mensagem de commit: " COMMIT_MSG
git commit -m "$COMMIT_MSG"
check_error "Falha ao fazer commit"

# Push para o GitHub
echo "Enviando alterações para o GitHub..."
git push origin main
check_error "Falha ao fazer push"

echo "Atualização do Git concluída com sucesso!"
