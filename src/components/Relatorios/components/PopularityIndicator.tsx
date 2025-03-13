import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Tipos para o componente
interface PopularityIndicatorProps {
  type: 'spotify' | 'youtube';
  popularity: number; // De 0 a 100
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
  showSparkline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact'; // Adicionado novo prop para variante compacta
}

// Cores para cada serviço
const serviceColors = {
  spotify: {
    primary: '#1DB954',
    secondary: '#1aa34a',
    background: '#EAFAF1',
    text: '#108c3d',
    dark: {
      background: '#143d26',
      text: '#1DB954'
    }
  },
  youtube: {
    primary: '#FF0000',
    secondary: '#cc0000',
    background: '#FFF5F5',
    text: '#cc0000',
    dark: {
      background: '#3d1414',
      text: '#FF0000'
    }
  }
};

const PopularityIndicator: React.FC<PopularityIndicatorProps> = ({
  type,
  popularity,
  trend = 'stable',
  trendPercentage,
  showSparkline = false, // Por padrão não mostra mais o sparkline
  size = 'md',
  variant = 'default'
}) => {
  const colors = serviceColors[type];
  
  // Normalizar popularidade para evitar valores inválidos
  const normalizedPopularity = Math.max(0, Math.min(100, Math.round(popularity)));
  
  // Ajustar tamanho com base na propriedade size
  const getSize = () => {
    switch (size) {
      case 'sm': return { iconSize: 12 };
      case 'lg': return { iconSize: 18 };
      default: return { iconSize: 14 };
    }
  };
  
  const { iconSize } = getSize();
  
  // Renderizar o ícone de tendência
  const renderTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={iconSize} className={`text-emerald-500`} />;
      case 'down':
        return <TrendingDown size={iconSize} className={`text-rose-500`} />;
      default:
        return <Minus size={iconSize} className={`text-gray-500`} />;
    }
  };

  // Variante compacta para uso em espaços menores
  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-1 justify-center">
        <span className="font-medium text-xs">{normalizedPopularity}</span>
        <span className={`flex items-center ${
          trend === 'up' 
            ? 'text-emerald-500'
            : trend === 'down'
              ? 'text-rose-500'
              : 'text-gray-500'
        }`}>
          {renderTrendIcon()}
        </span>
      </div>
    );
  }
  
  // Variante padrão
  return (
    <div className="flex items-center space-x-2 justify-between w-full">
      {/* Pontuação no formato X/100 */}
      <div className="font-medium text-sm whitespace-nowrap">
        {normalizedPopularity}/100
      </div>
      
      {/* Seta de tendência */}
      <div className="flex items-center">
        <span className={`flex items-center ${
          trend === 'up' 
            ? 'text-emerald-500'
            : trend === 'down'
              ? 'text-rose-500'
              : 'text-gray-500'
        }`}>
          {renderTrendIcon()}
        </span>
      </div>
    </div>
  );
};

export default PopularityIndicator; 