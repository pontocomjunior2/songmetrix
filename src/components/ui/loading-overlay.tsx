import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingOverlay({ isOpen, label, fullscreen = false }: LoadingOverlayProps) {
  if (!isOpen) return null;

  const positionClass = fullscreen ? 'fixed inset-0' : 'absolute inset-0';

  return (
    <div
      className={`${positionClass} z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center cursor-wait`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-md border border-border bg-background/90 px-4 py-2 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">
          {label ?? 'Carregando...'}
        </span>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  isOpen: boolean;
  label?: string;
  fullscreen?: boolean;
}

