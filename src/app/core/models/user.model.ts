export type UserRole = 'guest' | 'host' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  joinedDate: string;
  isSuperhost?: boolean;
  bio?: string;
  savedHotels: string[];
  tripsCount?: number;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  rememberMe?: boolean;
}

export interface SignupData {
  name: string;
  email: string;
  password?: string;
  phone?: string;
}

export interface PhoneLoginData {
  phone: string;
  otp: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message?: string;
}
