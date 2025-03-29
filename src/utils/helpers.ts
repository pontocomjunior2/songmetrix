import dayjs from 'dayjs';

/**
 * Arquivo de funções auxiliares para o projeto
 */

/**
 * Formata uma data no formato YYYY-MM-DD para DD/MM/YYYY
 * @param date Data no formato YYYY-MM-DD
 * @returns Data formatada DD/MM/YYYY
 */
export const formatDateString = (date: string): string => {
  if (!date) return '';
  
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/**
 * Formata uma data para o formato SQL (YYYY-MM-DD)
 * @param date Data no formato Date ou string
 * @returns Data formatada YYYY-MM-DD
 */
export const formatDateSQL = (date: Date | string): string => {
  if (!date) return '';
  
  return dayjs(date).format('YYYY-MM-DD');
};

/**
 * Formata uma data para o formato de exibição local (DD/MM/YYYY)
 * @param date Data no formato Date ou string
 * @returns Data formatada DD/MM/YYYY
 */
export const formatDateToDisplay = (date: Date | string): string => {
  if (!date) return '';
  
  return dayjs(date).format('DD/MM/YYYY');
};

/**
 * Formata um valor numérico para exibição com separadores de milhar
 * @param value Valor numérico
 * @param decimals Número de casas decimais
 * @returns Valor formatado
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  if (value === null || value === undefined) return '0';
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Calcula a variação percentual entre dois valores
 * @param current Valor atual
 * @param previous Valor anterior
 * @returns Variação percentual
 */
export const calculatePercentChange = (current: number, previous: number): number => {
  if (!previous || previous === 0) return 0;
  
  return ((current - previous) / previous) * 100;
};

/**
 * Formata uma variação percentual para exibição
 * @param value Valor percentual
 * @returns String formatada com + ou - e símbolo %
 */
export const formatPercentChange = (value: number): string => {
  if (value === 0) return '0%';
  
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

/**
 * Retorna a data atual subtraída de um número de dias
 * @param days Número de dias a subtrair
 * @returns Data resultante
 */
export const getDateMinusDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * Obtém o primeiro dia do mês atual
 * @returns Primeiro dia do mês atual
 */
export const getFirstDayOfMonth = (): Date => {
  const date = new Date();
  date.setDate(1);
  return date;
};

/**
 * Verifica se uma string é vazia ou nula
 * @param str String a ser verificada
 * @returns true se a string for vazia ou nula
 */
export const isEmpty = (str: string | null | undefined): boolean => {
  return !str || str.trim() === '';
};

/**
 * Trunca uma string se ela exceder o tamanho máximo
 * @param str String a ser truncada
 * @param maxLength Tamanho máximo
 * @returns String truncada com reticências se necessário
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  
  return str.substring(0, maxLength) + '...';
};

/**
 * Formata o valor monetário para exibição
 * @param value Valor a ser formatado
 * @returns Valor formatado com prefixo R$
 */
export const formatMoney = (value: number): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Converte uma string de data em um objeto Date
 * @param dateString String de data no formato YYYY-MM-DD ou DD/MM/YYYY
 * @returns Objeto Date
 */
export const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  // Verificar formato da data (YYYY-MM-DD ou DD/MM/YYYY)
  const isISOFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  const isBRFormat = /^\d{2}\/\d{2}\/\d{4}$/.test(dateString);
  
  if (isISOFormat) {
    // Formato ISO (YYYY-MM-DD)
    return new Date(dateString);
  } else if (isBRFormat) {
    // Formato brasileiro (DD/MM/YYYY)
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  } else {
    // Tentar converter diretamente ou retornar data atual
    const parsedDate = new Date(dateString);
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }
};

/**
 * Formata um objeto Date para exibição (DD/MM/YYYY)
 * @param date Objeto Date a ser formatado
 * @returns String no formato DD/MM/YYYY
 */
export const formatDateDisplay = (date: Date): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return dayjs().format('DD/MM/YYYY');
  }
  
  return dayjs(date).format('DD/MM/YYYY');
};

/**
 * Converte uma string de data do formato SQL para exibição
 * @param dateString String no formato YYYY-MM-DD
 * @returns String no formato DD/MM/YYYY
 */
export const sqlToDisplayDate = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = parseDate(dateString);
  return formatDateDisplay(date);
};

/**
 * Formata um timestamp para exibição em formato amigável
 * @param timestamp Data em formato ISO ou timestamp
 * @returns String formatada (ex: "há 5 minutos", "ontem", etc)
 */
export const formatRelativeTime = (timestamp: string | Date): string => {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'agora mesmo';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else if (diffInSeconds < 172800) {
      return 'ontem';
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
    } else {
      return formatDateDisplay(date);
    }
  } catch (error) {
    console.error('Erro ao formatar timestamp relativo:', error);
    return 'data inválida';
  }
}; 