import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { User, LoginCredentials, SignupData } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly USER_STORAGE_KEY = 'stayease_auth_user';
  private readonly FAVORITES_STORAGE_KEY = 'stayease_user_favorites';

  // Demo Profiles for immediate 1-click preview and testing
  private readonly DEMO_USERS: Record<string, User> = {
    guest: {
      id: 'usr_guest_01',
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      phone: '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'guest',
      joinedDate: 'January 2023',
      bio: 'Globe trotter, architecture enthusiast, and beach lover.',
      savedHotels: ['1', '3', '7'],
      tripsCount: 4,
    },
    host: {
      id: 'usr_host_02',
      name: 'Sarah Jenkins',
      email: 'sarah.j@stayease.com',
      phone: '+91 91234 56789',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      role: 'host',
      joinedDate: 'March 2021',
      isSuperhost: true,
      bio: 'Hospitality passionate. Hosting luxury villas and designer cabins.',
      savedHotels: ['2', '5'],
      tripsCount: 12,
    },
    vip: {
      id: 'usr_vip_03',
      name: 'David Chen',
      email: 'david.vip@voyager.com',
      phone: '+91 99887 76655',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'guest',
      joinedDate: 'August 2022',
      bio: 'Executive explorer & resort connoisseur.',
      savedHotels: ['4', '6', '8'],
      tripsCount: 8,
    },
  };

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUserFromStorage());
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  public isLoggedIn$: Observable<boolean> = this.currentUser$.pipe(map(user => !!user));

  constructor() {}

  // Get current active user snapshot
  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  // Check if a user is logged in
  public get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  // Load user session from localStorage
  private loadUserFromStorage(): User | null {
    try {
      const data = localStorage.getItem(this.USER_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.warn('[AuthService] Could not parse stored user session:', err);
      return null;
    }
  }

  // Save user session to localStorage
  private saveUserToStorage(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(this.USER_STORAGE_KEY);
      }
    } catch (err) {
      console.error('[AuthService] Failed to persist user in storage:', err);
    }
  }

  // 1. Email & Password Login
  login(credentials: LoginCredentials): Observable<User> {
    const { email, password } = credentials;

    if (!email || !email.includes('@')) {
      return throwError(() => new Error('Please enter a valid email address.'));
    }
    if (!password || password.length < 4) {
      return throwError(() => new Error('Password must be at least 4 characters.'));
    }

    // Check if logging in with known demo email
    const matchDemo = Object.values(this.DEMO_USERS).find(
      u => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    const user: User = matchDemo || {
      id: `usr_${Date.now()}`,
      name: email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email: email.trim(),
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=ff385c&color=fff&size=150`,
      role: 'guest',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      savedHotels: ['1', '4'],
      tripsCount: 0,
    };

    return of(user).pipe(
      delay(600),
      tap(u => {
        this.currentUserSubject.next(u);
        this.saveUserToStorage(u);
      })
    );
  }

  // 2. Register / Sign Up
  signup(data: SignupData): Observable<User> {
    const { name, email, password, phone } = data;

    if (!name || name.trim().length < 2) {
      return throwError(() => new Error('Full name is required.'));
    }
    if (!email || !email.includes('@')) {
      return throwError(() => new Error('Valid email address is required.'));
    }
    if (!password || password.length < 6) {
      return throwError(() => new Error('Password must be at least 6 characters long.'));
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || '+91 98765 43210',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff385c&color=fff&size=150`,
      role: 'guest',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      savedHotels: [],
      tripsCount: 0,
    };

    return of(newUser).pipe(
      delay(700),
      tap(u => {
        this.currentUserSubject.next(u);
        this.saveUserToStorage(u);
      })
    );
  }

  // 3. Mobile Phone & OTP Login
  loginWithPhone(phone: string, otp: string): Observable<User> {
    if (!phone || phone.trim().length < 8) {
      return throwError(() => new Error('Please enter a valid mobile number.'));
    }
    if (otp !== '123456') {
      return throwError(() => new Error('Invalid OTP. Use demo verification code: 123456'));
    }

    const user: User = {
      id: `usr_phone_${Date.now()}`,
      name: `User ${phone.slice(-4)}`,
      email: `user.${phone.slice(-4)}@stayease.com`,
      phone: phone.trim(),
      avatar: `https://ui-avatars.com/api/?name=Guest+${phone.slice(-4)}&background=00a699&color=fff&size=150`,
      role: 'guest',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      savedHotels: ['2'],
      tripsCount: 1,
    };

    return of(user).pipe(
      delay(600),
      tap(u => {
        this.currentUserSubject.next(u);
        this.saveUserToStorage(u);
      })
    );
  }

  // Send simulated SMS OTP
  sendPhoneOtp(phone: string): Observable<{ success: boolean; demoOtp: string }> {
    if (!phone || phone.trim().length < 8) {
      return throwError(() => new Error('Please enter a valid 10-digit mobile number.'));
    }
    return of({ success: true, demoOtp: '123456' }).pipe(delay(400));
  }

  // 4. Social Single Sign-On (Google / Apple / Facebook)
  loginWithSocial(provider: 'google' | 'apple' | 'facebook'): Observable<User> {
    const providerNames: Record<string, string> = {
      google: 'Google User',
      apple: 'Apple Explorer',
      facebook: 'Social Traveler',
    };

    const user: User = {
      id: `usr_${provider}_${Date.now()}`,
      name: providerNames[provider] || 'Explorer',
      email: `${provider}.user@example.com`,
      avatar: provider === 'google'
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
      role: 'guest',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      savedHotels: ['1', '3'],
      tripsCount: 2,
    };

    return of(user).pipe(
      delay(600),
      tap(u => {
        this.currentUserSubject.next(u);
        this.saveUserToStorage(u);
      })
    );
  }

  // 5. One-Click Demo Profiles (Instant preview for testing)
  loginAsDemo(role: 'guest' | 'host' | 'vip'): Observable<User> {
    const demoUser = this.DEMO_USERS[role] || this.DEMO_USERS['guest'];
    return of(demoUser).pipe(
      delay(300),
      tap(u => {
        this.currentUserSubject.next(u);
        this.saveUserToStorage(u);
      })
    );
  }

  // 6. Logout
  logout(): void {
    this.currentUserSubject.next(null);
    this.saveUserToStorage(null);
  }

  // 7. Update Profile
  updateProfile(updates: Partial<User>): Observable<User> {
    const current = this.currentUserSubject.value;
    if (!current) {
      return throwError(() => new Error('No authenticated user session found.'));
    }

    const updatedUser: User = { ...current, ...updates };
    return of(updatedUser).pipe(
      delay(400),
      tap(u => {
        this.currentUserSubject.next(u);
        this.saveUserToStorage(u);
      })
    );
  }

  // 8. Wishlist / Favorites Toggle
  toggleFavorite(hotelId: string): Observable<string[]> {
    const current = this.currentUserSubject.value;
    if (!current) {
      return of([]);
    }

    const exists = current.savedHotels.includes(hotelId);
    const updatedHotels = exists
      ? current.savedHotels.filter(id => id !== hotelId)
      : [...current.savedHotels, hotelId];

    const updatedUser: User = { ...current, savedHotels: updatedHotels };
    this.currentUserSubject.next(updatedUser);
    this.saveUserToStorage(updatedUser);

    return of(updatedHotels);
  }

  isFavorite(hotelId: string): boolean {
    const current = this.currentUserSubject.value;
    return !!current && current.savedHotels.includes(hotelId);
  }
}
