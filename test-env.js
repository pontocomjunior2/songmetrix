    // test-env.js
    import dotenv from 'dotenv';

    console.log('--- Iniciando test-env.js ---');

    // Tenta carregar o .env da raiz
    const result = dotenv.config();

    if (result.error) {
      console.error('[ERRO ao carregar .env]', result.error);
    } else {
      console.log('[SUCESSO ao carregar .env]', result.parsed ? 'Valores encontrados.' : 'Nenhum valor encontrado ou arquivo vazio.');
    }

    console.log('--- Valores em process.env ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('ASAAS_API_URL:', process.env.ASAAS_API_URL);
    console.log('ASAAS_API_KEY:', process.env.ASAAS_API_KEY); // Apenas o nome da chave, sem o valor
    console.log('Tem ASAAS_API_KEY?', process.env.ASAAS_API_KEY ? 'Sim' : 'Não'); // Verifica se a chave existe
    console.log('--- Fim test-env.js ---');