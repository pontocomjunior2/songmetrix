// fallbackData.ts
// Arquivo centralizado com dados de fallback para quando a API estiver indisponível

// Dados de fallback para o dashboard
export const dashboardFallbackData = {
  activeRadios: [
    { name: "Tropical FM - ES", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
    { name: "98 FM Curitiba - PR", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
    { name: "Alvorada FM 94,9 - MG", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
    { name: "Litoral FM - ES", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
    { name: "FM O Dia - RJ", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() }
  ],
  topSongs: [
    { title: "Erro 502 (Demo)", artist: "Servidor Offline", plays: 5 },
    { title: "Modo Offline", artist: "Dados de Fallback", plays: 4 },
    { title: "Tente Novamente", artist: "Indisponível Temporário", plays: 3 },
    { title: "Aguarde um Momento", artist: "Manutenção", plays: 2 },
    { title: "Conexão Perdida", artist: "Servidor em Pausa", plays: 1 }
  ],
  artistData: [
    { name: "Servidor Offline", executions: 5 },
    { name: "Dados de Fallback", executions: 4 },
    { name: "Indisponível Temporário", executions: 3 },
    { name: "Manutenção", executions: 2 },
    { name: "Servidor em Pausa", executions: 1 }
  ],
  genreData: [
    { name: "Pop", value: 40, color: "#3B82F6" },
    { name: "Rock", value: 30, color: "#10B981" },
    { name: "MPB", value: 15, color: "#F59E0B" },
    { name: "Sertanejo", value: 10, color: "#EF4444" },
    { name: "Eletrônica", value: 5, color: "#8B5CF6" }
  ],
  totalSongs: 500,
  songsPlayedToday: 50
};

// Dados de fallback para o status das rádios
export const radioStatusFallbackData = [
  { name: "Tropical FM - ES", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
  { name: "98 FM Curitiba - PR", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
  { name: "Alvorada FM 94,9 - MG", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
  { name: "Litoral FM - ES", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
  { name: "FM O Dia - RJ", status: "ONLINE", isFavorite: true, lastUpdate: new Date().toISOString() },
  { name: "Jovem Pan - SP", status: "ONLINE", isFavorite: false, lastUpdate: new Date().toISOString() },
  { name: "Rádio Bandeirantes - SP", status: "ONLINE", isFavorite: false, lastUpdate: new Date().toISOString() },
  { name: "Rádio CBN - SP", status: "ONLINE", isFavorite: false, lastUpdate: new Date().toISOString() }
];

// Dados de fallback para o ranking
export const rankingFallbackData = [
  { song_title: "Erro 502 (Demo)", artist: "Servidor Offline", executions: 20, radios: 5 },
  { song_title: "Modo Offline", artist: "Dados de Fallback", executions: 18, radios: 4 },
  { song_title: "Tente Novamente", artist: "Indisponível Temporário", executions: 15, radios: 3 },
  { song_title: "Aguarde um Momento", artist: "Manutenção", executions: 12, radios: 3 },
  { song_title: "Conexão Perdida", artist: "Servidor em Pausa", executions: 10, radios: 2 },
  { song_title: "Serviço em Manutenção", artist: "API Offline", executions: 8, radios: 2 },
  { song_title: "Tentando Reconectar", artist: "Rede Interrompida", executions: 6, radios: 1 },
  { song_title: "Modo de Contingência", artist: "Dados Temporários", executions: 5, radios: 1 },
  { song_title: "Cache Local", artist: "Aplicação Resiliente", executions: 4, radios: 1 },
  { song_title: "Operação Degradada", artist: "Serviço Parcial", executions: 3, radios: 1 }
]; 