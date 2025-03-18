import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './components/ui/styles.css';

// Carrega o tema salvo ou o tema do sistema
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Remover o StrictMode para evitar renderizações duplas que podem afetar a autenticação
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
