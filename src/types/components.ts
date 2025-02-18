import { ReactNode } from 'react';

// Layout Types
export interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

// Auth Types
export type UserStatusType = 'INATIVO' | 'ATIVO' | 'ADMIN';

export interface AuthState {
  currentUser: any;
  userStatus: UserStatusType | null;
  loading: boolean;
}

export interface AuthContextType extends AuthState {
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserStatus?: (uid: string, status: UserStatusType) => Promise<void>;
}

// Common Component Types
export interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  helperText?: string;
}

// Data Types
export interface User {
  uid: string;
  email: string | null;
  photoURL?: string | null;
  displayName?: string | null;
  status: UserStatusType;
  createdAt: string;
  updatedAt?: string;
  favoriteRadios?: string[];
}

export interface Filters {
  radio: string;
  artist: string;
  song: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
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
}

export interface RankingItem {
  id: number;
  artist: string;
  song_title: string;
  genre: string;
  executions: number;
}

export interface Radio {
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastUpdate: string;
  isFavorite: boolean;
}

export interface RadioStatus {
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastUpdate: string;
  isFavorite: boolean;
}
