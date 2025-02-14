export interface RankingItem {
  id: number;
  artist: string;
  song_title: string;
  genre: string;
  executions: number;
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
