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
  /* Comentado para remoção do YouTube
  youtube?: {
    popularity: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
  };
  */
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
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  /* Comentado para remoção do YouTube  
  const [includeYoutube, setIncludeYoutube] = useState(false);
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  */

  const getRadioAbbreviation = (radioName: string): string => {
    return radioAbbreviations[radioName] || radioName.substring(0, 3).toUpperCase();
  };

  const getSpotifyAbbreviation = (): string => {
    return radioAbbreviations['Spotify'] || 'SFY';
  };

  /* Comentado para remoção do YouTube
  const getYoutubeAbbreviation = (): string => {
    return radioAbbreviations['Youtube'] || 'YTB';
  };
  */

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
    if (!includeSpotify /* Comentado: && !includeYoutube */) {
      return reportData;
    }

    try {
      setLoadingSpotify(includeSpotify);
      /* Comentado para remoção do YouTube
      setLoadingYoutube(includeYoutube);
      */
      
      console.log(`Buscando dados de popularidade para o período: ${startDate} a ${endDate}`);
      console.log(`Plataformas incluídas: ${includeSpotify ? 'Spotify' : ''}`);
      
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
          /* Comentado para remoção do YouTube
          includeYoutube
          */
          includeYoutube: false // Substituindo por false para desativar
        }
      );
      
      const updatedReportData = reportData.map(item => {
        const trackKey = `${item.title}|${item.artist}`.toLowerCase();
        
        // Dados do Spotify
        const spotifyData = includeSpotify ? popularityData.spotify[trackKey] : undefined;
        
        /* Comentado para remoção do YouTube
        // Dados do YouTube
        const youtubeData = includeYoutube ? popularityData.youtube[trackKey] : undefined;
        */
        
        return {
          ...item,
          spotify: spotifyData ? {
            popularity: spotifyData.score,
            trend: spotifyData.trend,
            trendPercentage: spotifyData.trendPercentage
          } : undefined,
          /* Comentado para remoção do YouTube
          youtube: youtubeData ? {
            popularity: youtubeData.score,
            trend: youtubeData.trend,
            trendPercentage: youtubeData.trendPercentage
          } : undefined
          */
        };
      });
      
      console.log('Dados de popularidade obtidos com sucesso');
      return updatedReportData;
    } catch (error) {
      console.error('Erro ao buscar dados de popularidade:', error);
      return reportData;
    } finally {
      setLoadingSpotify(false);
      /* Comentado para remoção do YouTube
      setLoadingYoutube(false);
      */
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
      if (includeSpotify /* Comentado: || includeYoutube */) {
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
                    Adiciona uma coluna que exibe o índice de popularidade da música no Spotify (escala de 0-100). Este índice reflete o quão popular a música está na plataforma, baseado em número de streams recentes. As setas indicam a tendência de crescimento ou queda na popularidade da música.
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Índice de popularidade da música no Spotify
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIncludeSpotify(!includeSpotify)}
            className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${
              includeSpotify ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            aria-pressed={includeSpotify}
          >
            <span className={`absolute block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
              includeSpotify ? 'right-0.5' : 'left-0.5'
            }`}></span>
          </button>
        </div>
        
        {/* Comentado para remoção do YouTube */}
        {/* YouTube Toggle
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
                    Adiciona uma coluna que exibe o índice de popularidade da música no YouTube (escala de 0-100). Este índice é calculado com base no número de visualizações, likes e engajamento recentes. As setas indicam se a popularidade da música está crescendo ou diminuindo.
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Índice de popularidade da música no YouTube
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIncludeYoutube(!includeYoutube)}
            className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${
              includeYoutube ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            aria-pressed={includeYoutube}
          >
            <span className={`absolute block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
              includeYoutube ? 'right-0.5' : 'left-0.5'
            }`}></span>
          </button>
        </div>
        */}
      </div>
    </div>
  );

  const generatePDF = () => {
    // Criar documento PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Definir cores
    const primaryColor = [25, 55, 109]; // Azul escuro do Songmetrix
    const secondaryColor = [41, 128, 185]; // Azul mais claro para cabeçalhos
    const spotifyColor = [29, 185, 84]; // Verde do Spotify
    
    // Adicionar título do relatório (sem logo)
    doc.setFontSize(24);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('SongMetrix', 14, 20);
    
    // Adicionar subtítulo do relatório
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(chartSize.label, 14, 30);
    
    // Adicionar informações do período
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${moment(startDate).format('DD/MM/YYYY')} a ${moment(endDate).format('DD/MM/YYYY')}`, 14, 36);
    
    // Adicionar informações de seleção
    let selectionText = '';
    if (selectedReportType === 'radios') {
      selectionText = `Rádios: ${selectedRadios.map(r => r.label).join(', ')}`;
    } else if (selectedReportType === 'city') {
      selectionText = `Cidade: ${selectedCity?.label}`;
    } else if (selectedReportType === 'state') {
      selectionText = `Estado: ${selectedState?.label}`;
    }
    
    // Verificar se o texto é muito longo e quebrar em múltiplas linhas se necessário
    if (selectionText.length > 100) {
      const splitText = doc.splitTextToSize(selectionText, 180);
      doc.text(splitText, 14, 42);
    } else {
      doc.text(selectionText, 14, 42);
    }
    
    // Cabeçalhos da tabela
    const headers = ['Pos', 'Título', 'Artista'];
    
    // Adicionar colunas de rádios
    selectedRadios.forEach((radio) => {
      headers.push(getRadioAbbreviation(radio.label));
    });
    
    // Adicionar colunas de streaming
    if (includeSpotify) {
      headers.push('Spotify');
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
        if (item.spotify) {
          // Abordagem completamente nova para formatar o valor do Spotify
          // Garantindo que não haja espaços extras entre os números
          const popularity = Math.round(item.spotify.popularity);
          const trend = item.spotify.trend === 'up' ? '↑' : 
                        item.spotify.trend === 'down' ? '↓' : '';
          
          // Remover qualquer espaço e garantir que o formato seja "XX/100↑" sem espaços
          row.push(popularity + '/100' + trend);
        } else {
          row.push('-');
        }
      }
      
      row.push(String(item.total));
      
      return row;
    });
    
    // Gerar tabela com estilos modernos
    autoTable(doc, {
      head: [headers],
      body: tableData.slice(0, parseInt(chartSize.value)),
      startY: 50,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [secondaryColor[0], secondaryColor[1], secondaryColor[2]],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' }, // Posição
        1: { cellWidth: 50 }, // Título
        2: { cellWidth: 40 }, // Artista
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      didParseCell: (data) => {
        // Centralizar os valores numéricos
        if (data.column.index >= 3) {
          data.cell.styles.halign = 'center';
        }
        
        // Destacar a coluna Total
        if (data.column.index === headers.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
        
        // Aplicar estilo ao cabeçalho do Spotify
        if (includeSpotify) {
          const spotifyColIndex = 3 + selectedRadios.length;
          
          // Apenas o cabeçalho (primeira linha) da coluna Spotify terá verde escuro
          if (data.column.index === spotifyColIndex) {
            if (data.section === 'head') {
              data.cell.styles.fillColor = [spotifyColor[0], spotifyColor[1], spotifyColor[2]];
            }
            // Todas as linhas de dados (não cabeçalho) terão verde claro
            else if (data.section === 'body') {
              data.cell.styles.fillColor = [240, 255, 240];
            }
          }
        }
      }
    });
    
    // Adicionar legendas em formato de tabela
    const legendY = (doc as any).lastAutoTable.finalY + 10;
    
    // Adicionar título da legenda
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Legenda:', 14, legendY);
    
    // Criar tabela de legendas
    const legendHeaders = ['Abreviação', 'Nome Completo'];
    const legendData: string[][] = [];
    
    // Adicionar cada rádio à legenda
    selectedRadios.forEach((radio) => {
      const abbrev = getRadioAbbreviation(radio.label);
      legendData.push([abbrev, radio.label]);
    });
    
    // Adicionar Spotify à legenda, se incluído
    if (includeSpotify) {
      legendData.push(['Spotify', 'Índice de popularidade no formato XX/100']);
      legendData.push(['↑', 'Tendência de alta na popularidade']);
      legendData.push(['↓', 'Tendência de queda na popularidade']);
    }
    
    // Gerar tabela de legendas
    autoTable(doc, {
      head: [legendHeaders],
      body: legendData,
      startY: legendY + 5,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: 80,
        fontSize: 8,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 120 },
      },
      margin: { left: 14 },
      tableWidth: 145,
    });
    
    // Adicionar rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Adicionar data de geração
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Gerado em ${moment().format('DD/MM/YYYY HH:mm')}`, 14, 285);
      
      // Adicionar número da página
      doc.text(`Página ${i} de ${pageCount}`, 180, 285, { align: 'right' });
    }
    
    // Salvar o PDF
    doc.save(`relatorio-songmetrix-${moment().format('YYYY-MM-DD')}.pdf`);
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
              disabled={loading || loadingSpotify}
            >
              {loading || loadingSpotify ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loadingSpotify ? 'Buscando dados do Spotify...' : 'Gerando...'}
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 w-12">Pos</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 w-44">Título</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 w-44">Artista</th>
                    {selectedRadios.map((radio) => (
                      <th key={radio.value} className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-200 w-16">
                        {getRadioAbbreviation(radio.label)}
                      </th>
                    ))}
                    {includeSpotify && (
                      <th className="px-4 py-3 text-center text-sm font-medium text-white bg-green-600 dark:bg-green-800 w-28">
                        <div className="flex items-center justify-center gap-2 group relative">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                          <span>Spotify</span>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-green-700 text-white text-xs rounded p-1 w-40 mb-1 z-10 text-center whitespace-normal">
                            Índice de popularidade de 0-100, com tendência de alta ou baixa
                          </div>
                        </div>
                      </th>
                    )}
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-200 w-16">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {reportData.slice(0, parseInt(chartSize.value)).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 text-center">{getPosition(index, item)}º</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs">{item.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs">{item.artist}</td>
                      {selectedRadios.map((radio) => (
                        <td key={radio.value} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 text-center">
                          {item.executions[radio.value] || 0}
                        </td>
                      ))}
                      {includeSpotify && (
                        <td className="px-4 py-3 text-center text-sm bg-green-50 dark:bg-green-900/20">
                          {item.spotify ? (
                            <PopularityIndicator
                              type="spotify"
                              popularity={item.spotify.popularity}
                              trend={item.spotify.trend}
                              trendPercentage={item.spotify.trendPercentage}
                              size="sm"
                              variant="compact"
                            />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-center">{item.total}</td>
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
