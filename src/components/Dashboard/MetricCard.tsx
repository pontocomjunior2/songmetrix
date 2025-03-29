import React from 'react';
import './MetricCard.scss';

interface MetricCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  change?: number;
}

/**
 * Componente para exibir um card de métrica no Dashboard
 */
function MetricCard({ 
  title, 
  value, 
  icon, 
  color = 'blue',
  change
}: MetricCardProps) {
  // Formatar número com separador de milhares
  const formattedValue = new Intl.NumberFormat('pt-BR').format(value);
  
  // Definir classes de cores com base na prop color
  const colorClasses = {
    blue: 'metric-card-blue',
    green: 'metric-card-green',
    yellow: 'metric-card-yellow',
    red: 'metric-card-red',
    purple: 'metric-card-purple'
  };
  
  return (
    <div className={`metric-card ${colorClasses[color]}`}>
      <div className="metric-card-content">
        <div className="metric-card-header">
          <h3 className="metric-card-title">{title}</h3>
          {icon && <div className="metric-card-icon">{icon}</div>}
        </div>
        <div className="metric-card-value">{formattedValue}</div>
        
        {change !== undefined && (
          <div className={`metric-card-change ${change >= 0 ? 'positive' : 'negative'}`}>
            <span className="change-value">
              {change >= 0 ? '+' : ''}{change}%
            </span>
            <span className="change-label">vs. período anterior</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard; 