import React from 'react';
import { PlayCircle, StopCircle } from 'lucide-react'; // Importar ícones necessários
import { Button } from '../ui/button'; // Usar componente Button para consistência

interface AudioPlayerProps {
  streamUrl?: string;       // URL do stream é opcional
  isPlaying: boolean;        // Indica se esta rádio está tocando
  onPlayToggle: (url: string | null) => void; // Função para iniciar/parar
}

export function AudioPlayer({ streamUrl, isPlaying, onPlayToggle }: AudioPlayerProps) {
  // console.log('AudioPlayer Props:', { streamUrl, isPlaying }); // Log props - Mantido para debug se necessário

  // Não renderiza botão se a URL não for fornecida
  if (!streamUrl) {
    return (
        <Button variant="ghost" size="icon" disabled className="text-muted-foreground">
            <PlayCircle className="h-5 w-5" />
        </Button>
    );
  }

  const handleToggle = () => {
    // Se está tocando, chama onPlayToggle(null) para parar
    // Se não está tocando, chama onPlayToggle(streamUrl) para começar
    onPlayToggle(isPlaying ? null : streamUrl);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={isPlaying ? "text-red-500 hover:text-red-600" : "text-blue-500 hover:text-blue-600"} // Muda cor se está tocando
      aria-label={isPlaying ? "Parar rádio" : "Ouvir rádio"}
    >
      {isPlaying ? (
        <StopCircle className="h-5 w-5" />
      ) : (
        <PlayCircle className="h-5 w-5" />
      )}
    </Button>
  );
} 