# Ler o arquivo server.js
$serverFile = Join-Path $PSScriptRoot "server.js"
$content = Get-Content -Path $serverFile -Raw

# Criar backup
$backupFile = Join-Path $PSScriptRoot "server.js.bak_$(Get-Date -Format 'yyyyMMddHHmmss')"
$content | Out-File -FilePath $backupFile -Encoding utf8

# Substituir a segunda ocorrência do endpoint
$pattern = "app\.post\('\/api\/brevo\/sync-users', verifyToken, async \(req, res\) => {[\s\S]*?res\.end\(\);\s*}\s*}\);"
$replacement = "// Endpoint removido para evitar duplicação"

$newContent = $content -replace $pattern, $replacement

# Verificar se houve mudança
if ($newContent -eq $content) {
    Write-Host "AVISO: Não foi possível encontrar o código para substituir." -ForegroundColor Yellow
    exit 1
}

# Salvar o arquivo corrigido
$newContent | Out-File -FilePath $serverFile -Encoding utf8

Write-Host "Backup criado em: $backupFile" -ForegroundColor Green
Write-Host "Arquivo server.js corrigido com sucesso!" -ForegroundColor Green
Write-Host "Concluído! Reinicie o servidor para aplicar as alterações." -ForegroundColor Cyan 