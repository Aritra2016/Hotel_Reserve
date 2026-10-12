import { Component, ElementRef, HostListener, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { BookingService } from './core/services/booking.service';
import { RouteTrackerService } from './core/services/route-tracker.service';
import { User } from './core/models/user.model';
import { BookingConfirmation } from './core/models/booking.model';
import { AuthModalComponent } from './shared/components/auth-modal/auth-modal.component';
import { UserTripsModalComponent } from './shared/components/user-trips-modal/user-trips-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  // Component Dependency: ViewChild referencing dependent child AuthModalComponent
  @ViewChild(AuthModalComponent) authModalComponent?: AuthModalComponent;

  // Component Dependency: ViewChild referencing dependent child UserTripsModalComponent
  @ViewChild(UserTripsModalComponent) userTripsModalComponent?: UserTripsModalComponent;

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

  // Footer getaway category tabs matching Airbnb inspiration bar
  activeGetawayTab = 'Popular';
  getawayTabs: string[] = ['Popular', 'Arts & culture', 'Beach', 'Mountains', 'Outdoors', 'Things to do'];
  isGetawaysExpanded = false;

  // Data Structure: Map organizing getaway destination lists per category
  getawaysMap = new Map<string, Array<{ city: string; subtitle: string }>>();

  // Data Structure: Set storing unique cities across all getaway suggestions
  getawayCitiesSet = new Set<string>();

  // Selected locale and currency options
  selectedLanguage = 'English (IN)';
  selectedCurrency = '₹ INR';

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

    // Populate getaway destination Map data structures
    this.initGetawaysData();
  }

  // LifeCycle Hook: ngAfterViewInit executes when root DOM structure is rendered
  ngAfterViewInit(): void {
    // Output diagnostics for root view initialization
    console.debug('[AppComponent] Root view and dependent child modals initialized');
  }

  // HostListener: Dismiss user menu when clicking outside dropdown boundaries & log all interactive clicks
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Extract target HTML element from click event
    const target = event.target as HTMLElement;

    // Check if click occurred outside the user menu wrapper and avatar button
    if (!target?.closest('.user-menu-wrapper') && !target?.closest('.navbar__avatar')) {
      // Dismiss user dropdown menu
      this.isUserMenuOpen = false;
    }

    // Capture every interactive element click across the entire application
    const clickable = target?.closest('button, a, input, select, textarea, [data-action], [routerLink], .clickable, .tab-btn, .card, .getaway-item, .category-pill, .btn-reserve');

    // Check if clickable element was identified
    if (clickable) {
      // Extract element tag name in lowercase
      const tagName = clickable.tagName.toLowerCase();

      // Extract trimmed element label text
      const text = clickable.textContent?.trim().slice(0, 45) || '';

      // Determine action identifier from data-action or routerLink or aria-label or text
      const action = clickable.getAttribute('data-action') || clickable.getAttribute('routerLink') || clickable.getAttribute('aria-label') || text;

      // Extract current active URL
      const currentUrl = this.router?.url || (typeof window !== 'undefined' ? window.location.pathname : '/');

      // Log element click directly to browser DevTools console
      console.log(`[GlobalClickTracker @ ${currentUrl}] 🖱️ Clicked <${tagName}>: "${action}"`);
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

    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'Toggle User Profile Menu', { isOpen: !this.isUserMenuOpen });

    // Invert user dropdown menu boolean flag
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  // Method: Explicitly close desktop user dropdown menu
  closeUserMenu(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'Close User Profile Menu');

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
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', `Open Authentication Modal (${tab})`, { tab });

    // Set designated initial tab
    this.authModalTab = tab;

    // Open authentication modal dialog
    this.isAuthModalOpen = true;

    // Check if child AuthModalComponent dependency exists
    if (this.authModalComponent) {
      // Log direct interaction with dependent child component
      console.debug('[AppComponent] 🔗 Delegating auth modal presentation to dependent child AuthModalComponent');
    }

    // Close user dropdown menu
    this.isUserMenuOpen = false;

    // Close mobile drawer menu
    this.isMobileMenuOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Close authentication modal dialog
  closeAuthModal(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'Close Authentication Modal');

    // Dismiss authentication modal dialog
    this.isAuthModalOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Open trips and reservations modal dialog
  openTripsModal(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'Open My Trips & Bookings Modal');

    // Set trips modal visibility to true
    this.isTripsModalOpen = true;

    // Check if child UserTripsModalComponent dependency exists
    if (this.userTripsModalComponent) {
      // Log direct interaction with dependent child component
      console.debug('[AppComponent] 🔗 Delegating trips presentation to dependent child UserTripsModalComponent');
    }

    // Close user dropdown menu
    this.isUserMenuOpen = false;

    // Close mobile drawer menu
    this.isMobileMenuOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Close trips and reservations modal dialog
  closeTripsModal(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'Close My Trips Modal');

    // Dismiss trips modal dialog
    this.isTripsModalOpen = false;

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Switch authenticated session to a 1-click demo user profile
  onDemoLogin(role: 'guest' | 'host' | 'vip'): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', `Demo Login Switch: "${role}"`, { role });

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

              // Log successful demo login switch to console
              console.log('[AppComponent:onClick] 👤 Switched to demo user:', user.name);
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
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'User Logged Out');

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

  // Method: Initialize getaway destinations Map with rich Airbnb-like categories and cities
  private initGetawaysData(): void {
    // Populate Popular category list
    this.getawaysMap.set('Popular', [
      { city: 'Raleigh', subtitle: 'Monthly Rentals' },
      { city: 'Amsterdam', subtitle: 'Cabin rentals' },
      { city: 'Fort Lauderdale', subtitle: 'House rentals' },
      { city: 'West Palm Beach', subtitle: 'Villa rentals' },
      { city: 'St. Petersburg', subtitle: 'Holiday rentals' },
      { city: 'Philadelphia', subtitle: 'House rentals' },
      { city: 'Destin', subtitle: 'Cottage rentals' },
      { city: 'Pittsburgh', subtitle: 'House rentals' },
      { city: 'Memphis', subtitle: 'Holiday rentals' },
      { city: 'Portland', subtitle: 'Monthly Rentals' },
      { city: 'Madrid', subtitle: 'Villa rentals' },
      { city: 'Brooklyn', subtitle: 'House rentals' },
      { city: 'Broken Bow', subtitle: 'House rentals' },
      { city: 'Daytona Beach', subtitle: 'Apartment rentals' },
      { city: 'Gulf Shores', subtitle: 'Holiday rentals' },
      { city: 'Pocono Mountains', subtitle: 'Villa rentals' },
      { city: 'Milan', subtitle: 'Villa rentals' },
      { city: 'Goa', subtitle: 'Beachfront villas' },
      { city: 'Paris', subtitle: 'Apartment rentals' },
      { city: 'Kyoto', subtitle: 'Heritage stays' }
    ]);

    // Populate Arts & culture category list
    this.getawaysMap.set('Arts & culture', [
      { city: 'Florence', subtitle: 'Renaissance villas' },
      { city: 'Barcelona', subtitle: 'Gothic quarter flats' },
      { city: 'Vienna', subtitle: 'Historic apartments' },
      { city: 'Rome', subtitle: 'Colosseum view rentals' },
      { city: 'Berlin', subtitle: 'Urban lofts' },
      { city: 'Prague', subtitle: 'Old town apartments' },
      { city: 'London', subtitle: 'Townhouse rentals' },
      { city: 'New York', subtitle: 'Museum mile stays' }
    ]);

    // Populate Beach category list
    this.getawaysMap.set('Beach', [
      { city: 'Maui', subtitle: 'Oceanfront condos' },
      { city: 'Santorini', subtitle: 'Cliffside villas' },
      { city: 'Cancun', subtitle: 'All-inclusive resorts' },
      { city: 'Phuket', subtitle: 'Private pool villas' },
      { city: 'Maldives', subtitle: 'Overwater bungalows' },
      { city: 'Miami Beach', subtitle: 'Art deco apartments' },
      { city: 'Bali', subtitle: 'Luxury surf retreats' },
      { city: 'Mykonos', subtitle: 'Cycladic suites' }
    ]);

    // Populate Mountains category list
    this.getawaysMap.set('Mountains', [
      { city: 'Aspen', subtitle: 'Ski-in ski-out chalets' },
      { city: 'Zermatt', subtitle: 'Matterhorn view cabins' },
      { city: 'Banff', subtitle: 'Alpine lodges' },
      { city: 'Chamonix', subtitle: 'Mont Blanc retreats' },
      { city: 'Whistler', subtitle: 'Mountain chalets' },
      { city: 'Lake Tahoe', subtitle: 'Lakeside cabins' },
      { city: 'Manali', subtitle: 'Himalayan cottages' }
    ]);

    // Populate Outdoors category list
    this.getawaysMap.set('Outdoors', [
      { city: 'Yellowstone', subtitle: 'Rustic cabins' },
      { city: 'Grand Canyon', subtitle: 'Desert glamping' },
      { city: 'Yosemite', subtitle: 'Valley lodges' },
      { city: 'Zion', subtitle: 'Canyon retreats' },
      { city: 'Costa Rica', subtitle: 'Rainforest bungalows' },
      { city: 'Queenstown', subtitle: 'Adventure lodges' }
    ]);

    // Populate Things to do category list
    this.getawaysMap.set('Things to do', [
      { city: 'Tokyo', subtitle: 'Culinary tours & stays' },
      { city: 'Orlando', subtitle: 'Theme park villas' },
      { city: 'Las Vegas', subtitle: 'Casino strip suites' },
      { city: 'Dubai', subtitle: 'Desert safari retreats' },
      { city: 'Sydney', subtitle: 'Harbour excursions' },
      { city: 'Singapore', subtitle: 'City skyline lofts' }
    ]);

    // Iterate across all Map entries to build Set of distinct getaway cities
    this.getawaysMap.forEach(items => {
      // Loop through each destination item
      items.forEach(item => {
        // Add sanitized trimmed city to Set data structure ensuring uniqueness
        this.getawayCitiesSet.add(item.city.trim());
      });
    });
  }

  // Method: Select active getaway inspiration tab category
  onSelectGetawayTab(tab: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', `Footer Getaway Tab Selected: "${tab}"`, { tab });

    // Check if designated tab is already active
    if (this.activeGetawayTab !== tab) {
      // Update active category tab
      this.activeGetawayTab = tab;
      // Reset expansion state to compact default
      this.isGetawaysExpanded = false;
      // Trigger change detection
      this.cdr.markForCheck();
    }
  }

  // Method: Toggle expanded / collapsed state of getaway destinations grid
  toggleShowMoreGetaways(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', 'Toggle Getaways Expand/Collapse', { isExpanded: !this.isGetawaysExpanded });

    // Invert getaway expansion boolean flag
    this.isGetawaysExpanded = !this.isGetawaysExpanded;
    // Trigger change detection
    this.cdr.markForCheck();
  }

  // Method: Handle clicking a getaway destination to navigate to listings with search filter
  onSelectGetawayDestination(city: string): void {
    // Check if city parameter is invalid or empty
    if (!city || city.trim().length === 0) {
      // Log warning for invalid destination selection
      console.warn('[AppComponent] ⚠️ Attempted getaway navigation with empty city name');
      // Return early
      return;
    }

    // Clean city name with trim
    const cleanCity = city.trim();

    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', `Select Getaway Destination: "${cleanCity}" (/listings?location=${cleanCity})`, { city: cleanCity });

    // Navigate to /listings route with location query parameter
    this.router.navigate(['/listings'], {
      queryParams: { location: cleanCity }
    });
  }

  // Method: Get filtered list of destinations for currently active getaway tab
  get displayedGetaways(): Array<{ city: string; subtitle: string }> {
    // Retrieve list from Map for current category tab
    const items = this.getawaysMap.get(this.activeGetawayTab) || [];
    // Check if expansion toggle is active
    if (this.isGetawaysExpanded) {
      // Return complete destination list
      return items;
    }
    // Return first 17 items matching screenshot layout before 'Show more'
    return items.slice(0, 17);
  }

  // Method: Switch display currency option
  toggleCurrency(): void {
    // Array of available currency options
    const currencies = ['₹ INR', '$ USD', '€ EUR', '£ GBP'];
    // Find current index using Array.indexOf
    const currentIndex = currencies.indexOf(this.selectedCurrency);
    // Calculate next circular index using modulo
    const nextIndex = (currentIndex + 1) % currencies.length;
    // Update selected currency value
    this.selectedCurrency = currencies[nextIndex];
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', `Toggle Currency to: "${this.selectedCurrency}"`, { currency: this.selectedCurrency });
    // Trigger change detection
    this.cdr.markForCheck();
  }

  // Method: Switch display language option
  toggleLanguage(): void {
    // Array of supported interface languages
    const languages = ['English (IN)', 'English (US)', 'Español (ES)', 'Français (FR)', 'Deutsch (DE)'];
    // Find current language index
    const currentIndex = languages.indexOf(this.selectedLanguage);
    // Calculate next circular index
    const nextIndex = (currentIndex + 1) % languages.length;
    // Update selected language
    this.selectedLanguage = languages[nextIndex];
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent', `Toggle Language to: "${this.selectedLanguage}"`, { language: this.selectedLanguage });
    // Trigger change detection
    this.cdr.markForCheck();
  }

  // Method: Handle navigation bar clicks with explicit logging and route navigation
  onNavClick(linkName: string, routeUrl: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent:Navbar', `Navigation Link Clicked: "${linkName}" -> ${routeUrl}`, { linkName, routeUrl });
    // Perform router navigation
    this.router.navigate([routeUrl]);
  }

  // Method: Handle footer link clicks with explicit logging, route tracking, and navigation
  onFooterLinkClick(title: string, section: string, routeUrl?: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('AppComponent:Footer', `Footer Link Clicked: "${section} > ${title}"`, { section, title, routeUrl });
    // Check if target route is provided
    if (routeUrl) {
      // Navigate to target route URL
      this.router.navigate([routeUrl]);
    } else {
      // Default navigation to explore stays
      this.router.navigate(['/listings']);
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
