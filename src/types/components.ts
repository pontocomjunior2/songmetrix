import { ReactNode } from 'react';
// import { UserStatus } from '../lib/firebase'; // Remover import não utilizado

// Layout Types
export interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

// Auth Types
// export type UserStatusType = typeof UserStatus[keyof typeof UserStatus]; // Remover tipo não utilizado

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // status: UserStatusType; // Remover propriedade não utilizada
  createdAt?: string;
  updatedAt?: string;
}

// Radio Types
export interface RadioStatus {
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastUpdate: string;
  isFavorite: boolean;
  city?: string;
  state?: string;
  formato?: string;
  streamUrl?: string;
}

export interface Radio {
  name: string;
  status: 'online' | 'offline';
  lastUpdate?: string;
}

export interface FavoriteRadio {
  name: string;
  addedAt: string;
}

// Dashboard Types
export interface DashboardData {
  activeRadios: number;
  totalExecutions: number;
  topArtists: {
    name: string;
    count: number;
  }[];
  topSongs: {
    title: string;
    artist: string;
    count: number;
  }[];
}

// Execution Types
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
}

// Alert Types
export interface AlertProps {
  message: string;
  onClose?: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
}

// Button Types
export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

// Input Types
export interface InputProps {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

// Loading Types
export interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

// UserAvatar Types
export interface UserAvatarProps {
  email: string;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
