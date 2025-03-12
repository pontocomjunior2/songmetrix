import React, { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Tipos para o componente
interface PopularityIndicatorProps {
  type: 'spotify' | 'youtube';
  popularity: number; // De 0 a 100
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
  showSparkline?: boolean;
  size?: 'sm' | 'md' | 'lg';
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
  showSparkline = true,
  size = 'md'
}) => {
  const sparklineRef = useRef<HTMLCanvasElement>(null);
  const colors = serviceColors[type];
  
  // Normalizar popularidade para evitar valores inválidos
  const normalizedPopularity = Math.max(0, Math.min(100, Math.round(popularity)));
  
  // Ajustar tamanho com base na propriedade size
  const getSize = () => {
    switch (size) {
      case 'sm': return { height: 4, width: '80%', iconSize: 14 };
      case 'lg': return { height: 8, width: '100%', iconSize: 20 };
      default: return { height: 6, width: '90%', iconSize: 16 };
    }
  };
  
  const { height, width, iconSize } = getSize();
  
  // Desenhar sparkline no canvas quando o componente montar
  useEffect(() => {
    if (sparklineRef.current && showSparkline) {
      const ctx = sparklineRef.current.getContext('2d');
      if (ctx) {
        // Limpar canvas
        ctx.clearRect(0, 0, sparklineRef.current.width, sparklineRef.current.height);
        
        // Configurar estilo
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1.5;
        
        // Dados simulados para o sparkline (substituir por dados reais quando disponíveis)
        // Simula uma curva baseada na popularidade atual e tendência
        const points = [];
        const steps = 10;
        
        for (let i = 0; i < steps; i++) {
          let value = normalizedPopularity;
          
          // Simular tendência
          if (trend === 'up') {
            value = normalizedPopularity - (normalizedPopularity * 0.4) * (1 - i / steps);
          } else if (trend === 'down') {
            value = normalizedPopularity - (normalizedPopularity * 0.4) * (i / steps);
          } else {
            // Pequenas variações para 'stable'
            const variation = Math.sin(i / steps * Math.PI) * 10;
            value = Math.max(0, Math.min(100, normalizedPopularity + variation));
          }
          
          points.push({
            x: (i / (steps - 1)) * sparklineRef.current.width,
            y: sparklineRef.current.height - (value / 100) * sparklineRef.current.height
          });
        }
        
        // Desenhar caminho
        ctx.beginPath();
        points.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        
        // Área sob a curva
        ctx.lineTo(points[points.length - 1].x, sparklineRef.current.height);
        ctx.lineTo(points[0].x, sparklineRef.current.height);
        ctx.closePath();
        
        ctx.fillStyle = `${colors.primary}20`; // 20% de opacidade
        ctx.fill();
      }
    }
  }, [normalizedPopularity, trend, showSparkline]);
  
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
  
  // Função para gerar o gradiente de cores baseado na popularidade
  const getGradientStyle = () => {
    const lowColor = '#E5E7EB';  // cinza claro
    const highColor = colors.primary;
    
    if (normalizedPopularity <= 0) {
      return { backgroundColor: lowColor };
    } else if (normalizedPopularity >= 100) {
      return { backgroundColor: highColor };
    }
    
    return {
      background: `linear-gradient(to right, ${highColor} 0%, ${highColor} ${normalizedPopularity}%, ${lowColor} ${normalizedPopularity}%)`
    };
  };
  
  return (
    <div className="flex flex-col space-y-2">
      {/* Pontuação no formato X/100 */}
      <div className="text-center font-medium text-lg">
        {normalizedPopularity}/100
      </div>
      
      {/* Seta de tendência e percentual */}
      <div className="flex justify-center items-center">
        <span 
          className={`flex items-center text-sm ${
            trend === 'up' 
              ? 'text-emerald-500'
              : trend === 'down'
                ? 'text-rose-500'
                : 'text-gray-500'
          }`}
        >
          {renderTrendIcon()}
          {trendPercentage !== undefined && (
            <span className="ml-1">
              {trendPercentage > 0 ? '+' : ''}{trendPercentage}%
            </span>
          )}
        </span>
      </div>
      
      {/* Mini gráfico sparkline (opcional, oculto por padrão para seguir o design da imagem) */}
      {showSparkline && (
        <div className="w-full h-10 mt-1">
          <canvas
            ref={sparklineRef}
            width={120}
            height={30}
            className="w-full h-full"
          ></canvas>
        </div>
      )}
    </div>
  );
};

export default PopularityIndicator; 