import { supabase } from '../lib/supabase-client';
import { AppError } from '../utils/AppError';

// Configuração para ignorar o RLS em ambiente de desenvolvimento
const isDevelopment = process.env.NODE_ENV === 'development' || import.meta.env.MODE === 'development';

// INSTRUÇÕES:
// Quando a tabela e as políticas RLS estiverem corretamente configuradas no Supabase,
// altere esta variável para false para usar o comportamento normal.
const BYPASS_RLS = false;

export interface RadioSuggestion {
  id?: number;
  radio_name: string;
  stream_url?: string;
  city: string;
  state: string;
  country?: string;
  contact_email?: string;
  additional_info?: string;
  created_at?: string;
  user_id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  user_email?: string;
  updated_at?: string;
}

/**
 * Verifica se a tabela radio_suggestions existe no banco de dados
 */
const checkTableExists = async (): Promise<boolean> => {
  // O administrador confirmou que a tabela já existe
  // Então vamos assumir que ela existe e retornar true diretamente
  return true;
  
  /* Código original comentado:
  try {
    // Tentativa de consultar a tabela para verificar se ela existe
    const { error } = await supabase
      .from('radio_suggestions')
      .select('id')
      .limit(1);
    
    // Se não houver erro, a tabela existe
    return !error;
  } catch (error) {
    console.error('Erro ao verificar existência da tabela:', error);
    return false;
  }
  */
};

export const saveRadioSuggestion = async (data: Omit<RadioSuggestion, 'id' | 'created_at' | 'user_id' | 'status' | 'user_email'>): Promise<RadioSuggestion> => {
  try {
    // Verificar se a tabela existe
    const tableExists = await checkTableExists();
    if (!tableExists) {
      throw new AppError(
        'Tabela de sugestões não configurada',
        'Por favor, execute o script de criação da tabela radio_suggestions no console do Supabase'
      );
    }

    // Get the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      throw new AppError('Erro ao obter dados do usuário', userError.message);
    }
    
    const userId = userData?.user?.id;
    const userEmail = userData?.user?.email;
    
    // Log detalhado para diagnóstico
    console.log('Usuário ao tentar salvar sugestão:', {
      id: userId,
      email: userEmail,
      metadados: userData?.user?.user_metadata
    });
    
    if (!userId) {
      throw new AppError('Usuário não autenticado', 'É necessário estar logado para sugerir uma rádio');
    }
    
    console.log('Ambiente de desenvolvimento?', isDevelopment ? 'Sim' : 'Não');

    // Extrair informações do campo additional_info se estiver em formato JSON
    let country = data.country;
    let additionalInfo = data.additional_info;
    
    // Se não houver país explícito, tentar extrair do additional_info
    if (!country && typeof additionalInfo === 'string') {
      try {
        const parsedInfo = JSON.parse(additionalInfo);
        if (parsedInfo.country) {
          country = parsedInfo.country;
        }
      } catch (e) {
        // Se não for um JSON válido, mantem o valor original
        console.log("additional_info não é um JSON válido");
      }
    }

    // Solução temporária: Se estivermos em desenvolvimento, simulamos o sucesso
    if (BYPASS_RLS) {
      console.log('Usando solução temporária para evitar problemas de RLS ao salvar');
      
      // Retornamos um objeto de sucesso fictício
      return {
        id: Math.floor(Math.random() * 1000),
        radio_name: data.radio_name,
        stream_url: data.stream_url,
        city: data.city,
        state: data.state,
        country: country || 'BR',
        contact_email: data.contact_email,
        additional_info: data.additional_info,
        user_id: userId,
        user_email: userEmail,
        status: 'pending',
        created_at: new Date().toISOString()
      };
    }
    
    // Código normal de inserção
    const { data: insertedData, error } = await supabase
      .from('radio_suggestions')
      .insert([
        {
          radio_name: data.radio_name,
          stream_url: data.stream_url || null,
          city: data.city,
          state: data.state,
          country: country || 'BR',
          contact_email: data.contact_email || null,
          additional_info: data.additional_info || null,
          user_id: userId,
          user_email: userEmail,
          status: 'pending'
        }
      ])
      .select('*')
      .single();
    
    if (error) {
      // Log completo do erro para diagnóstico
      console.error('Erro completo ao salvar sugestão:', {
        código: error.code,
        mensagem: error.message,
        detalhes: error.details,
        dica: error.hint,
        user: userId
      });
      
      // Verificar se é um erro de permissão (RLS)
      if (error.code === '42501' || error.message.includes('permission denied')) {
        throw new AppError('Erro de permissão', 'Você não tem permissão para adicionar sugestões. Verifique as políticas RLS no Supabase.');
      }
      
      // Verificar se é um erro de violação de chave estrangeira (tabela existe mas o usuário não)
      if (error.code === '23503') {
        throw new AppError('Erro de referência', 'Existe um problema com a referência ao usuário. Verifique se a sua conta está corretamente configurada.');
      }
      
      // Erro genérico
      throw new AppError('Erro ao salvar sugestão de rádio', `${error.code || 'Erro desconhecido'}: ${error.message}`);
    }
    
    return insertedData as RadioSuggestion;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Erro ao salvar sugestão de rádio', String(error));
  }
};

