#!/bin/bash

# Teste rápido de conectividade MinIO
# Execute diretamente no terminal: bash <(curl -s URL_DO_SCRIPT) ou copie e cole

echo "🔍 TESTE RÁPIDO MINIO - $(date)"
echo "============================"

# 1. Verificar mc
echo ""
echo "1. Verificando MinIO Client..."
if command -v mc &> /dev/null; then
    echo "✅ mc encontrado"
    mc --version 2>/dev/null | head -1
else
    echo "❌ mc NÃO encontrado"
    echo "💡 Execute: apk add --no-cache wget && wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc && chmod +x /usr/local/bin/mc"
    exit 1
fi

# 2. Testar conectividade
echo ""
echo "2. Testando conectividade..."
echo "   Endpoint: 93.127.141.215:9000"
echo "   Bucket: songmetrix-backups"

# Configurar alias
mc alias set quick-test http://93.127.141.215:9000 admin Conquista@@2 &>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Alias configurado"
else
    echo "❌ Erro no alias"
    exit 1
fi

# Ping
mc ping quick-test &>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Ping OK"
else
    echo "❌ Ping falhou"
    exit 1
fi

# Verificar bucket
echo ""
echo "3. Verificando bucket..."
FILES=$(mc ls quick-test/songmetrix-backups 2>/dev/null | wc -l)
echo "📊 Arquivos no bucket: $FILES"

# Criar arquivo de teste
echo ""
echo "4. Testando upload..."
echo "Teste MinIO - $(date)" > /tmp/minio-test.txt

mc cp /tmp/minio-test.txt quick-test/songmetrix-backups/test/test-$(date +%s).txt &>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Upload OK"
else
    echo "❌ Upload falhou"
fi

# Verificar upload
echo ""
echo "5. Verificando upload..."
TEST_FILES=$(mc ls quick-test/songmetrix-backups/test/ 2>/dev/null | wc -l)
echo "📁 Arquivos de teste: $TEST_FILES"

echo ""
echo "🎯 TESTE CONCLUÍDO"
echo "=================="

if [ "$FILES" -gt 0 ] || [ "$TEST_FILES" -gt 0 ]; then
    echo "✅ MinIO funcionando!"
else
    echo "⚠️ MinIO acessível, mas sem arquivos"
fi