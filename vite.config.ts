import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente com base no modo
  const env = loadEnv(mode, process.cwd());
  console.log('[vite.config.ts] Loaded env:', env);
  const isProduction = mode === 'production';
  
  console.log('Modo:', mode);
  console.log('API Base URL:', env.VITE_API_BASE_URL || 'http://localhost:3001');
  
  return {
    plugins: [
      react(),
      // Bundle analyzer - only in production or when ANALYZE=true
      ...(process.env.ANALYZE === 'true' || (isProduction && process.env.SKIP_ANALYZE !== 'true') ? [
        visualizer({
          filename: 'dist/bundle-analysis.html',
          open: process.env.ANALYZE === 'true',
          gzipSize: true,
          brotliSize: true,
        })
      ] : [])
    ],
    server: {
      port: 5173,
      proxy: {
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
      // Optimize build performance
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
      rollupOptions: {
        output: {
          // Disable manual chunks to use Vite's default safe configuration
          // This prevents dependency issues between chunks
          // manualChunks: (id) => { ... },
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
            return `js/[name]-[hash].js`;
          },
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `images/[name]-[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
        },
        // Optimize external dependencies
        external: (id) => {
          // Don't bundle these in development for faster builds
          if (!isProduction && id.includes('node_modules')) {
            return false;
          }
          return false;
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: [
        '@stripe/stripe-js',
        '@tanstack/react-query',
        'react-router-dom',
        'web-vitals',
      ],
      // Force optimization of these packages
      force: isProduction,
    },
    define: {
      // Não é necessário definir aqui, pois o Vite substitui automaticamente import.meta.env.VITE_*
    },
  };
});
