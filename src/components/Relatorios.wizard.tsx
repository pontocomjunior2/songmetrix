import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { useAuth } from '../hooks/useAuth';
import { Loader2, FileDown, MapPin, Radio, ChevronRight, InfoIcon, Music, Lock } from 'lucide-react';
import moment from 'moment';
import { jsPDF } from 'jspdf';
import autoTable, { CellInput } from 'jspdf-autotable';
import apiServices from '../services/api.js';
import { fetchAllPopularityData } from './Relatorios/services/popularity';
import PopularityIndicator from './Relatorios/components/PopularityIndicator';
import { useForm, Controller } from 'react-hook-form';
import { Stepper, type Step } from './ui/stepper';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

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
}

interface RadioAbbreviation {
  radio_name: string;
  abbreviation: string;
}

interface TableHeader {
  content: string;
  width: number;
  tooltip?: string;
}

type AutoTableStyles = {
  font?: string;
  fontSize?: number;
  cellPadding?: number;
  lineColor?: [number, number, number];
  lineWidth?: number;
  cellWidth?: 'auto' | 'wrap' | number;
};

type AutoTableConfig = {
  startY: number;
  head: CellInput[][];
  body: CellInput[][];
  styles?: AutoTableStyles;
  headStyles?: {
    fillColor?: [number, number, number];
    textColor?: [number, number, number];
    fontStyle?: 'normal' | 'bold' | 'italic';
  };
  columnStyles?: { [key: number]: { cellWidth?: number } };
  margin?: { left: number; right: number };
  didDrawPage?: (data: { pageNumber: number }) => void;
};

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

// Definir os passos para o novo Stepper
const wizardSteps: Step[] = [
  { label: "Tipo de Relatório" },
  { label: "Seleção" },
  { label: "Período e Chart" }
];

// Componente de Upsell para Relatórios
const UpsellNoticeRelatorios: React.FC = () => (
  <div className="flex justify-center items-center h-[calc(100vh-200px)]">
    <Alert variant="default" className="max-w-lg border-primary bg-primary/5">
      <Lock className="h-5 w-5 text-primary" />
      <AlertTitle className="font-bold text-lg text-primary">Relatórios Detalhados Exclusivos</AlertTitle>
      <AlertDescription className="mt-2">
        Gere relatórios personalizados por rádio, cidade ou estado para análises aprofundadas.
        <br />
        Assine um plano para desbloquear esta poderosa ferramenta de inteligência de mercado.
      </AlertDescription>
      <Button asChild className="mt-4">
        <Link to="/plans">Ver Planos de Assinatura</Link>
      </Button>
    </Alert>
  </div>
);

