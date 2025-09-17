#!/bin/bash

# Script de debug para MinIO
# Execute dentro do container: ./scripts/minio-debug.sh

echo "🔍 DEBUG MINIO - $(date)"
echo "===================="

echo ""
echo "1. Verificando instalação do mc..."
which mc
if [ $? -eq 0 ]; then
    echo "✅ mc encontrado"
    mc --version
else
    echo "❌ mc NÃO encontrado"
    exit 1
fi

echo ""
echo "2. Verificando arquivos no container..."
ls -la /app/scripts/
ls -la /app/ | grep -E "(backup|script)"

echo ""
echo "3. Testando conectividade MinIO..."
echo "   Endpoint: 93.127.141.215:9000"
echo "   Access Key: admin"
echo "   Secret Key: Conquista@@2"
echo "   Bucket: songmetrix-backups"

# Configurar alias
echo ""
echo "4. Configurando alias MinIO..."
mc alias set debug-alias http://93.127.141.215:9000 admin Conquista@@2

if [ $? -eq 0 ]; then
    echo "✅ Alias configurado"
else
    echo "❌ Erro ao configurar alias"
    exit 1
fi

# Testar ping
echo ""
echo "5. Testando ping MinIO..."
mc ping debug-alias

if [ $? -eq 0 ]; then
    echo "✅ Ping OK"
else
    echo "❌ Ping falhou"
    exit 1
fi

# Verificar bucket
echo ""
echo "6. Verificando bucket..."
mc ls debug-alias/songmetrix-backups/

if [ $? -eq 0 ]; then
    echo "✅ Bucket acessível"
else
    echo "❌ Erro ao acessar bucket"
fi

# Criar arquivo de teste
echo ""
echo "7. Criando arquivo de teste..."
echo "Teste MinIO - $(date)" > /tmp/test-minio.txt

# Tentar upload
echo ""
echo "8. Testando upload..."
mc cp /tmp/test-minio.txt debug-alias/songmetrix-backups/test/test-file.txt

if [ $? -eq 0 ]; then
    echo "✅ Upload OK"
else
    echo "❌ Upload falhou"
fi

# Verificar upload
echo ""
echo "9. Verificando upload..."
mc ls debug-alias/songmetrix-backups/test/

echo ""
echo "🎯 DEBUG CONCLUÍDO"
echo "===================="