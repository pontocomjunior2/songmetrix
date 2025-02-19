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

interface RadioAbbreviation {
  radio_name: string;
  abbreviation: string;
}

const Relatorios: React.FC = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [selectedRadios, setSelectedRadios] = useState<Array<{ value: string; label: string }>>([]);
  const [radiosOptions, setRadiosOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [radioAbbreviations, setRadioAbbreviations] = useState<{ [key: string]: string }>({});
  const [reportGenerated, setReportGenerated] = useState(false);
  
  const getRadioAbbreviation = (radioName: string): string => {
    return radioAbbreviations[radioName] || radioName.substring(0, 3).toUpperCase();
  };

  const [startDate, setStartDate] = useState(moment().subtract(7, 'days').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [chartSize, setChartSize] = useState(chartSizeOptions[0]);
  const [selectedCity, setSelectedCity] = useState<{ value: string; label: string } | null>(null);
  const [selectedState, setSelectedState] = useState<{ value: string; label: string } | null>(null);
  const [citiesOptions, setCitiesOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [statesOptions, setStatesOptions] = useState<Array<{ value: string; label: string }>>([]);

  const clearReportData = () => {
    if (reportGenerated) {
      setReportData([]);
      setReportGenerated(false);
    }
  };

  const getAuthHeaders = async () => {
    try {
      const token = await currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('No authentication token available');
      }
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error: any) {
      console.error('Error getting auth headers:', error);
      if (error?.code === 'auth/requires-recent-login') {
        alert('Sua sessão expirou. Por favor, faça login novamente.');
      } else {
        alert('Erro de autenticação. Por favor, tente novamente.');
      }
      throw error;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        console.log('No user logged in, skipping data fetch');
        return;
      }
      try {
        const headers = await getAuthHeaders();
        const radiosResponse = await fetch('http://localhost:3001/api/radios/status', { 
          headers,
          credentials: 'include',
          mode: 'cors'
        });
        if (!radiosResponse.ok) throw new Error('Failed to fetch radios');
        const radiosData = await radiosResponse.json();
        const options = radiosData.map((radio: { name: string }) => ({
          value: radio.name,
          label: radio.name,
        }));
        setRadiosOptions(options);
        const abbreviationsResponse = await fetch('http://localhost:3001/api/radio-abbreviations', { 
          headers,
          credentials: 'include'
        });
        if (!abbreviationsResponse.ok) throw new Error('Failed to fetch abbreviations');
        const abbreviationsData: RadioAbbreviation[] = await abbreviationsResponse.json();
        const abbrevMap = abbreviationsData.reduce((acc, { radio_name, abbreviation }) => {
          acc[radio_name] = abbreviation;
          return acc;
        }, {} as { [key: string]: string });
        setRadioAbbreviations(abbrevMap);
      } catch (error: any) {
        console.error('Error fetching data:', error);
        if (error?.code === 'auth/requires-recent-login') {
          alert('Sua sessão expirou. Por favor, faça login novamente.');
        } else {
          alert('Erro ao carregar dados. Por favor, tente novamente.');
        }
      }
    };

    const fetchLocationData = async () => {
      try {
        const headers = await getAuthHeaders();
        const citiesResponse = await fetch('http://localhost:3001/api/cities', { 
          headers,
          credentials: 'include'
        });
        if (!citiesResponse.ok) throw new Error('Failed to fetch cities');
        const citiesData = await citiesResponse.json();
        const cityOptions = citiesData.map((city: string) => ({
          value: city,
          label: city,
        }));
        setCitiesOptions(cityOptions);
        const statesResponse = await fetch('http://localhost:3001/api/states', { 
          headers,
          credentials: 'include'
        });
        if (!statesResponse.ok) throw new Error('Failed to fetch states');
        const statesData = await statesResponse.json();
        const stateOptions = statesData.map((state: string) => ({
          value: state,
          label: state,
        }));
        setStatesOptions(stateOptions);
      } catch (error: any) {
        console.error('Error fetching location data:', error);
        if (error?.code === 'auth/requires-recent-login') {
          alert('Sua sessão expirou. Por favor, faça login novamente.');
        } else {
          alert('Erro ao carregar dados de localização. Por favor, tente novamente.');
        }
      }
    };

    if (currentUser) {
      fetchData();
      fetchLocationData();
    }
  }, [currentUser]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório de Execuções', 14, 20);
    doc.setFontSize(12);
    doc.text(`${chartSize.label}`, 14, 30);
    doc.text(`Período: ${moment(startDate).format('DD/MM/YYYY')} - ${moment(endDate).format('DD/MM/YYYY')}`, 14, 40);
    const selectedAbbreviations = selectedRadios.map(radio => getRadioAbbreviation(radio.label));
    const headers = ['POS', 'TÍTULO', 'ARTISTA', ...selectedAbbreviations, 'TOTAL'];
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
        ...selectedRadios.map(radio =>
          item.executions[radio.value] !== undefined ? item.executions[radio.value] : 0
        ),
        item.total
      ];
    });
    (doc as any).autoTable({
      head: [headers],
      body: tableData.slice(0, parseInt(chartSize.value)),
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
        0: { cellWidth: 15 },
        1: { cellWidth: 40 },
        2: { cellWidth: 40 },
      },
    });
    const legendY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text('Legenda:', 14, legendY);
    selectedRadios.forEach((radio, index) => {
      const abbrev = getRadioAbbreviation(radio.label);
      doc.text(`${abbrev} (${radio.label})`, 14, legendY + 10 + (index * 6));
    });
    doc.save(`relatorio-${moment().format('YYYY-MM-DD')}.pdf`);
  };

  const validateLocation = async (city: string, state: string) => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ city, state });
      const response = await fetch(`http://localhost:3001/api/validate-location?${params.toString()}`, { 
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to validate location');
      const data = await response.json();
      return data.isValid;
    } catch (error: any) {
      console.error('Error validating location:', error);
      if (error?.code === 'auth/requires-recent-login') {
        alert('Sua sessão expirou. Por favor, faça login novamente.');
      }
      return false;
    }
  };

  const fetchRadiosByLocation = async (city?: string, state?: string) => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (city) params.append('city', city);
      if (state) params.append('state', state);
      const response = await fetch(`http://localhost:3001/api/radios/by-location?${params.toString()}`, { 
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch radios by location');
      const data = await response.json();
      return data.map((radio: string) => ({ value: radio, label: radio }));
    } catch (error: any) {
      console.error('Error fetching radios by location:', error);
      if (error?.code === 'auth/requires-recent-login') {
        alert('Sua sessão expirou. Por favor, faça login novamente.');
      }
      return [];
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasLocationFilter = selectedCity || selectedState;
    if (!hasLocationFilter && selectedRadios.length === 0) {
      alert('Selecione rádios ou um filtro de localização (cidade/estado)');
      return;
    }
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      let radiosToUse = selectedRadios;
      if (hasLocationFilter) {
        await new Promise(resolve => setTimeout(resolve, 7000));
        const locationRadios = await fetchRadiosByLocation(
          selectedCity?.value,
          selectedState?.value
        );
        if (selectedRadios.length === 0) {
          radiosToUse = locationRadios;
          setSelectedRadios(locationRadios);
        } else {
          const validRadios = selectedRadios.filter(radio => 
            locationRadios.some((locRadio: { value: string; label: string }) => 
              locRadio.value === radio.value
            )
          );
          radiosToUse = validRadios;
          setSelectedRadios(validRadios);
        }
        if (radiosToUse.length === 0) {
          setLoading(false);
          alert('Nenhuma rádio encontrada para a localização selecionada');
          return;
        }
      }
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: chartSize.value
      });
      if (radiosToUse.length > 0) {
        params.append('radios', radiosToUse.map(r => r.value).join('||'));
      }
      if (selectedCity) {
        params.append('city', selectedCity.value);
      }
      if (selectedState) {
        params.append('state', selectedState.value);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      const response = await fetch(`http://localhost:3001/api/report?${params.toString()}`, { 
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch report data');
      const data = await response.json();
      setReportData(data);
      setReportGenerated(true);
    } catch (error: any) {
      console.error('Error generating report:', error);
      if (error?.code === 'auth/requires-recent-login') {
        alert('Sua sessão expirou. Por favor, faça login novamente.');
      } else {
        alert('Erro ao gerar relatório. Por favor, tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

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
              onChange={(newValue) => {
                clearReportData();
                setSelectedRadios(newValue as { value: string; label: string }[]);
              }}
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
              onChange={(newValue) => {
                clearReportData();
                setChartSize(newValue as { value: string; label: string });
              }}
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
              onChange={(e) => {
                clearReportData();
                setStartDate(e.target.value);
              }}
            />
          </div>
          <div className="ranking-filter-group">
            <label htmlFor="date-end">Data Fim:</label>
            <input
              type="date"
              id="date-end"
              value={endDate}
              onChange={(e) => {
                clearReportData();
                setEndDate(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="city-select">Cidade:</label>
            <Select
              id="city-select"
              options={citiesOptions}
              value={selectedCity}
              onChange={async (newValue) => {
                clearReportData();
                setSelectedRadios([]);
                setSelectedCity(newValue as { value: string; label: string } | null);
                if (newValue) {
                  try {
                    setLoadingLocation(true);
                    if (selectedState) {
                      const isValid = await validateLocation(newValue.value, selectedState.value);
                      if (!isValid) {
                        alert(`A cidade ${newValue.label} não pertence ao estado ${selectedState.label}`);
                        setSelectedCity(null);
                        return;
                      }
                    }
                    await new Promise(resolve => setTimeout(resolve, 7000));
                    const radios = await fetchRadiosByLocation(newValue.value);
                    setSelectedRadios(radios);
                  } catch (error: any) {
                    console.error('Error loading city radios:', error);
                    if (error?.code === 'auth/requires-recent-login') {
                      alert('Sua sessão expirou. Por favor, faça login novamente.');
                    } else {
                      alert('Erro ao carregar rádios da cidade. Por favor, tente novamente.');
                    }
                  } finally {
                    setLoadingLocation(false);
                  }
                }
              }}
              placeholder="Selecione a cidade"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        </div>
        <div className="ranking-filter-row">
          <div className="ranking-filter-group">
            <label htmlFor="state-select">Estado:</label>
            <Select
              id="state-select"
              options={statesOptions}
              value={selectedState}
              onChange={async (newValue) => {
                clearReportData();
                setSelectedRadios([]);
                setSelectedState(newValue as { value: string; label: string } | null);
                if (newValue) {
                  try {
                    setLoadingLocation(true);
                    if (selectedCity) {
                      const isValid = await validateLocation(selectedCity.value, newValue.value);
                      if (!isValid) {
                        alert(`A cidade ${selectedCity.label} não pertence ao estado ${newValue.label}`);
                        setSelectedCity(null);
                        return;
                      }
                    }
                    await new Promise(resolve => setTimeout(resolve, 7000));
                    const radios = await fetchRadiosByLocation(undefined, newValue.value);
                    setSelectedRadios(radios);
                  } catch (error: any) {
                    console.error('Error loading state radios:', error);
                    if (error?.code === 'auth/requires-recent-login') {
                      alert('Sua sessão expirou. Por favor, faça login novamente.');
                    } else {
                      alert('Erro ao carregar rádios do estado. Por favor, tente novamente.');
                    }
                  } finally {
                    setLoadingLocation(false);
                  }
                }
              }}
              placeholder="Selecione o estado"
              className="react-select-container"
              classNamePrefix="react-select"
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
          <p>
            {loadingLocation ? 'Carregando rádios da localização...' : 'Gerando relatório...'}
          </p>
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