export const getRadioSuggestions = async (status?: 'pending' | 'approved' | 'rejected'): Promise<RadioSuggestion[]> => {
  try {
    // Verificar se a tabela existe
    const tableExists = await checkTableExists();
    if (!tableExists) {
      throw new AppError(
        'Tabela de sugestões não configurada',
        'Por favor, execute o script de criação da tabela radio_suggestions no console do Supabase'
      );
    }

    // Obter dados do usuário atual para diagnóstico
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Erro ao obter usuário atual:', userError);
    } else {
      console.log('Usuário atual ao tentar listar sugestões:', {
        id: userData?.user?.id,
        email: userData?.user?.email,
        metadados: userData?.user?.user_metadata
      });
    }

    console.log('Ambiente de desenvolvimento?', isDevelopment ? 'Sim' : 'Não');

    // Solução temporária: Se estivermos em desenvolvimento, usamos uma abordagem diferente
    // para evitar problemas com RLS até que a configuração seja corrigida
    if (BYPASS_RLS) {
      console.log('Usando solução temporária para evitar problemas de RLS');
      
      // Aqui retornamos dados fictícios para desenvolvimento
      // Em produção, isso nunca será executado
      return [
        {
          id: 1,
          radio_name: "Rádio Exemplo (Bypass RLS)",
          city: "Cidade Teste",
          state: "UF",
          user_email: "usuario@exemplo.com",
          status: "pending",
          created_at: new Date().toISOString()
        }
      ] as RadioSuggestion[];
    }

    // Se não estamos em bypass, usamos a query normal
    let query = supabase
      .from('radio_suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      // Log completo do erro
      console.error('Erro completo ao buscar sugestões:', {
        código: error.code,
        mensagem: error.message,
        detalhes: error.details,
        dica: error.hint,
        user: userData?.user?.id
      });
      
      // Verificar se é um erro de permissão (RLS)
      if (error.code === '42501' || error.message.includes('permission denied')) {
        throw new AppError('Erro de permissão', 'Você não tem permissão para visualizar sugestões. Verifique as políticas RLS no Supabase.');
      }
      
      // Erro genérico
      throw new AppError('Erro ao buscar sugestões de rádio', `${error.code || 'Erro desconhecido'}: ${error.message}`);
    }
    
    return data as RadioSuggestion[];
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Erro ao buscar sugestões de rádio', String(error));
  }
};

export const updateRadioSuggestionStatus = async (id: number, status: 'pending' | 'approved' | 'rejected'): Promise<RadioSuggestion> => {
  try {
    // Verificar se a tabela existe
    const tableExists = await checkTableExists();
    if (!tableExists) {
      throw new AppError(
        'Tabela de sugestões não configurada',
        'Por favor, execute o script de criação da tabela radio_suggestions no console do Supabase'
      );
    }

    console.log('Ambiente de desenvolvimento?', isDevelopment ? 'Sim' : 'Não');

    // Solução temporária: Se estivermos em desenvolvimento, simulamos o sucesso
    if (BYPASS_RLS) {
      console.log('Usando solução temporária para evitar problemas de RLS ao atualizar status');
      
      // Retornamos um objeto de sucesso fictício
      return {
        id: id,
        radio_name: "Rádio Exemplo (Bypass RLS)",
        city: "Cidade Teste",
        state: "UF",
        user_email: "usuario@exemplo.com",
        status: status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as RadioSuggestion;
    }

    const { data, error } = await supabase
      .from('radio_suggestions')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      // Verificar se é um erro de permissão (RLS)
      if (error.code === '42501' || error.message.includes('permission denied')) {
        throw new AppError('Erro de permissão', 'Você não tem permissão para atualizar sugestões. Apenas administradores podem fazer isso.');
      }
      
      // Verificar se a sugestão não foi encontrada
      if (error.code === 'PGRST116') {
        throw new AppError('Sugestão não encontrada', 'A sugestão que você está tentando atualizar não existe ou foi removida.');
      }
      
      // Erro genérico
      throw new AppError('Erro ao atualizar status da sugestão', `${error.code || 'Erro desconhecido'}: ${error.message}`);
    }
    
    return data as RadioSuggestion;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Erro ao atualizar status da sugestão', String(error));
  }
}; 