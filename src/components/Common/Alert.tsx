import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

const alertStyles = {
  success: {
    container: 'bg-green-50 border-green-400',
    text: 'text-green-700',
    icon: '✓',
  },
  error: {
    container: 'bg-red-50 border-red-400',
    text: 'text-red-700',
    icon: '✕',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-400',
    text: 'text-yellow-700',
    icon: '⚠',
  },
  info: {
    container: 'bg-blue-50 border-blue-400',
    text: 'text-blue-700',
    icon: 'ℹ',
  },
};

export default function Alert({ type, message, onClose }: AlertProps) {
  const styles = alertStyles[type];

  return (
    <div
      className={`${styles.container} border px-4 py-3 rounded relative animate-fadeIn`}
      role="alert"
    >
      <div className="flex items-center">
        <span className="mr-2">{styles.icon}</span>
        <span className={`block sm:inline ${styles.text}`}>{message}</span>
      </div>
      {onClose && (
        <button
          className={`absolute top-0 bottom-0 right-0 px-4 py-3 ${styles.text} hover:opacity-75`}
          onClick={onClose}
        >
          <span className="sr-only">Fechar</span>
          <span className="text-xl">&times;</span>
        </button>
      )}
    </div>
  );
}

export function SuccessAlert({ message, onClose }: Omit<AlertProps, 'type'>) {
  return <Alert type="success" message={message} onClose={onClose} />;
}

export function ErrorAlert({ message, onClose }: Omit<AlertProps, 'type'>) {
  return <Alert type="error" message={message} onClose={onClose} />;
}

export function WarningAlert({ message, onClose }: Omit<AlertProps, 'type'>) {
  return <Alert type="warning" message={message} onClose={onClose} />;
}

export function InfoAlert({ message, onClose }: Omit<AlertProps, 'type'>) {
  return <Alert type="info" message={message} onClose={onClose} />;
}
