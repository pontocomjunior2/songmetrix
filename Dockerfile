# Multi-stage build para aplicação full-stack SongMetrix

# Stage 1: Build do frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Copiar arquivos de configuração do frontend
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.* ./
COPY postcss.config.js ./

# Instalar dependências
RUN npm ci

# Copiar código fonte do frontend
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build do frontend
RUN npm run build

# Stage 2: Runtime com backend
FROM node:18-alpine AS runtime

WORKDIR /app

# Instalar dependências do sistema necessárias
RUN apk add --no-cache \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar código do backend
COPY server/ ./server/
COPY lib/ ./lib/
COPY sql/ ./sql/
COPY scripts/ ./scripts/

# Copiar arquivos estáticos do frontend build
COPY --from=frontend-build /app/dist ./dist

# Copiar arquivos de configuração necessários
COPY .env.example .env.production

# Criar diretório para uploads
RUN mkdir -p server/public/uploads/logos

# Expor porta do backend
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Comando para iniciar a aplicação
CMD ["node", "server/server.js"]