# Documentação do Deploy - SONGMETRIX

## Estrutura de Arquivos
```
deploy/
├── config/
│   └── .env.production    # Variáveis de ambiente para produção
├── nginx/
│   └── songmetrix.conf    # Configuração do Nginx
├── ecosystem.config.js    # Configuração do PM2
├── deploy_updated.sh      # Script de deploy
└── README.md             # Esta documentação
```

## Pré-requisitos
1. Servidor Ubuntu VPS
2. Node.js e NPM instalados
3. PM2 instalado globalmente (`npm install -g pm2`)
4. Nginx instalado
5. PostgreSQL instalado
6. Certificado SSL já configurado para songmetrix.com.br

## Configuração Inicial do Servidor

1. **Criar diretórios necessários**:
   ```bash
   sudo mkdir -p /var/www/songmetrix
   sudo mkdir -p /var/backups
   ```

2. **Configurar permissões**:
   ```bash
   sudo chown -R $USER:$USER /var/www/songmetrix
   sudo chmod -R 755 /var/www/songmetrix
   ```

3. **Instalar dependências globais**:
   ```bash
   sudo apt update
   sudo npm install -g pm2
   ```

## Processo de Deploy

1. **Conectar ao Servidor**
   ```bash
   ssh usuario@songmetrix.com.br
   ```

2. **Clonar/Atualizar Repositório**
   ```bash
   cd /var/www/songmetrix
   git pull origin main
   ```

3. **Executar Script de Deploy**
   ```bash
   sudo bash deploy/deploy_updated.sh
   ```

O script realizará automaticamente:
- Backup do banco de dados
- Instalação de dependências
- Build do frontend
- Configuração do Nginx
- Inicialização do PM2
- Verificação dos serviços

## Verificação Pós-Deploy

1. **Verificar Status do PM2**
   ```bash
   pm2 status
   ```

2. **Verificar Logs do PM2**
   ```bash
   pm2 logs songmetrix-api
   ```

3. **Verificar Status do Nginx**
   ```bash
   sudo systemctl status nginx
   ```

4. **Verificar Logs do Nginx**
   ```bash
   sudo tail -f /var/log/nginx/songmetrix.access.log
   sudo tail -f /var/log/nginx/songmetrix.error.log
   ```

## Estrutura em Produção

- Frontend: `/var/www/songmetrix/dist`
- Backend: `/var/www/songmetrix/server`
- Logs: 
  - PM2: `~/.pm2/logs`
  - Nginx: `/var/log/nginx`
- Backups: `/var/backups`

## Rollback

Em caso de problemas:

1. **Restaurar Backup do Banco**:
   ```bash
   psql -U postgres music_log < /var/backups/songmetrix_[DATA].sql
   ```

2. **Reverter PM2**:
   ```bash
   pm2 stop songmetrix-api
   pm2 delete songmetrix-api
   pm2 start ecosystem.config.js --env production
   ```

## Monitoramento

- **Dashboard PM2**:
  ```bash
  pm2 monit
  ```

- **Logs em Tempo Real**:
  ```bash
  pm2 logs songmetrix-api
  ```

## Suporte

Em caso de problemas:
1. Verificar logs do PM2 e Nginx
2. Verificar conexão com o banco de dados
3. Verificar configurações do Supabase
4. Verificar permissões dos arquivos

## Segurança

- Todas as senhas e chaves sensíveis estão em arquivos .env
- O servidor usa HTTPS
- Configurações de segurança do Nginx incluídas
- Backups automáticos do banco de dados
