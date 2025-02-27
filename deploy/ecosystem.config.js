module.exports = {
  apps: [
    {
      name: "songmetrix-api",
      script: "server/server.js",
      env_production: {
        NODE_ENV: "production",
        PORT: 5173,
        POSTGRES_HOST: "localhost",
        VITE_SUPABASE_URL: "https://aylxcqaddelwxfukerhr.supabase.co",
        SUPABASE_SERVICE_KEY: "sua_chave_de_serviço_aqui"
      }
    }
  ]
};
