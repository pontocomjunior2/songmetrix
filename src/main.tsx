import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './components/ui/styles.css';
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupWebVitalsReporting } from './lib/performance';

// --- INÍCIO: Lógica de Inicialização do Meta Pixel com Detecção de Bloqueio ---

// Declaração global para window.fbq (pode estar em um arquivo .d.ts global também)
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    metaPixelBlocked?: boolean;
  }
}

const metaPixelId = import.meta.env.VITE_META_PIXEL_ID;

// Função para detectar se o Facebook Pixel está sendo bloqueado
const detectMetaPixelBlock = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Criar um elemento script para testar o carregamento
    const testScript = document.createElement('script');
    testScript.src = 'https://connect.facebook.net/en_US/fbevents.js';
    testScript.async = true;

    // Timeout para detectar bloqueio
    const timeout = setTimeout(() => {
      console.warn('Meta Pixel detectado como bloqueado - removendo script');
      window.metaPixelBlocked = true;
      resolve(true);
    }, 3000);

    // Evento de carregamento bem-sucedido
    testScript.onload = () => {
      clearTimeout(timeout);
      console.log('Meta Pixel carregado com sucesso');
      window.metaPixelBlocked = false;
      resolve(false);
    };

    // Evento de erro
    testScript.onerror = () => {
      clearTimeout(timeout);
      console.warn('Meta Pixel bloqueado por extensão ou política de segurança');
      window.metaPixelBlocked = true;
      resolve(true);
    };

    // Adicionar ao DOM para teste
    document.head.appendChild(testScript);

    // Remover o script de teste após o teste
    setTimeout(() => {
      if (testScript.parentNode) {
        testScript.parentNode.removeChild(testScript);
      }
    }, 3100);
  });
};

// Função para desabilitar Meta Pixel se estiver bloqueado
const disableMetaPixel = () => {
  console.log('Desabilitando Meta Pixel devido a bloqueio detectado');

  // Remover script do Facebook Pixel se existir
  const pixelScript = document.querySelector('script[src*="connect.facebook.net"]');
  if (pixelScript) {
    pixelScript.remove();
  }

  // Remover noscript fallback
  const noscriptTag = document.querySelector('noscript');
  if (noscriptTag && noscriptTag.innerHTML.includes('facebook.com')) {
    noscriptTag.remove();
  }

  // Limpar função fbq
  if (window.fbq) {
    window.fbq = () => {}; // Função vazia para evitar erros
  }

  // Marcar como bloqueado
  window.metaPixelBlocked = true;
};

// Inicializar Meta Pixel com detecção de bloqueio
const initializeMetaPixel = async () => {
  if (!metaPixelId) {
    console.log('Meta Pixel ID não configurado - pulando inicialização');
    return;
  }

  try {
    // Verificar se o script do Facebook Pixel já foi carregado
    const existingScript = document.querySelector('script[src*="connect.facebook.net"]');

    if (!existingScript) {
      console.warn('Script do Meta Pixel não encontrado no DOM');
      return;
    }

    // Aguardar um pouco para ver se o script carrega
    setTimeout(async () => {
      const isBlocked = await detectMetaPixelBlock();

      if (isBlocked) {
        disableMetaPixel();
        return;
      }

      // Se não está bloqueado, tentar inicializar normalmente
      if (typeof window.fbq === 'function') {
        try {
          window.fbq('init', metaPixelId);
          window.fbq('track', 'PageView');
          console.log('Meta Pixel inicializado com sucesso');

          // Tentar atualizar a tag <noscript>
          const noscriptImg = document.querySelector('noscript img[src*="facebook.com/tr?id="]');
          if (noscriptImg) {
            const currentSrc = noscriptImg.getAttribute('src');
            if (currentSrc && (currentSrc.includes('YOUR_PIXEL_ID') || !currentSrc.includes(`id=${metaPixelId}`))) {
              const newSrc = currentSrc.replace(/id=([^&]+)/, `id=${metaPixelId}`);
              noscriptImg.setAttribute('src', newSrc);
            } else if (!currentSrc) {
              console.warn('Atributo src da tag noscript do Meta Pixel está vazio.');
            }
          } else {
            console.warn('Tag noscript do Meta Pixel não encontrada no DOM para atualização.');
          }

        } catch (initError) {
          console.error('Erro ao inicializar Meta Pixel:', initError);
          disableMetaPixel();
        }
      } else {
        console.warn('Função fbq não está disponível');
        disableMetaPixel();
      }
    }, 1000);

  } catch (error) {
    console.error('Erro na inicialização do Meta Pixel:', error);
    disableMetaPixel();
  }
};

// Iniciar inicialização do Meta Pixel
initializeMetaPixel();

// --- FIM: Lógica de Inicialização do Meta Pixel ---

// Setup performance monitoring
setupWebVitalsReporting();

// Carrega o tema salvo ou o tema do sistema
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Renderizar sem React.StrictMode para teste
ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
        {/* React Query DevTools - only in development */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  // </React.StrictMode>
);
