import React, { useCallback } from 'react';

const RealTime: React.FC = () => {
  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching executions: Radios: ${selectedRadios.join(', ')}, Date: ${selectedDate}, Time: ${selectedTime}`);

      // Construir a URL com os parâmetros
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '1000', // Ou outro limite desejado
        start_date: formattedDate, // Usar a data formatada
        end_date: formattedDate,   // Usar a data formatada
        start_time: '00:00:00',    // Início do dia
        end_time: selectedTime,    // Até a hora selecionada
      });

      // Adicionar rádios selecionadas
      selectedRadios.forEach(radio => params.append('radio', radio));

      // Construir a URL completa
      const apiUrl = `/api/executions?${params.toString()}`;

      console.log('API URL:', apiUrl);

      // -- CORREÇÃO: MUDAR PARA GET E REMOVER BODY --
      const response = await fetch(apiUrl, {
        method: 'GET', // <--- MUDANÇA AQUI
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` // Certifique-se que 'session' está disponível no escopo
        },
        // body: JSON.stringify({ ... }) // <--- REMOVER OU COMENTAR ESTA LINHA
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Invalid JSON response' })); // Tratamento caso a resposta não seja JSON
        console.error('API Error:', errorData);
        throw new Error(`Failed to fetch executions: ${response.statusText} - ${errorData?.error || 'Unknown error'}`);
      }

      const data = await response.json();
      // ... resto do código de sucesso ...
    } catch (error) {
      // ... existing code ...
    }
  }, []);

  return (
    // ... rest of the component code ...
  );
};

export default RealTime; 