export interface SpotifyTokenData {
  token: string;
  expiresAt: number;
}

export interface SpotifyFilters {
  timeRange: string;
  limit: string;
  country: string;
  playlistId: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumCover: string;
  popularity: number;
  duration_ms: number;
  explicit: boolean;
  preview_url: string | null;
  external_url: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: number;
  images: string[];
  external_url: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  owner: string;
  images: string[];
  tracks_total: number;
  external_url: string;
}

export interface SpotifyCategory {
  id: string;
  name: string;
  icons: string[];
}

export interface SpotifyFeaturedPlaylists {
  message: string;
  playlists: SpotifyPlaylist[];
}

export interface SpotifyCountry {
  code: string;
  name: string;
} 