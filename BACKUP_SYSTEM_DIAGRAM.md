# 📊 Diagrama de Arquitetura - Sistema de Backup

## Fluxograma Geral do Sistema

```mermaid
graph TB
    %% Databases
    subgraph "Fontes de Dados"
        PG[(PostgreSQL<br/>Produção<br/>104.234.173.96:5433)]
        SB[(Supabase<br/>Nuvem<br/>aylxcqaddelwxfukerhr.supabase.co)]
    end

    %% Backup Scripts
    subgraph "Scripts de Backup"
        BP[Backup<br/>PostgreSQL]
        BS[Backup<br/>Supabase]
        OR[Orquestrador<br/>Principal]
    end

    %% Storage
    subgraph "Armazenamento"
        MINIO[(MinIO<br/>console.files.songmetrix.com.br<br/>songmetrix-backups)]
    end

    %% Automation
    subgraph "Automação"
        CRON[Cron Jobs<br/>Diário/Semanal/Mensal]
        CLEAN[Limpeza<br/>Automática]
        MONITOR[Monitoramento<br/>& Alertas]
    end

    %% Connections
    PG --> BP
    SB --> BS
    BP --> OR
    BS --> OR
    OR --> MINIO
    CRON --> OR
    OR --> CLEAN
    OR --> MONITOR

    %% Styling
    classDef database fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef script fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef storage fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef automation fill:#fff3e0,stroke:#e65100,stroke-width:2px

    class PG,SB database
    class BP,BS,OR script
    class MINIO storage
    class CRON,CLEAN,MONITOR automation
```

## Fluxo de Backup Detalhado

```mermaid
sequenceDiagram
    participant Cron
    participant Orchestrator
    participant PostgreSQL
    participant Supabase
    participant MinIO
    participant Monitor

    Cron->>Orchestrator: Iniciar backup (02:00 AM)
    Orchestrator->>PostgreSQL: Conectar e executar pg_dump
    PostgreSQL-->>Orchestrator: Arquivo .sql.gz
    Orchestrator->>Supabase: Conectar e executar pg_dump
    Supabase-->>Orchestrator: Arquivo .sql.gz
    Orchestrator->>Orchestrator: Comprimir arquivos
    Orchestrator->>MinIO: Upload para bucket
    MinIO-->>Orchestrator: Confirmação de upload
    Orchestrator->>Monitor: Status de sucesso
    Monitor->>Monitor: Verificar integridade
    Monitor->>Orchestrator: OK / Alerta se erro
```

## Estrutura de Diretórios no MinIO

```mermaid
graph TD
    ROOT[songmetrix-backups] --> DAILY[daily/]
    ROOT --> WEEKLY[weekly/]
    ROOT --> MONTHLY[monthly/]
    ROOT --> MANUAL[manual/]

    DAILY --> D20250101[2025/01/01/]
    D20250101 --> PG_DAILY[postgresql_music_log_20250101_020000.sql.gz]
    D20250101 --> SB_DAILY[supabase_backup_20250101_020000.sql.gz]

    WEEKLY --> W202501[2025/01/]
    W202501 --> PG_WEEKLY[postgresql_music_log_weekly_20250105.sql.gz]

    MONTHLY --> M202501[2025/01/]
    M202501 --> PG_MONTHLY[postgresql_music_log_monthly_20250101.sql.gz]

    MANUAL --> M20250101[emergency_20250101/]
    M20250101 --> PG_MANUAL[postgresql_full_backup_manual.sql.gz]
```

## Estratégia de Retenção

```mermaid
gantt
    title Estratégia de Retenção de Backups
    dateFormat YYYY-MM-DD
    section Diário
    Backup Diário 1     :done, d1, 2025-01-01, 7d
    Backup Diário 2     :done, d2, after d1, 7d
    Backup Diário 3     :done, d3, after d2, 7d
    Backup Diário 4     :done, d4, after d3, 7d
    Backup Diário 5     :done, d5, after d4, 7d
    Backup Diário 6     :done, d6, after d5, 7d
    Backup Diário 7     :done, d7, after d6, 7d
    Remoção Automática  :crit, d8, after d7, 1d

    section Semanal
    Backup Semanal 1    :done, w1, 2025-01-05, 28d
    Backup Semanal 2    :done, w2, after w1, 28d
    Backup Semanal 3    :done, w3, after w2, 28d
    Backup Semanal 4    :done, w4, after w3, 28d
    Remoção Semanal     :crit, w5, after w4, 1d

    section Mensal
    Backup Mensal 1     :done, m1, 2025-01-01, 365d
    Backup Mensal 2     :done, m2, after m1, 365d
    Backup Mensal 3     :done, m3, after m2, 365d
    Backup Mensal 4     :done, m4, after m3, 365d
    Backup Mensal 5     :done, m5, after m4, 365d
    Backup Mensal 6     :done, m6, after m5, 365d
    Backup Mensal 7     :done, m7, after m6, 365d
    Backup Mensal 8     :done, m8, after m7, 365d
    Backup Mensal 9     :done, m9, after m8, 365d
    Backup Mensal 10    :done, m10, after m9, 365d
    Backup Mensal 11    :done, m11, after m10, 365d
    Backup Mensal 12    :done, m12, after m11, 365d
```

