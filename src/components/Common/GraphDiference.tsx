import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import './GraphDiference.scss';

interface GraphData {
  name: string;
  valor: number;
}

interface GraphDifferenceProps {
  data: GraphData[];
  tipo: string;
}

/**
 * Formata os dados para o gráfico a partir dos dados brutos da API
 * @param data Dados brutos da API
 * @param tipo Tipo de período (dia, mes, ano)
 * @returns Dados formatados para o gráfico
 */
export const getGraph = (
  data: Array<{ data: string; total: number }>, 
  tipo: string
): GraphData[] => {
  if (!data || data.length === 0) return [];
  
  return data.map(item => {
    let formattedName = item.data;
    
    // Formatar data para exibição de acordo com o tipo
    if (tipo === 'dia') {
      // Formato esperado: 2023-01-15
      const parts = item.data.split('-');
      if (parts.length === 3) {
        formattedName = `${parts[2]}/${parts[1]}`;
      }
    } else if (tipo === 'mes') {
      // Formato esperado: 2023-01
      const parts = item.data.split('-');
      if (parts.length === 2) {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthIndex = parseInt(parts[1]) - 1;
        formattedName = months[monthIndex] + '/' + parts[0].substring(2);
      }
    }
    // Para ano, mantém o formato original (ex: 2023)
    
    return {
      name: formattedName,
      valor: item.total
    };
  });
};

/**
 * Componente para exibir gráficos de evolução com comparação de períodos
 */
export function GraphDiference({ data, tipo }: GraphDifferenceProps) {
  if (!data || data.length === 0) {
    return (
      <div className="graph-empty">
        <p>Nenhum dado disponível para o período selecionado</p>
      </div>
    );
  }
  
  // Customização do tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{`${label}`}</p>
          <p className="value">{`${payload[0].value} execuções`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="graph-container">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end" 
            height={70} 
            tick={{ fontSize: 12 }} 
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GraphDiference; 