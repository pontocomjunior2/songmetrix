import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase-client';
import { Loader2, FileDown, Calendar, MapPin, Radio, ChevronRight, ToggleLeft, ToggleRight, InfoIcon, Music } from 'lucide-react';
import moment from 'moment';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiServices, { getAuthHeaders } from '../services/api';
import { fetchAllPopularityData } from './Relatorios/services/popularity';
import PopularityIndicator from './Relatorios/components/PopularityIndicator';

import './Ranking/styles/Ranking.css';

interface ReportData {
  title: string;
  artist: string;
  executions: {
    [radioKey: string]: number;
  };
  total: number;
  spotify?: {
    popularity: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  youtube?: {
    popularity: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
}

interface RadioAbbreviation {
  radio_name: string;
  abbreviation: string;
}

const chartSizeOptions = [
  { value: '50', label: 'SongMetrix Chart 50' },
  { value: '100', label: 'SongMetrix Chart 100' },
  { value: '200', label: 'SongMetrix Chart 200' }
];

const reportTypes = [
  {
    id: 'radios',
    title: 'Por Rádios',
    description: 'Gere relatórios específicos selecionando rádios individualmente',
    icon: <Radio className="w-8 h-8 text-navy-600" />
  },
  {
    id: 'city',
    title: 'Por Cidade',
    description: 'Analise dados de todas as rádios de uma cidade específica',
    icon: <MapPin className="w-8 h-8 text-navy-600" />
  },
  {
    id: 'state',
    title: 'Por Estado',
    description: 'Visualize dados agregados de todas as rádios de um estado',
    icon: <MapPin className="w-8 h-8 text-navy-600" />
  }
];

const RelatoriosWizard: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
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
  const [includeSpotify, setIncludeSpotify] = useState(false);
  const [includeYoutube, setIncludeYoutube] = useState(false);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingYoutube, setLoadingYoutube] = useState(false);

  const getRadioAbbreviation = (radioName: string): string => {
    return radioAbbreviations[radioName] || radioName.substring(0, 3).toUpperCase();
  };

  const getSpotifyAbbreviation = (): string => {
    return radioAbbreviations['Spotify'] || 'SFY';
  };

  const getYoutubeAbbreviation = (): string => {
    return radioAbbreviations['Youtube'] || 'YTB';
  };

  const clearReportData = () => {
    if (reportGenerated) {
      setReportData([]);
      setReportGenerated(false);
    }
  };

  const validateLocation = async (city: string, state: string) => {
    try {
      return await apiServices.reports.validateLocation(city, state);
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
      const data = await apiServices.reports.getRadiosByLocation(city, state);
      return data.map((radio: string) => ({ value: radio, label: radio }));
    } catch (error: any) {
      console.error('Error fetching radios by location:', error);
      if (error?.code === 'auth/requires-recent-login') {
        alert('Sua sessão expirou. Por favor, faça login novamente.');
      }
      return [];
    }
  };

