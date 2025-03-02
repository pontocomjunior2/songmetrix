# Implementação do Gerenciador de Streams

Este documento descreve a implementação do gerenciador de streams para o Songmetrix, que permite administrar as fontes de áudio das rádios monitoradas pelo sistema.

## Estrutura da Implementação

A implementação consiste em:

1. **Banco de Dados**: Criação da tabela `streams` no PostgreSQL
2. **Backend**: Endpoints de API para gerenciar os streams
3. **Frontend**: Componente React para administração dos streams

## Arquivos Criados/Modificados

### Scripts de Banco de Dados
- `scripts/create_streams_table.sql`: Script SQL para criar a tabela de streams
- `scripts/import_streams.js`: Script Node.js para importar dados do arquivo JSON
- `scripts/setup-streams.js`: Script para executar a criação da tabela e importação dos dados
- `scripts/setup-streams-direct.js`: Script alternativo que não depende do cliente psql

### Backend
- `server/routes/streams.js`: Endpoints de API para gerenciar streams
- `server/middleware/auth.js`: Middleware de autenticação
- `server/index.js`: Registrador de rotas

### Frontend
- `src/components/Admin/StreamsManager.tsx`: Componente React para gerenciar streams
- `src/services/api.ts`: Serviços de API para comunicação com o backend
- `src/components/Layout/SidebarFixed.tsx`: Adição do link no menu de administração
- `src/components/Layout/SidebarMobile.tsx`: Adição do link no menu de administração móvel
- `src/components/Layout/MainLayout.tsx`: Adição do título para a página de gerenciamento de streams
- `src/App.tsx`: Adição da rota para o gerenciador de streams

## Instruções de Instalação

1. **Criar a tabela no banco de dados e importar os dados**:

   Você pode usar um dos dois scripts disponíveis:

   **Opção 1** (requer cliente psql instalado):
   ```bash
   cd scripts
   node setup-streams.js
   ```

   **Opção 2** (não requer cliente psql, usa o driver pg diretamente):
   ```bash
   cd scripts
   node setup-streams-direct.js
   ```

2. **Iniciar o servidor com as novas rotas**:

   ```bash
   cd server
   npm start
   ```

3. **Iniciar o frontend**:

   ```bash
   npm run dev
   ```

4. Acesse a aplicação e navegue até "Gerenciar Streams" no menu de administração.

## Estrutura da Tabela de Streams

A tabela `streams` possui os seguintes campos:

- `id`: Identificador único (serial)
- `url`: URL do stream de áudio
- `name`: Nome da rádio
- `sheet`: Nome da planilha associada
- `cidade`: Cidade da rádio
- `estado`: Estado da rádio (sigla)
- `regiao`: Região do Brasil
- `segmento`: Segmento da rádio
- `index`: Índice para ordenação
- `created_at`: Data de criação do registro
- `updated_at`: Data da última atualização

## Funcionalidades do Gerenciador de Streams

O gerenciador de streams permite:

1. **Listar todos os streams** com opções de filtragem por região, estado, cidade e segmento
2. **Adicionar novos streams** com todos os dados necessários
3. **Editar streams existentes**
4. **Excluir streams**
5. **Buscar streams** por nome, cidade ou segmento

## Segurança

- Todas as rotas de API são protegidas por autenticação
- As operações de criação, edição e exclusão são restritas a usuários com status de administrador
- As operações de leitura são permitidas para todos os usuários autenticados

## Solução de Problemas

### Erro com PGPASSWORD no Windows

Se você encontrar o erro `'PGPASSWORD' não é reconhecido como um comando interno ou externo...` ao executar o script `setup-streams.js`, use o script alternativo `setup-streams-direct.js` que não depende do cliente psql.

## Próximos Passos

1. Implementar testes automatizados para os endpoints de API
2. Adicionar validação mais robusta nos formulários
3. Implementar paginação na listagem de streams
4. Adicionar funcionalidade de exportação de dados 