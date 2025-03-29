import React from 'react';
import './DateFilter.scss';

interface DateFilterProps {
  periodoInicial: string;
  periodoFinal: string;
  setPeriodoInicial: (value: string) => void;
  setPeriodoFinal: (value: string) => void;
  tipo: string;
  setTipo: (value: string) => void;
}

/**
 * Componente para filtrar dados por período com seleção de datas e tipo de período
 */
function DateFilter({
  periodoInicial,
  periodoFinal,
  setPeriodoInicial,
  setPeriodoFinal,
  tipo,
  setTipo
}: DateFilterProps) {
  return (
    <div className="date-filter">
      <div className="date-filter-tipo">
        <label htmlFor="tipo-periodo">Agrupar por:</label>
        <select 
          id="tipo-periodo" 
          value={tipo} 
          onChange={(e) => setTipo(e.target.value)}
          className="tipo-select"
        >
          <option value="dia">Dia</option>
          <option value="mes">Mês</option>
          <option value="ano">Ano</option>
        </select>
      </div>
      
      <div className="date-filter-period">
        <div className="date-input-group">
          <label htmlFor="periodo-inicial">De:</label>
          <input
            id="periodo-inicial"
            type="date"
            value={periodoInicial}
            onChange={(e) => setPeriodoInicial(e.target.value)}
            className="date-input"
          />
        </div>
        
        <div className="date-input-group">
          <label htmlFor="periodo-final">Até:</label>
          <input
            id="periodo-final"
            type="date"
            value={periodoFinal}
            onChange={(e) => setPeriodoFinal(e.target.value)}
            className="date-input"
          />
        </div>
      </div>
    </div>
  );
}

export default DateFilter; 