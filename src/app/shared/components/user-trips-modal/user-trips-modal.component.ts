import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { BookingConfirmation } from '../../../core/models/booking.model';
import { User } from '../../../core/models/user.model';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-user-trips-modal',
  templateUrl: './user-trips-modal.component.html',
  styleUrls: ['./user-trips-modal.component.css'],
})
export class UserTripsModalComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // Input: Flag determining whether the trips modal dialog backdrop is visible
  @Input() isOpen = false;

  // Output: Emits when the user requests closing the trips modal
  @Output() close = new EventEmitter<void>();

  // Output: Emits the booking ID when a reservation is successfully cancelled
  @Output() tripCancelled = new EventEmitter<string>();

  // Output: Emits when user clicks the explore stays navigation button
  @Output() exploreStays = new EventEmitter<void>();

  // Observable stream of user bookings for async pipe template binding
  bookings$!: Observable<BookingConfirmation[]>;

  // Observable stream of current authenticated user profile
  currentUser$!: Observable<User | null>;

  // Local in-memory array of loaded bookings for synchronous computation
  currentBookings: BookingConfirmation[] = [];

  // Tracks which booking ID is currently executing cancellation
  isCancellingId: string | null = null;

  // Map: Key-value lookup mapping payment methods to descriptive labels
  paymentMethodLabelsMap = new Map<string, string>([
    ['razorpay', 'Instant UPI & NetBanking (Razorpay)'],
    ['card', 'Credit / Debit Card Secure Gateway'],
  ]);

  // Set: Deduplicated collection of unique hotel IDs reserved by this user
  bookedHotelIdsSet = new Set<number>();

  // Set: Set tracking booking IDs that have been cancelled in current session
  cancelledBookingIdsSet = new Set<string>();

  // Subscription management handle for clean teardown
  private bookingsSub?: Subscription;

  constructor(
    private bookingService: BookingService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  // LifeCycle Hook: ngOnInit binds initial observables and registers subscriptions
  ngOnInit(): void {
    // Refresh bookings and user data streams
    this.refreshData();
  }

  // LifeCycle Hook: ngOnChanges re-queries booking list whenever parent opens the modal
  ngOnChanges(changes: SimpleChanges): void {
    // Check if isOpen property changed to true
    if (changes?.['isOpen'] && this.isOpen) {
      // Re-query bookings from service
      this.refreshData();

      // Trigger view change detection
      this.cdr.markForCheck();
    }
  }

  // LifeCycle Hook: ngAfterViewInit runs when modal DOM structure is rendered
  ngAfterViewInit(): void {
    // Output diagnostics for trips modal view
    console.debug('[UserTripsModalComponent] Trips modal view rendered into DOM');
  }

  // Method: Synchronize booking observables and populate cached Set collections
  refreshData(): void {
    // Retrieve observable stream of bookings from BookingService
    this.bookings$ = this.bookingService.getUserBookings();

    // Retrieve observable stream of current user from AuthService
    this.currentUser$ = this.authService.currentUser$;

    // Unsubscribe from any previous subscription before re-binding
    this.bookingsSub?.unsubscribe();

    // Subscribe to bookings stream to populate local collections and Sets
    this.bookingsSub = this.bookings$.subscribe({
      next: (bookings: BookingConfirmation[]) => {
        // Assign loaded bookings array
        this.currentBookings = Array.isArray(bookings) ? bookings : [];

        // Clear existing booked hotel IDs Set
        this.bookedHotelIdsSet.clear();

        // Iterate through bookings to collect distinct hotel IDs into Set
        this.currentBookings.forEach((b: BookingConfirmation) => {
          // Check if hotel numeric ID exists
          if (b?.request?.hotelId) {
            // Add hotel ID to unique set
            this.bookedHotelIdsSet.add(b.request.hotelId);
          }
        });

        // Trigger change detection for updated statistics
        this.cdr.markForCheck();
      },
    });
  }

  // Method: Calculate cumulative USD expenditure across all bookings
  get totalSpentUsd(): number {
    // Reduce: Sum up grandTotal across loaded bookings
    return this.currentBookings.reduce(
      (sum: number, b: BookingConfirmation) => sum + (b?.request?.grandTotal || 0),
      0
    );
  }

  // Method: Calculate cumulative INR expenditure across all bookings
  get totalSpentInr(): number {
    // Reduce: Sum up grandTotalInr across loaded bookings
    return this.currentBookings.reduce(
      (sum: number, b: BookingConfirmation) => sum + (b?.request?.grandTotalInr || 0),
      0
    );
  }

  // Method: Filter active confirmed bookings that have not been cancelled
  get confirmedBookingsList(): BookingConfirmation[] {
    // Filter: Exclude booking references present in cancelled set
    return this.currentBookings.filter(
      (b: BookingConfirmation) => !this.cancelledBookingIdsSet.has(b.bookingId)
    );
  }

  // Method: Cancel reservation with input validation, if-else, and setTimeout async calling
  onCancelBooking(bookingId: string): void {
    // Sanitize booking identifier string using trim
    const trimmedId = bookingId?.trim();

    // Check if trimmed booking reference exists and is non-empty
    if (trimmedId && trimmedId.length > 0) {
      // Set active cancelling ID indicator
      this.isCancellingId = trimmedId;

      // setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Call BookingService cancelBooking method
        this.bookingService.cancelBooking(trimmedId).subscribe({
          next: (success: boolean) => {
            // Check cancellation success flag
            if (success) {
              // Add cancelled booking ID to session tracking Set
              this.cancelledBookingIdsSet.add(trimmedId);

              // Output: Emit tripCancelled event with cancelled booking ID
              this.tripCancelled.emit(trimmedId);

              // Refresh trips data from service
              this.refreshData();

              // Clear active cancelling ID state
              this.isCancellingId = null;

              // Log successful cancellation
              console.debug('[UserTripsModalComponent] Booking successfully cancelled:', trimmedId);
            } else {
              // Reset active cancelling state on failure
              this.isCancellingId = null;

              // Log cancellation failure warning
              console.warn('[UserTripsModalComponent] Booking could not be cancelled:', trimmedId);
            }

            // Trigger view change detection
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Reset cancelling state
            this.isCancellingId = null;

            // Check if error is Error instance
            if (err instanceof Error) {
              // Log specific error message
              console.error('[UserTripsModalComponent] Failed to cancel booking:', err.message);
            } else {
              // Log generic error message
              console.error('[UserTripsModalComponent] Unknown cancellation error');
            }

            // Trigger view change detection
            this.cdr.markForCheck();
          },
        });
      }, 400);
    } else {
      // Log missing booking reference warning
      console.warn('[UserTripsModalComponent] Missing booking reference for cancellation');
    }
  }

  // Method: Emit close event to parent component
  onClose(): void {
    // Output: Emit close modal event
    this.close.emit();
  }

  // Method: Stop event propagation to prevent closing dialog on inner clicks
  onDialogClick(event: MouseEvent): void {
    // Stop click event propagation
    event.stopPropagation();
  }

  // Method: Navigate user to listings catalog to discover stays
  onExploreStays(): void {
    // Close modal dialog
    this.onClose();

    // Output: Emit explore stays event
    this.exploreStays.emit();

    // Navigate router to /listings page
    this.router.navigate(['/listings']);
  }

  // LifeCycle Hook: ngOnDestroy performs clean teardown and unsubscriptions
  ngOnDestroy(): void {
    // Cancel active bookings subscription
    this.bookingsSub?.unsubscribe();
  }
}
