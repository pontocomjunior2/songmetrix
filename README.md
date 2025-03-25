# SONGMETRIX

> **A plataforma definitiva para análise de performance musical entre rádio e streaming**

![SONGMETRIX Logo](https://via.placeholder.com/800x200?text=SONGMETRIX)

## Sumário
- [Visão Geral](#visão-geral)
- [Principais Funcionalidades](#principais-funcionalidades)
- [Diferenciais Técnicos](#diferenciais-técnicos)
- [Benefícios](#benefícios)
- [Painel Demonstrativo](#painel-demonstrativo)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Instruções de Uso](#instruções-de-uso)
- [Roadmap](#roadmap)
- [Contato](#contato)
- [Gerenciamento de Metadados de Usuário](#gerenciamento-de-metadados-de-usuário)
- [Scripts de Utilitário para Metadados](#scripts-de-utilitário-para-metadados)

## Visão Geral

**SONGMETRIX** é uma plataforma inovadora projetada para analisar, comparar e visualizar dados de consumo musical através de diferentes canais de distribuição - rádios tradicionais e plataformas de streaming digital. Criada para suprir a necessidade crítica de compreender como o consumo de música se comporta nos ambientes online e offline, a SONGMETRIX oferece insights valiosos para gravadoras, artistas, produtores musicais e profissionais de marketing da indústria fonográfica.

A plataforma integra dados detalhados de execuções em rádios com métricas de performance no Spotify, permitindo análises comparativas inéditas que revelam tendências, oportunidades de mercado e comportamentos de consumo musical.

## Principais Funcionalidades

### Módulo de Ranking e Performance de Rádio

- **Análise de Execuções**: Monitoramento em tempo real das músicas mais tocadas nas principais rádios do Brasil
- **Filtros Avançados**: Segmentação por gênero musical, região, período temporal e estação de rádio
- **Detecção de Tendências**: Identificação de músicas em ascensão nas programações radiofônicas
- **Comparativo Histórico**: Análise da evolução temporal das execuções de artistas e músicas
- **Visualização Geográfica**: Mapeamento da popularidade de músicas por região geográfica

### Integração com Spotify

- **Sincronização com Plataformas Digitais**: Dados atualizados do Spotify integrados aos relatórios
- **Análise de Playlists**: Exploração das principais playlists por categoria e popularidade
- **Visualização de Dados de Streaming**: Métricas detalhadas de popularidade e reproduções
- **Descoberta de Conteúdo**: Navegação por categorias, artistas e lançamentos
- **Previews de Áudio**: Amostras de faixas integradas diretamente na plataforma

### Dashboard Analítico Comparativo

- **Análise Cruzada**: Comparação direta entre desempenho nas rádios e no Spotify
- **Identificação de Gaps**: Detecção de oportunidades onde há discrepância entre rádio e streaming
- **Tendências Emergentes**: Identificação precoce de músicas com potencial de crescimento
- **Recomendações Estratégicas**: Sugestões automatizadas para promoção e distribuição musical
- **Exportação de Relatórios**: Geração de relatórios personalizados em diversos formatos

## Diferenciais Técnicos

### Arquitetura Moderna e Escalável

- **Frontend React Otimizado**: Interface responsiva com renderização eficiente de grandes volumes de dados
- **Throttling Inteligente**: Mecanismo avançado para lidar com limitações de API preservando a experiência do usuário
- **Gerenciamento Eficiente de Token**: Sistema robusto de autenticação e renovação automática de credenciais
- **Tratamento de Erros Avançado**: Failover automático e sistemas de fallback para garantir continuidade do serviço
- **Arquitetura Modular**: Componentes isolados que permitem extensibilidade e manutenção simplificada

### Processamento de Dados Avançado

- **Algoritmos Preditivos**: Tecnologia proprietária para prever tendências musicais antes da concorrência
- **Normalização Sofisticada**: Harmonização de dados provenientes de diferentes fontes para análises precisas
- **Cache Estratégico**: Sistema inteligente de cache que otimiza a performance sem comprometer a atualidade dos dados
- **Tratamento Semântico**: Reconhecimento avançado de artistas e faixas através de correspondência semântica
- **Análise Multi-dimensional**: Capacidade de cruzar múltiplas variáveis para insights mais profundos

## Benefícios

### Para Gravadoras e Selos
- **Tomada de Decisão Baseada em Dados**: Informações estratégicas para direcionar investimentos e promoções
- **Planejamento de Lançamentos Otimizado**: Identificação dos melhores momentos e canais para novos lançamentos
- **ROI Amplificado**: Maximização do retorno sobre investimento em marketing musical
- **Descoberta de Talentos**: Identificação precoce de artistas com potencial comprovado em diferentes plataformas

### Para Artistas e Produtores
- **Entendimento de Audiência**: Insights detalhados sobre onde e como sua música está performando
- **Estratégia de Distribuição**: Dados para informar em quais canais focar esforços promocionais
- **Validação de Mercado**: Métricas comparativas para demonstrar sucesso a potenciais parceiros
- **Oportunidades de Crescimento**: Identificação de nichos e regiões para expansão de base de fãs

### Para Programadores de Rádio
- **Curadoria Baseada em Dados**: Informações objetivas para seleção de conteúdo musical
- **Alinhamento com Tendências**: Visualização clara do que está em alta nas plataformas digitais
- **Diferenciação Estratégica**: Identificação de conteúdo exclusivo que se destaca na rádio versus streaming
- **Planejamento Editorial**: Dados para informar programações temáticas e especiais

## Painel Demonstrativo

Nossa plataforma oferece visualizações intuitivas e altamente informativas:

- **Dashboard Principal**: Visão consolidada com KPIs e métricas essenciais
- **Análise Comparativa**: Gráficos lado a lado de performance em rádio vs. streaming
- **Mapas de Calor**: Visualização geográfica da popularidade musical
- **Gráficos de Tendência**: Evolução temporal de execuções e streams
- **Tabelas Interativas**: Dados detalhados com opções avançadas de filtro e ordenação

## Tecnologias Utilizadas

SONGMETRIX é construído com as mais modernas tecnologias:

- **Frontend**: React, TypeScript, Vite
- **UI/UX**: Componentes customizados, LazyLoading, rendering otimizado
- **APIs**: Integração com API do Spotify e APIs proprietárias de monitoramento de rádio
- **Visualização de Dados**: Gráficos interativos e responsivos
- **Autenticação**: Sistema seguro OAuth 2.0
- **Performance**: Otimizações avançadas para carregamento e processamento de dados

## Instruções de Uso

### Requisitos
- Node.js 14+
- Conta de desenvolvedor Spotify (para funcionalidades de streaming)
- Credenciais de API fornecidas pela equipe SONGMETRIX

### Instalação Rápida
```bash
# Clone o repositório
git clone https://github.com/seuusuario/songmetrix.git

# Instale as dependências
cd songmetrix
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais

# Inicie a aplicação
npm run dev
```

## Roadmap

Estamos constantemente evoluindo! Próximas funcionalidades incluem:

- **Integração com Outras Plataformas**: Apple Music, Deezer, YouTube Music
- **Machine Learning Avançado**: Previsão de hits com precisão aprimorada
- **Análise de Sentimento**: Avaliação da percepção de público via redes sociais
- **API Pública**: Endpoints para integração com sistemas de terceiros
- **Módulo para Eventos**: Correlação entre execuções e agenda de shows/eventos

## Contato

Para mais informações, demonstrações ou parcerias, entre em contato:

- **Email**: contato@songmetrix.com
- **Website**: [www.songmetrix.com](https://www.songmetrix.com)
- **LinkedIn**: [linkedin.com/company/songmetrix](https://linkedin.com/company/songmetrix)

## Gerenciamento de Metadados de Usuário

O SONGMETRIX sincroniza automaticamente os metadados de autenticação do Supabase com o perfil de usuário. Isso é feito através de um trigger no banco de dados que captura os campos `full_name` e `whatsapp` durante o registro ou atualização do usuário.

### Scripts de Utilitário para Metadados

Os seguintes comandos estão disponíveis para gerenciar a sincronização de metadados:

- `npm run check-user-metadata` - Verifica os metadados existentes na tabela auth.users
- `npm run migrate-user-metadata` - Migra metadados de usuários existentes para a tabela public.users
- `npm run fix-user-profiles` - Corrige campos vazios em perfis de usuário existentes
- `npm run apply-profile-trigger` - Aplica o trigger de sincronização de metadados no banco de dados
- `npm run test-metadata-sync` - Testa a sincronização de metadados criando um usuário de teste

Para mais detalhes sobre a implementação da sincronização de metadados, consulte a documentação em [docs/user_metadata_sync_solution.md](docs/user_metadata_sync_solution.md).

## Adição da coluna de último acesso (last_sign_in_at)

Para adicionar a coluna de último acesso à tabela de usuários, execute o seguinte:

1. Acesse o console do Supabase para seu projeto
2. Vá até a seção "SQL Editor"
3. Crie um novo query
4. Cole o conteúdo do arquivo `supabase/migrations/update_users_add_last_sign_in.sql`
5. Execute o script

Ou, se preferir, execute via CLI do Supabase:

```bash
supabase db push
```

### Atualização de dados de último acesso para usuários existentes

Após adicionar a coluna, você pode preencher os dados de último acesso para usuários existentes com o seguinte procedimento:

1. Acesse o console do Supabase para seu projeto
2. Vá até a seção "SQL Editor"
3. Crie um novo query
4. Cole o conteúdo do arquivo `supabase/migrations/update_users_last_sign_in_data.sql`
5. Execute o script

Alternativamente, você pode usar o botão "Atualizar Último Acesso" disponível na interface de administração de usuários, que executa essa atualização automaticamente sem necessidade de acesso ao console do Supabase.

Para habilitar este botão, você precisa:

1. Criar a função `update_users_last_sign_in` no banco de dados executando o script `supabase/migrations/create_update_last_sign_in_function.sql`
2. Garantir que o API endpoint `/api/users/update-last-sign-in` esteja configurado corretamente

Este script preencherá o campo `last_sign_in_at` para todos os usuários existentes com base no valor do campo `updated_at` como uma estimativa do último acesso.

Essa alteração permite rastrear o último acesso de cada usuário e exibir essa informação na tela de administração.

---

<p align="center">
  <em>SONGMETRIX - Conectando os pontos entre rádio e streaming para revolucionar a indústria musical</em>
</p>