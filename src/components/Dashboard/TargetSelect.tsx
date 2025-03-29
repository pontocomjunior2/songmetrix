import React from 'react';
import './TargetSelect.scss';

interface TargetSelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Componente para selecionar o alvo de filtragem dos dados (geral ou rádio específica)
 */
function TargetSelect({ value, onChange }: TargetSelectProps) {
  return (
    <div className="target-select-container">
      <label htmlFor="target-select">Filtrar por:</label>
      <select 
        id="target-select"
        value={value}
        onChange={onChange}
        className="target-select"
      >
        <option value="geral">Todas as rádios</option>
        <option value="jovem-pan">Jovem Pan</option>
        <option value="89-fm">89 FM</option>
        <option value="antena-1">Antena 1</option>
        <option value="mix-radio">Mix Radio</option>
        <option value="alpha-fm">Alpha FM</option>
      </select>
    </div>
  );
}

export default TargetSelect; 