  const fetchOnlineData = async (reportData: ReportData[]): Promise<ReportData[]> => {
    if (!includeSpotify && !includeYoutube) {
      return reportData;
    }

    try {
      setLoadingSpotify(includeSpotify);
      setLoadingYoutube(includeYoutube);
      
      console.log(`Buscando dados de popularidade para o período: ${startDate} a ${endDate}`);
      console.log(`Plataformas incluídas: ${includeSpotify ? 'Spotify' : ''} ${includeYoutube ? 'YouTube' : ''}`);
      
      const tracksToFetch = reportData.map(item => ({
        title: item.title,
        artist: item.artist
      }));
      
      // Buscar dados de todas as plataformas de streaming em uma única chamada
      // Passando as opções para indicar quais plataformas incluir
      const popularityData = await fetchAllPopularityData(
        tracksToFetch, 
        startDate, 
        endDate,
        {
          includeSpotify,
          includeYoutube
        }
      );
      
      const updatedReportData = reportData.map(item => {
        const trackKey = `${item.title}|${item.artist}`.toLowerCase();
        
        // Dados do Spotify
        const spotifyData = includeSpotify ? popularityData.spotify[trackKey] : undefined;
        
        // Dados do YouTube
        const youtubeData = includeYoutube ? popularityData.youtube[trackKey] : undefined;
        
        return {
          ...item,
          spotify: spotifyData ? {
            popularity: spotifyData.score,
            trend: spotifyData.trend,
            trendPercentage: spotifyData.trendPercentage
          } : undefined,
          youtube: youtubeData ? {
            popularity: youtubeData.score,
            trend: youtubeData.trend,
            trendPercentage: youtubeData.trendPercentage
          } : undefined
        };
      });
      
      console.log('Dados de popularidade obtidos com sucesso');
      return updatedReportData;
    } catch (error) {
      console.error('Erro ao buscar dados de popularidade:', error);
      return reportData;
    } finally {
      setLoadingSpotify(false);
      setLoadingYoutube(false);
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
      let radiosToUse = selectedRadios;
      if (hasLocationFilter) {
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
      
      const params: any = {
        startDate,
        endDate,
        limit: chartSize.value
      };
      
      if (radiosToUse.length > 0) {
        params.radios = radiosToUse.map(r => r.value).join('||');
      }
      
      if (selectedCity) {
        params.city = selectedCity.value;
      }
      
      if (selectedState) {
        params.state = selectedState.value;
      }
      
      let data = await apiServices.reports.generateReport(params);
      
      // Buscar dados de popularidade online (Spotify e YouTube)
      if (includeSpotify || includeYoutube) {
        data = await fetchOnlineData(data);
      }
      
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

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        console.log('No user logged in, skipping data fetch');
        return;
      }
      try {
        const radiosData = await apiServices.reports.getRadios();
        const options = radiosData.map((radio: { name: string }) => ({
          value: radio.name,
          label: radio.name,
        }));
        setRadiosOptions(options);
        
        const abbreviationsData = await apiServices.reports.getRadioAbbreviations();
        const abbrevMap = abbreviationsData.reduce((acc: { [key: string]: string }, { radio_name, abbreviation }: RadioAbbreviation) => {
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
        const citiesData = await apiServices.reports.getCities();
        const cityOptions = citiesData.map((city: string) => ({
          value: city,
          label: city,
        }));
        setCitiesOptions(cityOptions);
        
        const statesData = await apiServices.reports.getStates();
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

  const renderStep1 = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {reportTypes.map((type) => (
        <button
          key={type.id}
          onClick={() => {
            setSelectedReportType(type.id);
            setCurrentStep(2);
            setSelectedRadios([]);
            setSelectedCity(null);
            setSelectedState(null);
          }}
          className={`p-6 rounded-lg border-2 transition-all ${
            selectedReportType === type.id
              ? 'border-navy-600 bg-navy-50 dark:bg-navy-900'
              : 'border-gray-200 dark:border-gray-700 hover:border-navy-400'
          }`}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            {type.icon}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{type.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{type.description}</p>
          </div>
        </button>
      ))}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      {selectedReportType === 'radios' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selecione as Rádios
          </label>
          <Select
            options={radiosOptions}
            isMulti
            value={selectedRadios}
            onChange={(newValue) => {
              setSelectedRadios(newValue as { value: string; label: string }[]);
            }}
            placeholder="Escolha uma ou mais rádios"
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
      )}

      {selectedReportType === 'city' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selecione a Cidade
          </label>
          <Select
            options={citiesOptions}
            value={selectedCity}
            onChange={(newValue) => {
              setSelectedCity(newValue as { value: string; label: string });
            }}
            placeholder="Escolha uma cidade"
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
      )}

      {selectedReportType === 'state' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selecione o Estado
          </label>
          <Select
            options={statesOptions}
            value={selectedState}
            onChange={(newValue) => {
              setSelectedState(newValue as { value: string; label: string });
            }}
            placeholder="Escolha um estado"
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Período do Relatório
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-navy-500"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tamanho do Chart
          </label>
          <Select
            options={chartSizeOptions}
            value={chartSize}
            onChange={(newValue) => setChartSize(newValue as { value: string; label: string })}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
      </div>
      
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Fontes de Dados Adicionais</h3>
        
        {/* Spotify Toggle */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
              <Music className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Spotify
                </label>
                <div className="group relative">
                  <InfoIcon className="w-4 h-4 text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-6 hidden group-hover:block bg-white dark:bg-gray-800 p-2 rounded shadow-lg border border-gray-200 dark:border-gray-700 w-72 text-xs text-gray-600 dark:text-gray-300 z-10">
                    Adiciona uma coluna com o número estimado de reproduções no Spotify para cada música durante o período selecionado. Os valores são aproximados e apresentados em formato abreviado (k = mil, mi = milhão, bi = bilhão).
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reproduções estimadas durante o período selecionado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIncludeSpotify(!includeSpotify)}
            className="text-navy-600 hover:text-navy-700 focus:outline-none"
            aria-pressed={includeSpotify}
          >
            {includeSpotify ? (
              <ToggleRight className="w-10 h-10" />
            ) : (
              <ToggleLeft className="w-10 h-10" />
            )}
          </button>
        </div>
        
        {/* YouTube Toggle */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  YouTube
                </label>
                <div className="group relative">
                  <InfoIcon className="w-4 h-4 text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-6 hidden group-hover:block bg-white dark:bg-gray-800 p-2 rounded shadow-lg border border-gray-200 dark:border-gray-700 w-72 text-xs text-gray-600 dark:text-gray-300 z-10">
                    Adiciona uma coluna com o número estimado de visualizações no YouTube para cada música durante o período selecionado. Os valores são aproximados e apresentados em formato abreviado (k = mil, mi = milhão, bi = bilhão).
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Visualizações estimadas durante o período selecionado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIncludeYoutube(!includeYoutube)}
            className="text-navy-600 hover:text-navy-700 focus:outline-none"
            aria-pressed={includeYoutube}
          >
            {includeYoutube ? (
              <ToggleRight className="w-10 h-10" />
            ) : (
              <ToggleLeft className="w-10 h-10" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Configurar título do documento
    doc.setFontSize(20);
    doc.text('Relatório SongMetrix', 14, 22);
    
    // Configurar subtítulo (data)
    doc.setFontSize(12);
    doc.text(`Período: ${startDate} a ${endDate}`, 14, 32);
    
    // Cabeçalhos da tabela
    const headers = ['Pos', 'Título', 'Artista'];
    
    // Adicionar colunas de rádios
    selectedRadios.forEach((radio) => {
      headers.push(getRadioAbbreviation(radio.label));
    });
    
    // Adicionar colunas de streaming
    if (includeSpotify) {
      headers.push(getSpotifyAbbreviation());
    }
    
    if (includeYoutube) {
      headers.push(getYoutubeAbbreviation());
    }
    
    headers.push('Total');
    
    // Dados da tabela
    const tableData = reportData.map((item, index) => {
      const row = [
        `${getPosition(index, item)}º`,
        item.title,
        item.artist
      ];
      
      // Adicionar colunas de execuções por rádio
      selectedRadios.forEach((radio) => {
        row.push(String(item.executions[radio.value] || 0));
      });
      
      // Adicionar dados do Spotify (apenas o valor numérico para PDF)
      if (includeSpotify) {
        row.push(item.spotify ? `${item.spotify.popularity}/100` : '-');
      }
      
      // Adicionar dados do YouTube (apenas o valor numérico para PDF)
      if (includeYoutube) {
        row.push(item.youtube ? `${item.youtube.popularity}/100` : '-');
      }
      
      row.push(String(item.total));
      
      return row;
    });
    
    autoTable(doc, {
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
    
    let legendIndex = 0;
    
    // Adicionar abreviações de rádios à legenda
    selectedRadios.forEach((radio) => {
      const abbrev = getRadioAbbreviation(radio.label);
      doc.text(`${abbrev} (${radio.label})`, 14, legendY + 10 + (legendIndex * 6));
      legendIndex++;
    });
    
    // Adicionar Spotify à legenda, se incluído
    if (includeSpotify) {
      const abbrev = getSpotifyAbbreviation();
      doc.text(`${abbrev} (Spotify - Pontuação de 0-100)`, 14, legendY + 10 + (legendIndex * 6));
      legendIndex++;
    }
    
    // Adicionar YouTube à legenda, se incluído
    if (includeYoutube) {
      const abbrev = getYoutubeAbbreviation();
      doc.text(`${abbrev} (YouTube - Pontuação de 0-100)`, 14, legendY + 10 + (legendIndex * 6));
    }
    
    doc.save(`relatorio-${moment().format('YYYY-MM-DD')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
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
        
        <div className="mt-6 flex items-center">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-navy-600' : 'text-gray-400'}`}>
            <div className="rounded-full h-8 w-8 flex items-center justify-center border-2 border-current">
              1
            </div>
            <span className="ml-2">Tipo de Relatório</span>
          </div>
          <ChevronRight className="mx-4 h-5 w-5 text-gray-400" />
          <div className={`flex items-center ${currentStep >= 2 ? 'text-navy-600' : 'text-gray-400'}`}>
            <div className="rounded-full h-8 w-8 flex items-center justify-center border-2 border-current">
              2
            </div>
            <span className="ml-2">Seleção</span>
          </div>
          <ChevronRight className="mx-4 h-5 w-5 text-gray-400" />
          <div className={`flex items-center ${currentStep >= 3 ? 'text-navy-600' : 'text-gray-400'}`}>
            <div className="rounded-full h-8 w-8 flex items-center justify-center border-2 border-current">
              3
            </div>
            <span className="ml-2">Período e Chart</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

        <div className="mt-6 flex justify-between">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Voltar
            </button>
          )}
          {currentStep < 3 && (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="ml-auto px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
              disabled={
                (currentStep === 2 && selectedReportType === 'radios' && selectedRadios.length === 0) ||
                (currentStep === 2 && selectedReportType === 'city' && !selectedCity) ||
                (currentStep === 2 && selectedReportType === 'state' && !selectedState)
              }
            >
              Próximo
            </button>
          )}
          {currentStep === 3 && (
            <button
              onClick={handleGenerateReport}
              className="ml-auto flex items-center gap-2 px-6 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors disabled:bg-navy-400"
              disabled={loading || loadingSpotify || loadingYoutube}
            >
              {loading || loadingSpotify || loadingYoutube ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loadingSpotify ? 'Buscando dados do Spotify...' : loadingYoutube ? 'Buscando dados do YouTube...' : 'Gerando...'}
                </>
              ) : (
                'Gerar Relatório'
              )}
            </button>
          )}
        </div>
      </div>

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
                    {includeSpotify && (
                      <th className="px-4 py-3 text-left text-sm font-medium text-white bg-green-600 dark:bg-green-800">
                        {getSpotifyAbbreviation()}
                      </th>
                    )}
                    {includeYoutube && (
                      <th className="px-4 py-3 text-left text-sm font-medium text-white bg-red-600 dark:bg-red-800">
                        {getYoutubeAbbreviation()}
                      </th>
                    )}
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
                      {includeSpotify && (
                        <td className="px-4 py-3 text-sm bg-green-50 dark:bg-green-950 text-gray-700 dark:text-gray-200">
                          {item.spotify ? (
                            <PopularityIndicator 
                              type="spotify"
                              popularity={item.spotify.popularity}
                              trend={item.spotify.trend}
                              trendPercentage={item.spotify.trendPercentage}
                              showSparkline={false}
                              size="md"
                            />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {includeYoutube && (
                        <td className="px-4 py-3 text-sm bg-red-50 dark:bg-red-950 text-gray-700 dark:text-gray-200">
                          {item.youtube ? (
                            <PopularityIndicator 
                              type="youtube"
                              popularity={item.youtube.popularity}
                              trend={item.youtube.trend}
                              trendPercentage={item.youtube.trendPercentage}
                              showSparkline={false}
                              size="md"
                            />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
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

export default RelatoriosWizard;
