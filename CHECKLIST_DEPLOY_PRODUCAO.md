# ✅ Checklist para Deploy em Produção

## 🔍 Status Atual
- ✅ **Problema identificado**: Token expirando em 15 minutos
- ✅ **Solução implementada**: Sessão de 2 horas + refresh automático
- ✅ **Build gerado**: Pasta `dist/` pronta para deploy
- ✅ **Testes executados**: Configurações validadas

## 📋 Pré-Deploy

### 1. Backup do Ambiente Atual
- [ ] Fazer backup dos arquivos atuais em produção
- [ ] Documentar versão atual para rollback se necessário
- [ ] Verificar se há usuários ativos no sistema

### 2. Validação Final
- [x] Build de produção gerado sem erros
- [x] Configurações de autenticação implementadas
- [x] Arquivos de configuração atualizados
- [ ] Testar em ambiente de staging (se disponível)

## 🚀 Deploy

### 3. Processo de Deploy
- [ ] Fazer upload dos arquivos da pasta `dist/` para o servidor
- [ ] Verificar se todas as variáveis de ambiente estão corretas
- [ ] Confirmar que o servidor web está configurado corretamente
- [ ] Testar se o site carrega após o deploy

### 4. Configurações do Servidor
- [ ] Verificar configuração do nginx/apache para SPA
- [ ] Confirmar redirecionamentos para `index.html`
- [ ] Verificar headers de cache para assets
- [ ] Confirmar HTTPS está funcionando

## 🧪 Pós-Deploy

### 5. Testes Imediatos
- [ ] **Teste de Login**: Fazer login com usuário de teste
- [ ] **Teste de Navegação**: Navegar entre páginas sem logout
- [ ] **Teste de Refresh**: F5 na página deve manter sessão
- [ ] **Teste de Inatividade**: Deixar inativo por 30 minutos e verificar

### 6. Monitoramento
- [ ] Abrir DevTools e monitorar console por erros
- [ ] Verificar logs de "Auth state change" no console
- [ ] Procurar por logs de "Token próximo do vencimento, fazendo refresh..."
- [ ] Monitorar se há logouts inesperados

### 7. Validação com Usuários
- [ ] Notificar usuários sobre possível necessidade de novo login
- [ ] Pedir feedback sobre estabilidade da sessão
- [ ] Monitorar suporte para reclamações de logout

## 🔧 Configurações Implementadas

### Tempos de Sessão
- **Inatividade**: 2 horas (antes: 15 minutos)
- **Verificação**: A cada 5 minutos
- **Refresh de token**: 15 minutos antes do vencimento
- **Throttle de atividade**: 30 segundos

### Melhorias Técnicas
- ✅ Uso do storage padrão do Supabase (localStorage)
- ✅ Sistema de refresh automático nativo
- ✅ Verificações otimizadas e menos frequentes
- ✅ Tratamento robusto de erros
- ✅ Configurações centralizadas

## 🚨 Plano de Rollback

### Se houver problemas:
1. **Restaurar backup** dos arquivos anteriores
2. **Limpar cache** do navegador dos usuários
3. **Notificar usuários** sobre instabilidade temporária
4. **Investigar logs** para identificar causa raiz

### Sinais de que rollback é necessário:
- Logouts em massa de usuários
- Erros de autenticação no console
- Impossibilidade de fazer login
- Perda de dados de sessão

## 📞 Contatos de Emergência
- **Desenvolvedor**: [Seu contato]
- **Administrador do servidor**: [Contato do admin]
- **Suporte técnico**: [Contato do suporte]

## 📊 Métricas para Monitorar

### Primeiras 24 horas:
- Número de logins vs logouts
- Tempo médio de sessão
- Reclamações de usuários
- Erros no console do navegador

### Primeira semana:
- Estabilidade geral da autenticação
- Feedback dos usuários sobre experiência
- Performance da aplicação
- Logs de refresh de token

---

## ⚡ Comandos Úteis

### Para limpar cache do navegador (orientar usuários):
```
Chrome: Ctrl+Shift+Delete
Firefox: Ctrl+Shift+Delete
Safari: Cmd+Option+E
```

### Para verificar logs no DevTools:
```
1. F12 para abrir DevTools
2. Aba Console
3. Procurar por mensagens com "Auth" ou "Token"
```

### Para forçar novo login (se necessário):
```
1. Abrir DevTools (F12)
2. Application > Storage > Clear storage
3. Recarregar página (F5)
```

---

**Data do Deploy**: ___________  
**Responsável**: ___________  
**Status**: [ ] Sucesso [ ] Rollback [ ] Investigação  
**Observações**: ___________