## Monitoramento e Alertas

```mermaid
stateDiagram-v2
    [*] --> Backup_Iniciado
    Backup_Iniciado --> Backup_Executando: Conexão OK
    Backup_Iniciado --> Alerta_Falha: Conexão falha

    Backup_Executando --> Backup_Concluido: Sucesso
    Backup_Executando --> Backup_Com_Erro: Erro durante execução

    Backup_Concluido --> Upload_MinIO: Arquivo gerado
    Backup_Concluido --> Alerta_Falha: Arquivo não gerado

    Upload_MinIO --> Upload_Sucesso: Upload OK
    Upload_MinIO --> Upload_Falha: Erro no upload

    Upload_Sucesso --> Verificacao_Integridade: Arquivo no MinIO
    Upload_Sucesso --> Alerta_Falha: Arquivo não encontrado

    Verificacao_Integridade --> Backup_Finalizado: Integridade OK
    Verificacao_Integridade --> Alerta_Falha: Integridade comprometida

    Backup_Com_Erro --> Retry_Backup: Tentativa <= 3
    Backup_Com_Erro --> Alerta_Falha: Tentativas esgotadas

    Upload_Falha --> Retry_Upload: Tentativa <= 3
    Upload_Falha --> Alerta_Falha: Tentativas esgotadas

    Retry_Backup --> Backup_Executando
    Retry_Upload --> Upload_MinIO

    Backup_Finalizado --> [*]
    Alerta_Falha --> [*]

    Alerta_Falha --> Email_Alerta: Enviar notificação
    Email_Alerta --> [*]
```

## Dashboard de Status

```mermaid
graph LR
    subgraph "Dashboard de Backup"
        STATUS[Status Geral<br/>✅ OK / ❌ Falha]
        LAST[Último Backup<br/>2025-01-01 02:00]
        SIZE[Tamanho Total<br/>2.3 GB]
        RETENTION[Retenção<br/>7d / 4w / 12m]
    end

    subgraph "Métricas de Performance"
        TIME[Tempo Médio<br/>15 min]
        SUCCESS[Taxa Sucesso<br/>99.8%]
        GROWTH[Crescimento<br/>+5% / mês]
        COST[Custo Storage<br/>$12.50 / mês]
    end

    subgraph "Alertas Ativos"
        ALERT1[Backup PostgreSQL<br/>Atrasado]
        ALERT2[Espaço MinIO<br/>85% usado]
        ALERT3[Upload falhou<br/>3x hoje]
    end

    STATUS --> TIME
    LAST --> SUCCESS
    SIZE --> GROWTH
    RETENTION --> COST

    ALERT1 --> STATUS
    ALERT2 --> SIZE
    ALERT3 --> SUCCESS
```

## Plano de Implementação

```mermaid
journey
    title Jornada de Implementação do Sistema de Backup

    section Planejamento
        Análise de Requisitos: 5: Planejamento, Desenvolvimento
        Design da Arquitetura: 5: Planejamento, Desenvolvimento
        Definição de Estratégias: 4: Planejamento, Desenvolvimento

    section Desenvolvimento
        Scripts PostgreSQL: 5: Desenvolvimento
        Scripts Supabase: 4: Desenvolvimento
        Cliente MinIO: 5: Desenvolvimento
        Sistema de Monitoramento: 4: Desenvolvimento

    section Testes
        Testes Unitários: 5: Testes, Qualidade
        Testes de Integração: 5: Testes, Qualidade
        Testes de Carga: 4: Testes, Qualidade
        Validação de Restauração: 5: Testes, Qualidade

    section Produção
        Deploy em Staging: 4: Produção, Operações
        Configuração Cron: 3: Produção, Operações
        Monitoramento Ativo: 5: Produção, Operações
        Documentação Final: 4: Produção, Operações
```

---

## 📋 Legenda dos Diagramas

### Cores e Formas
- 🔵 **Retângulos azuis**: Componentes principais (databases, storage)
- 🟣 **Retângulos roxos**: Scripts e processos
- 🟢 **Retângulos verdes**: Armazenamento e backup
- 🟠 **Retângulos laranja**: Automação e monitoramento

### Status dos Backups
- ✅ **Verde**: Backup bem-sucedido
- ❌ **Vermelho**: Falha no backup
- 🟡 **Amarelo**: Backup em andamento
- ⚪ **Cinza**: Backup não executado

### Tipos de Conexão
- **→**: Fluxo principal de dados
- **-->>**: Resposta ou retorno
- **-->**: Conexão de monitoramento
- **-.-**: Conexão opcional ou alternativa

Esta arquitetura garante **backup completo, automatizado e seguro** de todos os dados críticos do Songmetrix, com **recuperação rápida** em caso de desastres e **monitoramento proativo** de todas as operações.