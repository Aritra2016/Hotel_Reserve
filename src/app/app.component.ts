import { Component, ElementRef, HostListener, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { BookingService } from './core/services/booking.service';
import { RouteTrackerService } from './core/services/route-tracker.service';
import { User } from './core/models/user.model';
import { BookingConfirmation } from './core/models/booking.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  // Mobile responsive slide-over drawer state
  isMobileMenuOpen = false;

  // Desktop user profile dropdown toggle state
  isUserMenuOpen = false;

  // Authentication modal dialog open state
  isAuthModalOpen = false;

  // Active tab inside authentication modal ('login' or 'signup')
  authModalTab: 'login' | 'signup' = 'login';

  // My Trips modal dialog open state
  isTripsModalOpen = false;

  // Observable stream of current authenticated user profile
  currentUser$!: Observable<User | null>;

  // Observable stream tracking login status boolean
  isLoggedIn$!: Observable<boolean>;

  // Observable stream of confirmed bookings
  bookings$!: Observable<BookingConfirmation[]>;

  // Subject emitting on component teardown for unsubscriptions
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    public authService: AuthService,
    public bookingService: BookingService,
    public routeTracker: RouteTrackerService,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    // Pipe router navigation events to auto-close menus on page transition
    this.router.events
      .pipe(
        // Filter: Listen only for NavigationEnd lifecycle events
        filter((event) => event instanceof NavigationEnd),
        // TakeUntil: Auto-unsubscribe when component destroys
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Close mobile navigation drawer on route change
        this.isMobileMenuOpen = false;

        // Close user dropdown menu on route change
        this.isUserMenuOpen = false;

        // Trigger change detection update
        this.cdr.markForCheck();
      });
  }

  // LifeCycle Hook: ngOnInit initializes user and booking observable streams
  ngOnInit(): void {
    // Assign current user observable from AuthService
    this.currentUser$ = this.authService.currentUser$;

    // Assign login state observable from AuthService
    this.isLoggedIn$ = this.authService.isLoggedIn$;

    // Query bookings observable from BookingService
    this.bookings$ = this.bookingService.getUserBookings();
  }

  // LifeCycle Hook: ngAfterViewInit executes when root DOM structure is rendered
  ngAfterViewInit(): void {
    // Output diagnostics for root view initialization
    console.debug('[AppComponent] Root view and dependent child modals initialized');
  }

  // HostListener: Dismiss user menu when clicking outside dropdown boundaries
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Extract target HTML element from click event
    const target = event.target as HTMLElement;

    // Check if click occurred outside the user menu wrapper and avatar button
    if (!target?.closest('.user-menu-wrapper') && !target?.closest('.navbar__avatar')) {
      // Dismiss user dropdown menu
      this.isUserMenuOpen = false;
    }
  }

  // Method: Toggle mobile navigation menu drawer
  toggleMobileMenu(): void {
    // Invert mobile menu boolean flag
    this.isMobileMenuOpen = !this.isMobileMenuOpen;

    // Check if mobile menu is now open
    if (this.isMobileMenuOpen) {
      // Close user dropdown to prevent overlapping overlays
      this.isUserMenuOpen = false;
    }
  }

  // Method: Explicitly close mobile navigation drawer
  closeMobileMenu(): void {
    // Set mobile menu visibility to false
    this.isMobileMenuOpen = false;
  }

  // Method: Toggle desktop user dropdown menu
  toggleUserMenu(event?: MouseEvent): void {
    // Check if click event object was provided
    if (event) {
      // Stop event propagation to document click listener
      event.stopPropagation();
    }

    // Invert user dropdown menu boolean flag
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  // Method: Explicitly close desktop user dropdown menu
  closeUserMenu(): void {
    // Set user menu open state to false
    this.isUserMenuOpen = false;
  }

  // Method: Prevent document click listener from closing menu when interacting with inside
  onUserMenuClick(event: MouseEvent): void {
    // Stop click event propagation
    event.stopPropagation();
  }

  // Method: Open authentication modal dialog with designated active tab
  openAuthModal(tab: 'login' | 'signup' = 'login'): void {
    // Set designated initial tab
    this.authModalTab = tab;

    // Open authentication modal dialog
    this.isAuthModalOpen = true;

    // Close user dropdown menu
    this.isUserMenuOpen = false;

    // Close mobile drawer menu
    this.isMobileMenuOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Close authentication modal dialog
  closeAuthModal(): void {
    // Dismiss authentication modal dialog
    this.isAuthModalOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Open trips and reservations modal dialog
  openTripsModal(): void {
    // Set trips modal visibility to true
    this.isTripsModalOpen = true;

    // Close user dropdown menu
    this.isUserMenuOpen = false;

    // Close mobile drawer menu
    this.isMobileMenuOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Close trips and reservations modal dialog
  closeTripsModal(): void {
    // Dismiss trips modal dialog
    this.isTripsModalOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Switch authenticated session to a 1-click demo user profile
  onDemoLogin(role: 'guest' | 'host' | 'vip'): void {
    // Check if role matches valid demo profile option
    if (role === 'guest' || role === 'host' || role === 'vip') {
      // setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Call AuthService loginAsDemo method
        this.authService.loginAsDemo(role).subscribe({
          next: (user: User) => {
            // Check if returned user profile has valid id
            if (user && user?.id) {
              // Close user dropdown menu
              this.closeUserMenu();

              // Close mobile drawer menu
              this.closeMobileMenu();

              // Log successful demo login switch
              console.debug('[AppComponent] Switched to demo user:', user.name);
            } else {
              // Log warning when user object is incomplete
              console.warn('[AppComponent] No user profile returned from demo login');
            }

            // Trigger view change detection
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Log demo login failure error
            console.error('[AppComponent] Demo login error:', err);
          },
        });
      }, 150);
    } else {
      // Log warning for unsupported demo role
      console.warn('[AppComponent] Invalid demo role provided:', role);
    }
  }

  // Method: Log out current user and clear authenticated session
  onLogout(): void {
    // Check if user is currently authenticated
    if (this.authService.isAuthenticated) {
      // setTimeout for asynchronous logout transition
      setTimeout(() => {
        // Call AuthService logout method
        this.authService.logout();

        // Close user dropdown menu
        this.closeUserMenu();

        // Trigger view change detection
        this.cdr.markForCheck();
      }, 150);
    } else {
      // Close user dropdown menu if already unauthenticated
      this.closeUserMenu();
    }
  }

  // LifeCycle Hook: ngOnDestroy completes subject stream to prevent memory leaks
  ngOnDestroy(): void {
    // Emit notification to cancel all active takeUntil subscriptions
    this.destroy$.next();

    // Complete subject stream
    this.destroy$.complete();
  }
}
