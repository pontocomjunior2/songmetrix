import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, FileDown, Filter, X, Calendar, MapPin, Radio } from 'lucide-react';
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
  const [showFilters, setShowFilters] = useState(true);
  const [selectedRadios, setSelectedRadios] = useState<Array<{ value: string; label: string }>>([]);
  const [radiosOptions, setRadiosOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [radioAbbreviations, setRadioAbbreviations] = useState<{ [key: string]: string }>({});
  const [reportGenerated, setReportGenerated] = useState(false);
  const [startDate, setStartDate] = useState(moment().subtract(7, 'days').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [chartSize, setChartSize] = useState(chartSizeOptions[0]);
  const [selectedCity, setSelectedCity] = useState<{ value: string; label: string } | null>(null);
  const [selectedState, setSelectedState] = useState<{ value: string; label: string } | null>(null);
  const [citiesOptions, setCitiesOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [statesOptions, setStatesOptions] = useState<Array<{ value: string; label: string }>>([]);

  // Mantendo todas as funções auxiliares originais
  const getRadioAbbreviation = (radioName: string): string => {
    return radioAbbreviations[radioName] || radioName.substring(0, 3).toUpperCase();
  };

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

  // Mantendo todas as funções de validação e busca originais
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

  // Mantendo a função generatePDF original
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

  // Mantendo a função handleGenerateReport original
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

  // Mantendo o useEffect original para carregar dados iniciais
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Título e Botões */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          {reportGenerated && (
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Baixar PDF
            </button>
          )}
        </div>
      </div>

      {/* Painel de Filtros */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 space-y-6">
            {/* Filtros de Período */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Calendar className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Período</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      clearReportData();
                      setStartDate(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      clearReportData();
                      setEndDate(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
                  />
                </div>
              </div>
            </div>

            {/* Filtros de Localização */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <MapPin className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Localização</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado
                  </label>
                  <Select
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cidade
                  </label>
                  <Select
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
            </div>

            {/* Filtros de Rádio e Chart */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Radio className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Rádios e Chart</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rádios
                  </label>
                  <Select
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chart
                  </label>
                  <Select
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
            </div>

            {/* Botão de Gerar Relatório */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                className="flex items-center gap-2 px-6 py-2.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors disabled:bg-navy-400"
                onClick={handleGenerateReport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    Gerar Relatório
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Loader2 className="w-8 h-8 animate-spin text-navy-600" />
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {loadingLocation ? 'Carregando rádios da localização...' : 'Gerando relatório...'}
          </p>
        </div>
      )}

      {/* Tabela de Resultados */}
      {reportData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {chartSize.label}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Pos</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Título</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Artista</th>
                    {selectedRadios.map((radio) => (
                      <th key={radio.value} className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">
                        {getRadioAbbreviation(radio.label)}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {reportData.slice(0, parseInt(chartSize.value)).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{getPosition(index, item)}º</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.artist}</td>
                      {selectedRadios.map((radio) => (
                        <td key={radio.value} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                          {item.executions[radio.value] || 0}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Relatorios;
