export interface RankingItem {
  id: string | number;
  artist: string;
  song_title: string;
  genre: string;
  executions: string | number;
}

export interface SpotifyTokenData {
  token: string;
  expiresAt: number;
}

export interface ArtistImages {
  [key: string]: string;
}

export interface RankingFilters {
  rankingSize: string;
  startDate: string;
  endDate: string;
  hourStart: string;
  hourEnd: string;
  selectedRadios: string[];
}

export interface RadioStatus {
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastUpdate: string;
  isFavorite: boolean;
}
