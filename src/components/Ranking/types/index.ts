export interface RankingFilters {
  radio: string;
  artist: string;
  song: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  rankingSize: string;
}

export interface Execution {
  id: number;
  date: string;
  time: string;
  radio_name: string;
  artist: string;
  song_title: string;
  isrc: string;
  city: string;
  state: string;
  genre: string;
  region: string;
  segment: string;
  label: string;
  executions: number;
}

export interface RadioOption {
  value: string;
  label: string;
}

export interface SpotifyTokenData {
  token: string;
  expiresAt: number;
}
