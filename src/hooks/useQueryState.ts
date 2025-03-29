import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook para gerenciar estado com parâmetros de consulta na URL
 * @param key Nome do parâmetro na URL
 * @param initialValue Valor inicial caso o parâmetro não exista na URL
 * @returns [valor, função para atualizar valor]
 */
export function useQueryState<T extends string>(
  key: string,
  initialValue: T
): [T, (newValue: T) => void] {
  // Obter parâmetros de consulta da URL
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Estado local como fallback e para renderização
  const [value, setValue] = useState<T>(() => {
    const paramValue = searchParams.get(key);
    return paramValue !== null ? paramValue as T : initialValue;
  });

  // Atualizar o estado local quando os parâmetros da URL mudarem
  useEffect(() => {
    const paramValue = searchParams.get(key);
    if (paramValue !== null && paramValue !== value) {
      setValue(paramValue as T);
    }
  }, [searchParams, key, value]);

  // Função para atualizar tanto o estado local quanto a URL
  const updateValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      
      // Criar nova cópia dos parâmetros para não mutar o original
      const newParams = new URLSearchParams(searchParams);
      
      if (newValue === initialValue) {
        // Se o valor é o padrão, remover da URL para mantê-la limpa
        newParams.delete(key);
      } else {
        // Caso contrário, definir o novo valor
        newParams.set(key, newValue);
      }
      
      // Atualizar a URL
      setSearchParams(newParams);
    },
    [key, initialValue, searchParams, setSearchParams]
  );

  return [value, updateValue];
} 