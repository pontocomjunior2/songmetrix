import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente com base no modo
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  
  console.log('Modo:', mode);
  console.log('API Base URL:', env.VITE_API_BASE_URL || 'http://localhost:3001');
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/email': {
          target: isProduction ? env.VITE_API_BASE_URL || 'https://songmetrix.com.br' : 'http://localhost:3003',
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('Erro no proxy de email:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log(`Proxy request (email): ${req.method} ${req.url} -> ${proxyReq.path}`);
            });
          }
        },
        '/api': {
          target: isProduction ? env.VITE_API_BASE_URL || 'https://songmetrix.com.br' : 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('Erro no proxy:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log(`Proxy request: ${req.method} ${req.url} -> ${proxyReq.path}`);
            });
          }
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: isProduction ? false : true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts', 'chart.js', 'react-chartjs-2'],
            ui: ['@chakra-ui/react', '@headlessui/react', 'lucide-react']
          },
        },
      },
    },
    optimizeDeps: {
      include: ['@stripe/stripe-js'],
    },
    define: {
      // Não é necessário definir aqui, pois o Vite substitui automaticamente import.meta.env.VITE_*
    },
  };
});
