import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, FileDown } from 'lucide-react';
import moment from 'moment';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import './Ranking/styles/Ranking.css';

interface ReportData {
  title: string;
  artist: string;
  executions: {
    [radioKey: string]: number;
  };
  total: number;
}

const chartSizeOptions = [
  { value: '50', label: 'SongMetrix Chart 50' },
  { value: '100', label: 'SongMetrix Chart 100' },
  { value: '200', label: 'SongMetrix Chart 200' }
];

const getRadioAbbreviation = (radioName: string): string => {
  const words = radioName.split(' ');
  if (words.length === 1) {
    return radioName.substring(0, 3).toUpperCase();
  }
  return words.slice(0, 3).map(word => word.charAt(0)).join('').toUpperCase();
};

const Relatorios: React.FC = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRadios, setSelectedRadios] = useState<Array<{ value: string; label: string }>>([]);
  const [radiosOptions, setRadiosOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [startDate, setStartDate] = useState(moment().subtract(7, 'days').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [chartSize, setChartSize] = useState(chartSizeOptions[0]); // Default to Chart 50

  const getAuthHeaders = async () => {
    const token = await currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  useEffect(() => {
    const fetchRadios = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/radios/status', { headers });
        if (!response.ok) throw new Error('Failed to fetch radios');
        const data = await response.json();
        const options = data.map((radio: { name: string }) => ({
          value: radio.name,
          label: radio.name,
        }));
        setRadiosOptions(options);
      } catch (error) {
        console.error('Error fetching radios:', error);
      }
    };

    if (currentUser) {
      fetchRadios();
    }
  }, [currentUser]);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Relatório de Execuções', 14, 20);
    
    // Add chart size and date range
    doc.setFontSize(12);
    doc.text(`${chartSize.label}`, 14, 30);
    doc.text(`Período: ${moment(startDate).format('DD/MM/YYYY')} - ${moment(endDate).format('DD/MM/YYYY')}`, 14, 40);

    // Prepare table headers
    const selectedAbbreviations = selectedRadios.map(radio => getRadioAbbreviation(radio.label));
    const headers = ['POS', 'TÍTULO', 'ARTISTA', ...selectedAbbreviations, 'TOTAL'];

    // Prepare table data with positions
    let currentPosition = 1;
    let previousTotal = -1;
    const tableData = reportData.map((item, index) => {
      if (item.total !== previousTotal) {
        currentPosition = index + 1;
      }
      previousTotal = item.total;
      
      return [
        `${currentPosition}º`,
        item.title,
        item.artist,
        ...selectedRadios.map(radio => item.executions[radio.value] || 0),
        item.total
      ];
    });

    // Generate table
    (doc as any).autoTable({
      head: [headers],
      body: tableData.slice(0, parseInt(chartSize.value)), // Limit rows according to chart size
      startY: 50,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 15 }, // POS
        1: { cellWidth: 40 }, // TÍTULO
        2: { cellWidth: 40 }, // ARTISTA
      },
    });

    // Add legend
    const legendY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text('Legenda:', 14, legendY);
    
    // Add radio abbreviations legend
    selectedRadios.forEach((radio, index) => {
      const abbrev = getRadioAbbreviation(radio.label);
      doc.text(`${abbrev} (${radio.label})`, 14, legendY + 10 + (index * 6));
    });

    // Save the PDF
    doc.save(`relatorio-${moment().format('YYYY-MM-DD')}.pdf`);
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRadios.length === 0) {
      alert('Selecione pelo menos uma rádio');
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        startDate,
        endDate,
        radios: selectedRadios.map(r => r.value).join(','),
        limit: chartSize.value
      });

      const response = await fetch(`/api/report?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch report data');
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Erro ao gerar relatório. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate positions for the table display
  const getPosition = (index: number, item: ReportData): number => {
    if (index === 0) return 1;
    const previousItem = reportData[index - 1];
    return item.total === previousItem.total ? 
      getPosition(index - 1, previousItem) : 
      index + 1;
  };

  return (
    <div className="ranking-container">
      <div className="ranking-filters">
        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="radio-select">Rádios:</label>
            <Select
              id="radio-select"
              options={radiosOptions}
              isMulti
              value={selectedRadios}
              onChange={(newValue) => setSelectedRadios(newValue as { value: string; label: string }[])}
              placeholder="Selecione as rádios"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        </div>

        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="chart-size">Chart:</label>
            <Select
              id="chart-size"
              options={chartSizeOptions}
              value={chartSize}
              onChange={(newValue) => setChartSize(newValue as { value: string; label: string })}
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        </div>

        <div className="ranking-filter-row-datetime">
          <div className="ranking-filter-group">
            <label htmlFor="date-start">Data Início:</label>
            <input
              type="date"
              id="date-start"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="ranking-filter-group">
            <label htmlFor="date-end">Data Fim:</label>
            <input
              type="date"
              id="date-end"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="ranking-filter-buttons">
          <button 
            className="ranking-btn-primary" 
            onClick={handleGenerateReport}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              'Gerar Relatório'
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-indicator">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p>Gerando relatório...</p>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="ranking-table-container mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{chartSize.label}</h2>
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FileDown className="w-4 h-4" />
              Baixar PDF
            </button>
          </div>
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Título</th>
                <th>Artista</th>
                {selectedRadios.map((radio) => (
                  <th key={radio.value}>{getRadioAbbreviation(radio.label)}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportData.slice(0, parseInt(chartSize.value)).map((item, index) => (
                <tr key={index}>
                  <td>{getPosition(index, item)}º</td>
                  <td>{item.title}</td>
                  <td>{item.artist}</td>
                  {selectedRadios.map((radio) => (
                    <td key={radio.value}>{item.executions[radio.value] || 0}</td>
                  ))}
                  <td>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Relatorios;
