export interface Radio {
  id: string;
  name: string;
  location: string;
  isOnline: boolean;
  isFavorite: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  plays: number;
  rank?: number;
}

export interface Artist {
  id: string;
  name: string;
  plays: number;
}

export interface Genre {
  name: string;
  percentage: number;
}

export interface Notification {
  id: string;
  message: string;
  date: string;
  read: boolean;
}