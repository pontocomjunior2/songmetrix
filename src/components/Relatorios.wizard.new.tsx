import React, { useState } from 'react';
import Select from 'react-select';
import { FileDown, MapPin, Radio, ChevronRight, Loader2 } from 'lucide-react';

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
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  const renderStepIndicator = () => (
    <>
      {/* Desktop Steps */}
      <div className="hidden sm:flex items-center">
        <div className={`flex items-center ${currentStep >= 1 ? 'text-navy-600' : 'text-gray-400 dark:text-gray-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-navy-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            1
          </div>
          <span className="ml-2">Tipo de Relatório</span>
        </div>
        <ChevronRight className="mx-4 h-5 w-5 text-gray-400 dark:text-gray-500" />
        <div className={`flex items-center ${currentStep >= 2 ? 'text-navy-600' : 'text-gray-400 dark:text-gray-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-navy-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            2
          </div>
          <span className="ml-2">Configurações</span>
        </div>
        <ChevronRight className="mx-4 h-5 w-5 text-gray-400 dark:text-gray-500" />
        <div className={`flex items-center ${currentStep >= 3 ? 'text-navy-600' : 'text-gray-400 dark:text-gray-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-navy-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            3
          </div>
          <span className="ml-2">Resultados</span>
        </div>
      </div>

      {/* Mobile Steps */}
      <div className="sm:hidden flex justify-center">
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${currentStep >= 1 ? 'bg-navy-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
          <div className={`h-2 w-2 rounded-full ${currentStep >= 2 ? 'bg-navy-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
          <div className={`h-2 w-2 rounded-full ${currentStep >= 3 ? 'bg-navy-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
        </div>
      </div>
    </>
  );

  const renderStep1 = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {reportTypes.map((type) => (
        <button
          key={type.id}
          onClick={() => {
            setSelectedReportType(type.id);
            setCurrentStep(2);
          }}
          className={`p-4 sm:p-6 rounded-lg border-2 transition-all ${
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
          {reportGenerated && (
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors">
              <FileDown className="w-4 h-4" />
              Baixar PDF
            </button>
          )}
        </div>
        <div className="mt-6">{renderStepIndicator()}</div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        {currentStep === 1 && renderStep1()}

        {/* Navigation */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Voltar
            </button>
          )}
          {currentStep < 3 && (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="w-full sm:w-auto px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
            >
              Próximo
            </button>
          )}
          {currentStep === 3 && (
            <button
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors disabled:bg-navy-400"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando...
                </>
              ) : (
                'Gerar Relatório'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelatoriosWizard;
