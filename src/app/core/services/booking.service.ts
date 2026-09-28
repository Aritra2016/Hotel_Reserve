import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { BookingConfirmation, BookingRequest } from '../models/booking.model';

// Service: Manages reservations, simulates payment processing, and persists booking history
@Injectable({ providedIn: 'root' })
export class BookingService {
  // Concept: Storage key for confirmed bookings in localStorage
  private readonly BOOKINGS_STORAGE_KEY = 'stayease_bookings';

  // Concept: RxJS BehaviorSubject holding list of confirmed reservations
  private bookingsSubject = new BehaviorSubject<BookingConfirmation[]>(this.loadBookingsFromStorage());

  // Concept: Public Observable stream of bookings
  public bookings$: Observable<BookingConfirmation[]> = this.bookingsSubject.asObservable();

  // Method: Load saved bookings from browser localStorage
  private loadBookingsFromStorage(): BookingConfirmation[] {
    try {
      const data = localStorage.getItem(this.BOOKINGS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Concept: Array.isArray verification
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch (err: unknown) {
      // Concept: instanceof check for error inspection
      if (err instanceof Error) {
        console.warn('[BookingService] Failed to load bookings:', err.message);
      }
      return [];
    }
  }

  // Method: Save bookings array to localStorage
  private saveToStorage(bookings: BookingConfirmation[]): void {
    try {
      localStorage.setItem(this.BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error('[BookingService] Failed to save bookings:', e.message);
      }
    }
  }

  // Method: Create and confirm a new hotel reservation with generated confirmation ID
  createBooking(request: BookingRequest): Observable<BookingConfirmation> {
    // Concept: Generate human-friendly reference ID (e.g. SE-849201)
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const bookingId = `SE-${randomNum}`;

    const confirmation: BookingConfirmation = {
      bookingId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      request,
    };

    // Concept: Update local BehaviorSubject stream and localStorage
    const current = this.bookingsSubject.getValue();
    const updated = [confirmation, ...current];
    this.bookingsSubject.next(updated);
    this.saveToStorage(updated);

    // Concept: Debugging log for confirmed booking
    console.debug(`[BookingService] Successfully confirmed booking ${bookingId} for hotel: ${request.hotelName}`);

    // Concept: RxJS Observable stream with simulated payment processing delay
    return of(confirmation).pipe(
      delay(600),
      tap(res => console.log('[BookingService] Booking receipt generated:', res.bookingId))
    );
  }

  // Method: Get all user reservations
  getUserBookings(): Observable<BookingConfirmation[]> {
    return this.bookings$;
  }

  // Method: Get a single booking by reference ID
  getBookingById(bookingId: string): Observable<BookingConfirmation | undefined> {
    const found = this.bookingsSubject.getValue().find(b => b.bookingId === bookingId);
    return of(found).pipe(delay(200));
  }
}
