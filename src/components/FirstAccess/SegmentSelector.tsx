import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import Loading from '../Common/Loading'; // Assumindo que existe um componente Loading
import { PrimaryButton } from '../Common/Button'; // Assumindo que existe um componente Button
import { supabase } from '../../lib/supabase-client'; // Importar supabase

interface SegmentSelectorProps {
  onSave: (selectedSegments: string[]) => Promise<void>; // Espera uma Promise para lidar com async
  initialSelection?: string[]; // Opcional: para pré-selecionar
}

export default function SegmentSelector({ onSave, initialSelection = [] }: SegmentSelectorProps) {
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(initialSelection);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Busca os segmentos da API
  useEffect(() => {
    const fetchSegments = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Obter a sessão atual do Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error(sessionError?.message || "Sessão não encontrada. Faça login novamente.");
        }

        // 🔥 SOLUÇÃO TEMPORÁRIA: Usar segmentos hardcoded enquanto API não funciona
        console.log('[SegmentSelector] ⚠️ API /api/segments não encontrada, usando segmentos hardcoded');

        // Segmentos padrão mais comuns no Brasil
        const defaultSegments = [
          'POP', 'ROCK', 'SERTANEJO', 'FUNK', 'GOSPEL',
          'MPB', 'RAP', 'ELETRÔNICA', 'CLASSICAL', 'JAZZ',
          'REGGAE', 'SAMBA', 'AXÉ', 'FORRÓ', 'PAGODE'
        ];

        // Verificar se API existe e funciona
        let data: string[] = [];
        try {
          const response = await fetch('/api/segments', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.log('[SegmentSelector] ℹ️ API não funcionou, usando dados padrão');
            data = defaultSegments;
          } else {
            data = await response.json();
            console.log('[SegmentSelector] ✅ API funcionou, usando dados dinâmicos');
          }
        } catch (apiError) {
          console.log('[SegmentSelector] ⚠️ Error na API, usando dados padrão:', apiError);
          data = defaultSegments;
        }

        setAvailableSegments(data);
      } catch (err: any) {
        console.error("Erro ao buscar segmentos:", err);
        setError(err.message || "Não foi possível carregar os formatos disponíveis. Tente recarregar a página.");
        toast.error(err.message || "Falha ao buscar formatos.");
      } finally {
        setLoading(false);
      }
    };

    fetchSegments();
  }, []); // Executa apenas na montagem

  // Lida com a seleção/desseleção de um card
  const handleToggleSegment = useCallback((segment: string) => {
    setSelectedSegments(prevSelected =>
      prevSelected.includes(segment)
        ? prevSelected.filter(s => s !== segment)
        : [...prevSelected, segment]
    );
  }, []);

  // Lida com o clique no botão Salvar
  const handleSaveClick = async () => {
    if (selectedSegments.length === 0) {
      toast.info("Selecione pelo menos um formato de rádio para continuar.");
      return;
    }

    setSaving(true);
    try {
      await onSave(selectedSegments);
      // O redirecionamento ou mensagem de sucesso será tratado no componente pai (FirstAccessRoute)
    } catch (err) {
      // Erro já tratado e exibido no componente pai
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center p-10"><Loading /></div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-10">{error}</div>;
  }

  if (availableSegments.length === 0) {
     return <div className="text-center text-gray-500 p-10">Nenhum formato de rádio encontrado. Contacte o administrador.</div>;
  }

  return (
    <div className="w-full">
      {/* Indicador de progresso */}
      <div className="mb-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {selectedSegments.length === 0
            ? "Selecione pelo menos um formato para continuar"
            : `${selectedSegments.length} formato(s) selecionado(s)`
          }
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((selectedSegments.length / 1) * 100, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Grid responsivo para os cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
        {availableSegments.map(segment => {
          const isSelected = selectedSegments.includes(segment);
          return (
            <div
              key={segment}
              onClick={() => handleToggleSegment(segment)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200 ease-in-out
                flex items-center justify-center text-center aspect-square
                ${isSelected
                  ? 'bg-blue-600 border-blue-700 text-white shadow-md transform scale-105'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:shadow'
                }
              `}
            >
              <span className="font-medium text-sm">{segment}</span>
            </div>
          );
        })}
      </div>

      <div className="text-center space-y-3">
        <PrimaryButton
          onClick={handleSaveClick}
          disabled={saving || selectedSegments.length === 0}
          className="w-full sm:w-auto"
        >
          {saving ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Salvando...
            </div>
          ) : (
            'Salvar Preferências'
          )}
        </PrimaryButton>

        {/* Botão de emergência */}
        <div className="pt-2">
          <button
            onClick={() => {
              console.log('[SegmentSelector] Emergency navigation to dashboard');
              window.location.href = '/dashboard';
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Pular e ir para o Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