const RelatoriosWizard: React.FC = () => {
  const { currentUser, planId, loading: authLoading, isInitialized } = useAuth();
  
  // --- VERIFICAÇÃO DE CARREGAMENTO E PLANO PRIMEIRO ---
  if (!isInitialized || authLoading) {
     return (
       <div className="flex justify-center items-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
  }

  if (planId === 'FREE') {
    return <UpsellNoticeRelatorios />;
  }
  // --- FIM DA VERIFICAÇÃO ---

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
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [locationRadios, setLocationRadios] = useState<any[]>([]);

  const getRadioAbbreviation = (radioName: string): string => {
    return radioAbbreviations[radioName] || radioName.substring(0, 3).toUpperCase();
  };

  const getSpotifyAbbreviation = (): string => {
    return radioAbbreviations['Spotify'] || 'SFY';
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
      const radios = data.map((radio: string) => ({ value: radio, label: radio }));
      setLocationRadios(radios); // Armazenar as rádios obtidas por localização
      return radios;
    } catch (error: any) {
      console.error('Error fetching radios by location:', error);
      if (error?.code === 'auth/requires-recent-login') {
        alert('Sua sessão expirou. Por favor, faça login novamente.');
      }
      setLocationRadios([]);
      return [];
    }
  };

  const fetchOnlineData = async (reportData: ReportData[]): Promise<ReportData[]> => {
    if (!includeSpotify) {
      return reportData;
    }

    try {
      setLoadingSpotify(includeSpotify);
      
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
          includeYoutube: false // Substituindo por false para desativar
        }
      );
      
      const updatedReportData = reportData.map(item => {
        const trackKey = `${item.title}|${item.artist}`.toLowerCase();
        
        // Dados do Spotify
        const spotifyData = includeSpotify ? popularityData.spotify[trackKey] : undefined;
        
        return {
          ...item,
          spotify: spotifyData ? {
            popularity: spotifyData.score,
            trend: spotifyData.trend,
            trendPercentage: spotifyData.trendPercentage
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
    }
  };

  const handleGenerateReport = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    setLoading(true);
    try {
      const hasLocationFilter = selectedCity || selectedState;
      if (!hasLocationFilter && selectedRadios.length === 0) {
        alert('Selecione rádios ou um filtro de localização (cidade/estado)');
        return;
      }
      
      let radiosToUse = selectedRadios;
      if (hasLocationFilter) {
        const locationRadios = await fetchRadiosByLocation(
          selectedCity?.value,
          selectedState?.value
        );
        if (locationRadios.length === 0) {
          alert('Nenhuma rádio encontrada para a localização selecionada');
          setLoading(false);
          return;
        }
        radiosToUse = locationRadios;
      }
      
      const params: any = {
        startDate: moment(startDate).format('YYYY-MM-DD'),
        endDate: moment(endDate).format('YYYY-MM-DD'),
        limit: chartSize.value,
      };
      
      if (radiosToUse && radiosToUse.length > 0) {
        // Verificar se há valores válidos antes de juntar
        const radioValues = radiosToUse
          .filter(r => r && r.value) // Filtrar valores nulos ou undefined
          .map(r => r.value);
          
        if (radioValues.length > 0) {
          params.radios = radioValues.join('||');
          console.log('Parâmetro radios:', params.radios);
        }
      }
      
      if (selectedCity) {
        params.city = selectedCity.value;
      }
      
      if (selectedState) {
        params.state = selectedState.value;
      }
      
      console.log('Gerando relatório com parâmetros:', params);
      let data = await apiServices.reports.generateReport(params);
      console.log('Dados do relatório recebidos da API:', data);
      
      // Armazenar a resposta completa da API para debugging
      setApiResponse(data);
      
      // Verificar se os dados estão no formato esperado
      if (!Array.isArray(data)) {
        console.warn('Dados recebidos não são um array, tentando converter...');
        if (data && typeof data === 'object') {
          if (data.data && Array.isArray(data.data)) {
            data = data.data;
          } else if (data.results && Array.isArray(data.results)) {
            data = data.results;
          } else {
            // Criar um array vazio se não conseguir encontrar os dados
            console.error('Não foi possível encontrar um array nos dados:', data);
            data = [];
          }
        } else {
          console.error('Dados recebidos não são um objeto:', data);
          data = [];
        }
      }
      
      // Verificar se há dados no array
      if (data.length === 0) {
        console.warn('Array de dados está vazio');
        alert('Nenhum dado encontrado para os parâmetros selecionados.');
        setLoading(false);
        return;
      }
      
      // Garantir que todos os itens tenham a propriedade executions
      data = data.map((item: any) => {
        if (!item.executions) {
          item.executions = {};
        }
        
        // Garantir que todas as rádios selecionadas tenham uma entrada em executions
        // Usar as rádios da localização quando houver filtro de cidade/estado
        const radiosToCheck = hasLocationFilter ? locationRadios : selectedRadios;
        radiosToCheck.forEach((radio: any) => {
          if (item.executions[radio.value] === undefined) {
            item.executions[radio.value] = 0;
          }
        });
        
        // Calcular o total de execuções
        item.total = Object.values(item.executions).reduce(
          (sum: number, count: any) => sum + (Number(count) || 0), 
          0
        );
        
        return item;
      });
      
      // Ordenar por total (decrescente)
      data.sort((a: any, b: any) => b.total - a.total);
      
      console.log('Dados processados para o relatório:', data);
      
      // Se incluir Spotify, buscar dados online
      if (includeSpotify) {
        data = await fetchOnlineData(data);
      }
      
      setReportData(data);
      setReportGenerated(true);
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      alert(`Erro ao gerar relatório: ${error.message || 'Erro desconhecido'}`);
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
        if (!apiServices || !apiServices.reports) {
          console.error('API services not available');
          return;
        }
        
        console.log('Fetching radios data...');
        const radiosData = await apiServices.reports.getRadios();
        
        if (!radiosData) {
          console.error('Radios data is null or undefined');
          return;
        }
        
        const options = radiosData.map((radio: { name: string }) => ({
          value: radio.name,
          label: radio.name,
        }));
        setRadiosOptions(options);
        
        console.log('Fetching radio abbreviations...');
        const abbreviationsData = await apiServices.reports.getRadioAbbreviations();
        
        if (!abbreviationsData) {
          console.error('Radio abbreviations data is null or undefined');
          return;
        }
        
        const abbrevMap = abbreviationsData.reduce((acc: { [key: string]: string }, { radio_name, abbreviation }: RadioAbbreviation) => {
          acc[radio_name] = abbreviation;
          return acc;
        }, {} as { [key: string]: string });
        setRadioAbbreviations(abbrevMap);
      } catch (error: any) {
        console.error('Error fetching data:', error);
        if (error?.message?.includes('Unauthorized') || error?.code === 'auth/requires-recent-login') {
          alert('Sua sessão expirou ou você não está autenticado. Por favor, faça login novamente.');
        } else {
          alert('Erro ao carregar dados. Por favor, tente novamente.');
        }
      }
    };

    const fetchLocationData = async () => {
      try {
        if (!apiServices || !apiServices.reports) {
          console.error('API services not available');
          return;
        }
        
        console.log('Fetching cities data...');
        const citiesData = await apiServices.reports.getCities();
        
        if (!citiesData) {
          console.error('Cities data is null or undefined');
          return;
        }
        
        const cityOptions = citiesData.map((city: string) => ({
          value: city,
          label: city,
        }));
        setCitiesOptions(cityOptions);
        
        console.log('Fetching states data...');
        const statesData = await apiServices.reports.getStates();
        
        if (!statesData) {
          console.error('States data is null or undefined');
          return;
        }
        
        const stateOptions = statesData.map((state: string) => ({
          value: state,
          label: state,
        }));
        setStatesOptions(stateOptions);
      } catch (error: any) {
        console.error('Error fetching location data:', error);
        if (error?.message?.includes('Unauthorized') || error?.code === 'auth/requires-recent-login') {
          alert('Sua sessão expirou ou você não está autenticado. Por favor, faça login novamente.');
        } else {
          alert('Erro ao carregar dados de localização. Por favor, tente novamente.');
        }
      }
    };

    if (currentUser) {
      console.log('Current user is logged in, fetching data...');
      fetchData();
      fetchLocationData();
    } else {
      console.log('No user logged in, skipping API calls');
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
          className={cn(
            "rounded-lg border-2 transition-all h-full flex flex-col hover:shadow-md",
            "p-6",
            selectedReportType === type.id
              ? 'border-navy-600 bg-navy-50 dark:bg-navy-900'
              : 'border-gray-200 dark:border-gray-700 hover:border-navy-400'
          )}
        >
          <div className="items-center text-center space-y-3 flex-grow flex flex-col justify-center">
            <div>
              {React.cloneElement(type.icon as React.ReactElement, { className: cn((type.icon as React.ReactElement).props.className, "mx-auto") })}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{type.title}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">{type.description}</p>
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
      </div>
    </div>
  );

  const generatePDF = () => {
    try {
      // Criar documento PDF em modo paisagem
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Definir margens e área útil
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 10;
      const usableWidth = pageWidth - (2 * margin);
      
      // Adicionar cabeçalho
      doc.setFontSize(16);
      doc.text('Relatório de Execuções', pageWidth / 2, margin + 5, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Período: ${moment(startDate).format('DD/MM/YYYY')} a ${moment(endDate).format('DD/MM/YYYY')}`, pageWidth / 2, margin + 12, { align: 'center' });
      
      // Configurar fonte e tamanho para o conteúdo
      doc.setFontSize(8);
      
      // Larguras específicas para colunas fixas
      const posWidth = 10;
      const titleWidth = 40;
      const artistWidth = 40;
      const spotifyWidth = includeSpotify ? 15 : 0;
      const totalWidth = 15;
      
      // Calcular largura disponível para colunas de rádios
      const radios = selectedReportType === 'radios' ? selectedRadios : locationRadios;
      const remainingWidth = usableWidth - (posWidth + titleWidth + artistWidth + spotifyWidth + totalWidth);
      const radioWidth = Math.max(15, remainingWidth / radios.length); // Mínimo de 15mm por rádio
      
      // Preparar dados para a tabela
      const tableData: CellInput[][] = [];
      const tableHeaders: TableHeader[] = [
        { content: 'Pos', width: posWidth },
        { content: 'Título', width: titleWidth },
        { content: 'Artista', width: artistWidth }
      ];
      
      // Adicionar cabeçalhos das rádios
      radios.forEach(radio => {
        tableHeaders.push({
          content: getRadioAbbreviation(radio.label),
          width: radioWidth,
          tooltip: radio.label
        });
      });
      
      // Adicionar Spotify e Total
      if (includeSpotify) {
        tableHeaders.push({ content: 'Spotify', width: spotifyWidth });
      }
      tableHeaders.push({ content: 'Total', width: totalWidth });
      
      // Adicionar linhas de dados
      reportData.slice(0, parseInt(chartSize.value)).forEach((item, index) => {
        const row: CellInput[] = [
          `${getPosition(index, item)}º`,
          item.title,
          item.artist
        ];
        
        // Adicionar execuções por rádio
        radios.forEach(radio => {
          row.push(item.executions[radio.value] || '0');
        });
        
        // Adicionar Spotify e Total
        if (includeSpotify) {
          row.push(item.spotify ? 
            `${item.spotify.popularity}${item.spotify.trend === 'up' ? '↑' : item.spotify.trend === 'down' ? '↓' : '-'}` : 
            '-'
          );
        }
        row.push(item.total.toString());
        
        tableData.push(row);
      });
      
      // Configurar estilos da tabela
      const styles: AutoTableStyles = {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        cellWidth: 'wrap'
      };
      
      // Configurar cabeçalho da tabela
      const headerStyles = {
        fillColor: [240, 240, 240] as [number, number, number],
        textColor: [50, 50, 50] as [number, number, number],
        fontStyle: 'bold' as const
      };
      
      // Adicionar legenda das rádios
      const legendY = margin + 20;
      doc.setFontSize(8);
      doc.text('Legenda:', margin, legendY);
      
      let currentX = margin + 20;
      let currentY = legendY;
      const legendSpacing = 30;
      
      radios.forEach(radio => {
        const legendText = `${getRadioAbbreviation(radio.label)} - ${radio.label}`;
        
        // Verificar se precisa quebrar linha na legenda
        if (currentX + legendSpacing > pageWidth - margin) {
          currentX = margin + 20;
          currentY += 5;
        }
        
        doc.text(legendText, currentX, currentY);
        currentX += legendSpacing;
      });
      
      // Configurar a tabela
      const tableConfig: AutoTableConfig = {
        startY: currentY + 10,
        head: [tableHeaders.map(h => h.content)],
        body: tableData,
        styles,
        headStyles: headerStyles,
        columnStyles: tableHeaders.reduce((acc, header, index) => {
          acc[index] = { cellWidth: header.width };
          return acc;
        }, {} as { [key: number]: { cellWidth: number } }),
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          // Adicionar rodapé
          const footerY = pageHeight - 5;
          doc.setFontSize(8);
          doc.text(`Gerado em ${moment().format('DD/MM/YYYY HH:mm')}`, margin, footerY);
          doc.text(`Página ${data.pageNumber}`, pageWidth - margin, footerY, { align: 'right' });
        }
      };
      
      // Gerar a tabela
      autoTable(doc, tableConfig);
      
      // Salvar o PDF
      doc.save(`relatorio_${moment().format('YYYYMMDD_HHmm')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      // toast.error('Erro ao gerar o relatório em PDF');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div></div>
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
      
      <Stepper
        steps={wizardSteps}
        currentStep={currentStep - 1}
        className="mb-8"
      />

      <div className="min-h-[200px]">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>

      <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Voltar
        </button>

        {currentStep < 3 && (
          <button
            onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
            className="px-4 py-2 rounded-lg bg-navy-600 text-white hover:bg-navy-700 disabled:opacity-50"
          >
            Próximo
          </button>
        )}

        {currentStep === 3 && (
          <button
            onClick={handleGenerateReport}
            disabled={loading || loadingSpotify}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading || loadingSpotify ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileDown className="w-5 h-5" />
            )}
            Gerar Relatório
          </button>
        )}
      </div>

      {reportData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {chartSize.label}
            </h2>
            {/* Mobile: cards responsivos */}
            <div className="sm:hidden space-y-3">
              {reportData.slice(0, parseInt(chartSize.value)).map((item, index) => {
                const radiosList = selectedReportType === 'radios' ? selectedRadios : locationRadios;
                const executionsByRadio = radiosList.map((r) => ({
                  key: r.value,
                  label: getRadioAbbreviation(r.label),
                  value: item.executions && item.executions[r.value] !== undefined ? item.executions[r.value] : 0,
                }));
                const isExpandable = executionsByRadio.length > 6;
                const isExpanded = !!expandedCards[index];
                const visible = isExpanded ? executionsByRadio : executionsByRadio.slice(0, 6);

                return (
                  <div key={`${item.title}-${item.artist}-${index}`} className="border rounded-md bg-white dark:bg-gray-800">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{getPosition(index, item)}º lugar</div>
                          <div className="text-sm font-medium truncate" title={item.title}>{item.title}</div>
                          <div className="text-xs text-muted-foreground truncate" title={item.artist}>{item.artist}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="text-base font-semibold">{item.total}</div>
                        </div>
                      </div>

                      {includeSpotify && (
                        <div className="mt-3">
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
                            <span className="text-xs text-muted-foreground">Spotify: -</span>
                          )}
                        </div>
                      )}

                      <div className="mt-3">
                        <div className="text-xs font-medium mb-1">Execuções por rádio</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {visible.map((r) => (
                            <div key={`${r.key}`} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{r.label}</span>
                              <span className="text-sm font-medium">{r.value}</span>
                            </div>
                          ))}
                        </div>
                        {isExpandable && (
                          <button
                            type="button"
                            aria-label={isExpanded ? 'Mostrar menos rádios' : 'Mostrar mais rádios'}
                            onClick={() => setExpandedCards((prev) => ({ ...prev, [index]: !prev[index] }))}
                            className="mt-2 text-xs text-primary hover:underline"
                          >
                            {isExpanded ? 'Mostrar menos' : `Mostrar todos (${executionsByRadio.length})`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Desktop/Tablet: tabela completa com sticky columns */}
            <div className="relative hidden sm:block">
              <div className="overflow-x-auto mb-3 pb-0" 
                   style={{ 
                     maxWidth: '100%',
                     overflowY: 'hidden'
                   }}
                   onScroll={(e) => {
                     const target = e.target as HTMLElement;
                     const mainTable = target.nextElementSibling as HTMLElement;
                     if (mainTable) {
                       mainTable.scrollLeft = target.scrollLeft;
                     }
                   }}>
                <div style={{ 
                  height: '1px', 
                  width: (selectedReportType === 'radios' ? selectedRadios : locationRadios).length > 5 ? 
                    `${(selectedReportType === 'radios' ? selectedRadios : locationRadios).length * 60 + 
                      (includeSpotify ? 96 : 0) +
                      500
                    }px` : 
                    '100%' 
                }}></div>
              </div>
              
              <div className="overflow-x-auto"
                   onScroll={(e) => {
                     const target = e.target as HTMLElement;
                     const topScrollbar = target.previousElementSibling as HTMLElement;
                     if (topScrollbar) {
                       topScrollbar.scrollLeft = target.scrollLeft;
                     }
                   }}>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-200 w-12 sticky left-0 z-10 bg-gray-50 dark:bg-gray-700">Pos</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 w-40 sticky left-12 z-10 bg-gray-50 dark:bg-gray-700">Título</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 w-40 sticky left-52 z-10 bg-gray-50 dark:bg-gray-700">Artista</th>
                      {(selectedReportType === 'radios' ? selectedRadios : locationRadios).map((radio) => (
                        <th 
                          key={radio.value} 
                          className="px-2 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-200 w-14 whitespace-nowrap"
                          title={radio.label}
                        >
                          {getRadioAbbreviation(radio.label)}
                        </th>
                      ))}
                      {includeSpotify && (
                        <th className="px-3 py-3 text-center text-sm font-medium text-white bg-green-600 dark:bg-green-800 w-24 sticky right-16 z-10">
                          <div className="flex items-center justify-center gap-1 group relative">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                            </svg>
                            <span className="whitespace-nowrap">Spotify</span>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-green-700 text-white text-xs rounded p-1 w-40 mb-1 z-10 text-center whitespace-normal">
                              Índice de popularidade de 0-100, com tendência de alta ou baixa
                            </div>
                          </div>
                        </th>
                      )}
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-200 w-16 sticky right-0 z-10 bg-gray-50 dark:bg-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.slice(0, parseInt(chartSize.value)).map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-2 py-3 text-sm text-gray-700 dark:text-gray-200 text-center sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700">{getPosition(index, item)}º</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs sticky left-12 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
                          <div className="truncate" title={item.title}>{item.title}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs sticky left-52 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
                          <div className="truncate" title={item.artist}>{item.artist}</div>
                        </td>
                        {(selectedReportType === 'radios' ? selectedRadios : locationRadios).map((radio) => (
                          <td key={radio.value} className="px-2 py-3 text-sm text-gray-700 dark:text-gray-200 text-center">
                            {item.executions && item.executions[radio.value] !== undefined ? item.executions[radio.value] : 0}
                          </td>
                        ))}
                        {includeSpotify && (
                          <td className="px-2 py-3 text-center text-sm bg-green-50 dark:bg-green-900/20 sticky right-16 z-10">
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
                        <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white text-center sticky right-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {planId === 'ADMIN' && apiResponse && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-4">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Dados da API (Debug - Admin)</h3>
            <p className="text-sm text-yellow-600 dark:text-yellow-300">Esta seção só aparece para administradores.</p>
          </div>
          <div className="p-4 overflow-auto max-h-96">
            <pre className="text-xs text-gray-800 dark:text-gray-200">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatoriosWizard;
