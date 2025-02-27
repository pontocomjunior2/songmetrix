# Documentação do Processo de Deploy para o SONGMETRIX

## Pré-requisitos
- Acesso ao servidor VPS com Ubuntu.
- Nginx já configurado.
- Certificado SSL instalado.

## Passos para o Deploy

1. **Conectar ao Servidor**
   ```bash
   ssh usuario@seu_servidor
   ```

2. **Navegar até o Diretório do Projeto**
   ```bash
   cd /var/www/songmetrix
   ```

3. **Configurar Variáveis de Ambiente**
   - Certifique-se de que o arquivo `.env.production` está configurado corretamente em `deploy/config/`.

4. **Executar o Script de Deploy**
   ```bash
   bash deploy/deploy.sh
   ```

5. **Verificar o Status do Servidor**
   - Após o deploy, verifique se o servidor está rodando corretamente:
   ```bash
   pm2 status
   ```

6. **Acessar a Aplicação**
   - Acesse a aplicação através do URL: `https://songmetrix.com.br`.

## Observações
- O ambiente de desenvolvimento local não deve ser alterado durante o processo de deploy.
- Para qualquer erro, verifique os logs do PM2:
```bash
pm2 logs
