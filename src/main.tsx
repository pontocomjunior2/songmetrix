import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './components/ui/styles.css';
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// --- INÍCIO: Lógica de Inicialização do Meta Pixel ---

// Declaração global para window.fbq (pode estar em um arquivo .d.ts global também)
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const metaPixelId = import.meta.env.VITE_META_PIXEL_ID;

if (metaPixelId) {
  if (typeof window.fbq === 'function') {

    try {
      window.fbq('init', metaPixelId);
      window.fbq('track', 'PageView'); // Rastreia a primeira visualização de página


      // Tentar atualizar a tag <noscript>
      const noscriptImg = document.querySelector('noscript img[src*="facebook.com/tr?id="]');
      if (noscriptImg) {
        const currentSrc = noscriptImg.getAttribute('src');
        // Substituir placeholder ou ID antigo pelo novo ID
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
                 console.error('Erro ao inicializar Meta Pixel');
    }
  } else {

  }
} else {

}

// --- FIM: Lógica de Inicialização do Meta Pixel ---

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
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  // </React.StrictMode>
);
