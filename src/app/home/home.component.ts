import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize, tap } from 'rxjs/operators';

import { HomeService } from './services/home.service';
import { Hotel, Destination, Category } from '../core/models/hotel.model';

// Component: Controller for the Landing / Home page view
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  // Concept: FormGroup managing the main hero search bar inputs
  searchForm!: FormGroup;

  // Concept: Category list array
  categories: Category[] = [];
  activeCategory = 'all';

  // Concept: Model arrays for featured stays, filtered category stays, and destinations
  featuredHotels: Hotel[] = [];
  filteredHotels: Hotel[] = [];
  destinations: Destination[] = [];

  // Concept: Loading state booleans for skeleton shimmer loaders
  loadingFeatured = true;
  loadingFiltered = false;
  loadingDestinations = true;

  // Concept: UI popup visibility flags for location suggestions and guests stepper
  showLocationDropdown = false;
  showGuestDropdown = false;

  // Concept: Numeric counters for guest categories
  adultsCount = 1;
  childrenCount = 0;

  // Concept: Date boundary strings
  todayStr = '';
  minCheckOutDate = '';

  // Concept: Curated popular destination suggestions for quick selection
  popularSuggestions = [
    { city: 'Miami', country: 'USA', label: 'Miami, Florida', icon: '🏖️' },
    { city: 'Paris', country: 'France', label: 'Paris, France', icon: '🗼' },
    { city: 'Bali', country: 'Indonesia', label: 'Bali, Indonesia', icon: '🌴' },
    { city: 'New York', country: 'USA', label: 'New York, NY', icon: '🗽' },
    { city: 'Tokyo', country: 'Japan', label: 'Tokyo, Japan', icon: '⛩️' },
    { city: 'Santorini', country: 'Greece', label: 'Santorini, Greece', icon: '🏛️' },
    { city: 'Aspen', country: 'USA', label: 'Aspen, Colorado', icon: '🏔️' },
    { city: 'Dubai', country: 'UAE', label: 'Dubai, UAE', icon: '🏜️' },
  ];

  // Concept: Filtered suggestions array updated dynamically during typing
  filteredSuggestions = [...this.popularSuggestions];

  // Data Structure: Map of destination city name to Destination object for O(1) metadata lookup
  destinationsMap = new Map<string, Destination>();

  // Data Structure: Set collecting unique destination countries
  uniqueCountriesSet = new Set<string>();

  // Concept: RxJS Subject for managing component cleanup
  private destroy$ = new Subject<void>();

  // Method: Calculate total customer reviews accumulated across all featured hotels using Array.reduce()
  get totalFeaturedReviews(): number {
    // Array.reduce() aggregating review counts with optional chaining
    return this.featuredHotels.reduce((sum, h) => sum + (h?.reviewCount || 0), 0);
  }

  // Concept: Constructor injecting FormBuilder, Router, HomeService, and ChangeDetectorRef
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private homeService: HomeService,
    private cdr: ChangeDetectorRef
  ) {}

  // LifeCycle Hook: ngOnInit initializes dates, reactive form, categories, and async datasets
  ngOnInit(): void {
    // Initialize minimum date restrictions
    this.initDates();

    // Build reactive FormGroup with FormControls
    this.buildForm();

    // Retrieve categories from service
    this.categories = this.homeService.categories;

    // Load asynchronous featured hotels
    this.loadFeaturedHotels();

    // Load asynchronous popular destinations
    this.loadDestinations();

    // Debugging log for Home component initialization
    console.debug('[HomeComponent] Initialized with categories count:', this.categories.length);
  }

  // LifeCycle Hook: ngAfterViewInit executes after template has rendered
  ngAfterViewInit(): void {
    // setTimeout demonstration to log welcome status after rendering
    setTimeout(() => {
      // Log ready state
      console.log('[HomeComponent] Hero and Search bar rendered ready for interaction');
    }, 150);
  }

  // Method: Initialize date restrictions using JavaScript Date objects and instanceof check
  private initDates(): void {
    // Create new Date instance for current day
    const today = new Date();

    // Check if instance of Date and valid timestamp
    if (today instanceof Date && !isNaN(today.getTime())) {
      // Format today date to YYYY-MM-DD
      this.todayStr = today.toISOString().split('T')[0];

      // Clone today date to compute tomorrow
      const tomorrow = new Date(today);

      // Increment date by 1 day
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Set minimum checkout date
      this.minCheckOutDate = tomorrow.toISOString().split('T')[0];
    }
  }

  // Method: Build reactive FormGroup with explicit FormControls and valueChanges RxJS streams
  private buildForm(): void {
    // Instantiate FormGroup with individual FormControls
    this.searchForm = this.fb.group({
      location: new FormControl(''),
      checkIn: new FormControl(''),
      checkOut: new FormControl(''),
      guests: new FormControl(1),
    });

    // Form.get() to retrieve checkIn control
    const checkInControl = this.searchForm.get('checkIn');

    // RxJS Observable stream listening to checkIn changes to adjust checkOut bounds
    checkInControl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      // Subscribe to checkIn date value changes
      .subscribe((val: string) => {
        // Verify value exists
        if (val) {
          // Parse string to Date instance
          const checkInDate = new Date(val);

          // Check if valid Date instance
          if (checkInDate instanceof Date && !isNaN(checkInDate.getTime())) {
            // Instantiate next day Date object
            const nextDay = new Date(checkInDate);

            // Set to day after check-in
            nextDay.setDate(nextDay.getDate() + 1);

            // Format next day string
            this.minCheckOutDate = nextDay.toISOString().split('T')[0];

            // Form.get() to retrieve checkOut control value
            const currentCheckOut = this.searchForm.get('checkOut')?.value;

            // Check if current checkOut is earlier than new checkIn
            if (currentCheckOut && new Date(currentCheckOut) <= checkInDate) {
              // Patch checkOut value with new minimum date
              this.searchForm.patchValue({ checkOut: this.minCheckOutDate });
            }
          }
        }
      });

    // Form.get() to retrieve location control
    const locationControl = this.searchForm.get('location');

    // RxJS Observable stream listening to location input to filter autocomplete suggestions
    locationControl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      // Subscribe to location input text changes
      .subscribe((val: string) => {
        // Check if value is empty or only whitespace
        if (!val || val.trim().length === 0) {
          // Reset to default popular suggestions array
          this.filteredSuggestions = [...this.popularSuggestions];
        } else {
          // Clean search term with String.trim() and String.toLowerCase()
          const query = val.toLowerCase().trim();

          // Array.filter() to find matching destination items
          this.filteredSuggestions = this.popularSuggestions.filter(
            s =>
              s.city.toLowerCase().includes(query) ||
              s.country.toLowerCase().includes(query) ||
              s.label.toLowerCase().includes(query)
          );
        }
      });
  }

  // Method: RxJS Subscribe to load featured hotels from service with setTimeout asynchronous simulation
  private loadFeaturedHotels(): void {
    this.loadingFeatured = true;
    // Concept: setTimeout for asynchronous calling
    setTimeout(() => {
      this.homeService.getFeaturedHotels()
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.loadingFeatured = false;
            this.cdr.markForCheck();
          })
        )
        .subscribe({
          next: (hotels: Hotel[]) => {
            // Concept: if - else condition to handle response
            if (hotels && hotels.length > 0) {
              this.featuredHotels = hotels;
              console.debug('[HomeComponent] Featured hotels loaded successfully:', hotels.length);
            } else {
              this.featuredHotels = [];
              console.warn('[HomeComponent] No featured hotels returned by service');
            }
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Concept: if - else condition with instanceof check
            if (err instanceof Error) {
              console.error('[HomeComponent] Failed to load featured stays:', err.message);
            } else {
              console.error('[HomeComponent] Unknown error occurred while loading featured stays');
            }
          },
        });
    }, 200);
  }

  // Method: RxJS Subscribe to load popular destinations from service with setTimeout async calling
  private loadDestinations(): void {
    // Set loading indicator
    this.loadingDestinations = true;

    // Execute async calling via setTimeout
    setTimeout(() => {
      // Query popular destinations from HomeService
      this.homeService.getPopularDestinations()
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            // Reset destinations loader
            this.loadingDestinations = false;
            // Mark change detection check
            this.cdr.markForCheck();
          })
        )
        // Subscribe to destination results
        .subscribe({
          next: (destinations: Destination[]) => {
            // Check if returned destinations array has elements
            if (destinations && destinations.length > 0) {
              // Assign destinations array
              this.destinations = destinations;

              // Populate Map for O(1) city metadata lookup
              destinations.forEach(d => {
                // Set key-value pair in Map
                this.destinationsMap.set(d.city.toLowerCase(), d);

                // Add unique country into Set
                this.uniqueCountriesSet.add(d.country);
              });

              // Log success
              console.debug('[HomeComponent] Destinations loaded and indexed in Map/Set:', destinations.length);
            } else {
              // Empty destination list
              this.destinations = [];

              // Log empty warning
              console.warn('[HomeComponent] No destinations available from service');
            }
            // Trigger change detection
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Inspect error instance
            if (err instanceof Error) {
              // Log specific error message
              console.error('[HomeComponent] Failed to load destinations:', err.message);
            } else {
              // Log fallback error message
              console.error('[HomeComponent] Unknown destinations load error');
            }
          },
        });
    }, 200);
  }

  // Method: Open location suggestions dropdown and close guests dropdown
  openLocationDropdown(): void {
    // Show location dropdown
    this.showLocationDropdown = true;

    // Close guests stepper dropdown
    this.showGuestDropdown = false;
  }

  // Method: Select a location suggestion and update form control
  selectLocation(item: { city: string; label: string }): void {
    // Check if suggestion item and city exist
    if (item && item.city) {
      // Patch trimmed city name into form control
      this.searchForm.patchValue({ location: item.city.trim() });
    } else {
      // Reset location field
      this.searchForm.patchValue({ location: '' });
    }
    // Close suggestions dropdown
    this.showLocationDropdown = false;
  }

  // Method: Open guest selection stepper dropdown
  openGuestDropdown(): void {
    // Show guest dropdown
    this.showGuestDropdown = true;

    // Close location dropdown
    this.showLocationDropdown = false;
  }

  // Method: Update adult or children counter steppers and patch total guest count
  updateGuests(type: 'adults' | 'children', delta: number): void {
    // Branch on adult or child type
    if (type === 'adults') {
      // Clamp adults count between 1 and 16
      this.adultsCount = Math.max(1, Math.min(16, this.adultsCount + delta));
    } else {
      // Clamp children count between 0 and 10
      this.childrenCount = Math.max(0, Math.min(10, this.childrenCount + delta));
    }
    // Compute combined guest total
    const total = this.adultsCount + this.childrenCount;

    // Patch updated guests total to form
    this.searchForm.patchValue({ guests: total });
  }

  // Method: Generate formatted total guest label string
  get totalGuestLabel(): string {
    // Compute sum of adult and children guests
    const total = this.adultsCount + this.childrenCount;

    // Branch between singular and plural guest label
    if (total === 1) {
      // Return singular format
      return '1 guest';
    } else {
      // Return plural format
      return `${total} guests`;
    }
  }

  // Method: Select active category and filter hotels asynchronously using service method
  selectCategory(category: string): void {
    // Guard against redundant selection
    if (this.activeCategory === category) {
      // Log debug statement
      console.debug('[HomeComponent] Category already selected:', category);
      // Return early
      return;
    } else {
      // Update active category identifier
      this.activeCategory = category;

      // Set category loading state
      this.loadingFiltered = true;

      // Execute asynchronous calling with setTimeout
      setTimeout(() => {
        // Query hotels from HomeService
        this.homeService
          .getHotelsByCategory(category)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              // Reset category loading indicator
              this.loadingFiltered = false;

              // Mark view for change check
              this.cdr.markForCheck();
            })
          )
          // Subscribe to category filter results
          .subscribe({
            next: (hotels: Hotel[]) => {
              // Check if filtered hotels list has elements
              if (hotels && hotels.length > 0) {
                // Assign filtered hotels
                this.filteredHotels = hotels;
              } else {
                // Clear filtered hotels
                this.filteredHotels = [];
              }
              // Mark view for refresh
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              // Check if Error instance
              if (err instanceof Error) {
                // Log error
                console.error('[HomeComponent] Failed to filter hotels:', err.message);
              } else {
                // Log unknown error
                console.error('[HomeComponent] Unknown hotel filter error');
              }
            },
          });
      }, 150);
    }
  }

  // Method: Submit search query and navigate to /listings with query parameters
  onSearch(): void {
    // Close location dropdown
    this.showLocationDropdown = false;

    // Close guests dropdown
    this.showGuestDropdown = false;

    // Validate Reactive Form validity
    if (this.searchForm.valid) {
      // Set filtering spinner active
      this.loadingFiltered = true;

      // Simulate async dispatch latency with setTimeout
      setTimeout(() => {
        // Retrieve form controls using form.get()
        const locCtrl = this.searchForm.get('location');
        const inCtrl = this.searchForm.get('checkIn');
        const outCtrl = this.searchForm.get('checkOut');
        const gstCtrl = this.searchForm.get('guests');

        // Extract raw string values
        const rawLoc = locCtrl?.value ? String(locCtrl.value).trim() : '';
        const rawIn = inCtrl?.value ? String(inCtrl.value).trim() : '';
        const rawOut = outCtrl?.value ? String(outCtrl.value).trim() : '';
        const rawGst = gstCtrl?.value ? Number(gstCtrl.value) : 1;

        // Initialize query params accumulator object
        const queryParams: any = {};

        // Check if location string is not empty
        if (rawLoc.length > 0) {
          // Assign trimmed location query param
          queryParams.location = rawLoc;
        } else {
          // Log empty location
          console.debug('[HomeComponent] No specific location specified');
        }

        // Check if check-in date is provided
        if (rawIn.length > 0) {
          // Assign check-in query param
          queryParams.checkIn = rawIn;
        } else {
          // Log omission
          console.debug('[HomeComponent] No checkIn specified');
        }

        // Check if check-out date is provided
        if (rawOut.length > 0) {
          // Assign check-out query param
          queryParams.checkOut = rawOut;
        } else {
          // Log omission
          console.debug('[HomeComponent] No checkOut specified');
        }

        // Check if guests count is greater than 1
        if (rawGst > 1) {
          // Assign guests count param
          queryParams.guests = rawGst;
        } else {
          // Default to 1 guest
          queryParams.guests = 1;
        }

        // Turn off spinner
        this.loadingFiltered = false;

        // Log navigation details
        console.debug('[HomeComponent] Submitting search with queryParams:', queryParams);

        // Execute live HTTP search request visible in Chrome DevTools Network tab
        this.homeService.searchHotelsLive(queryParams).subscribe({
          next: (res) => {
            // Log live network search response
            console.debug('[HomeComponent:HTTP] Search response received over network:', res?.totalCount);
          },
          error: (err: unknown) => {
            // Log network error
            console.error('[HomeComponent:HTTP] Search network error:', err);
          },
        });

        // Perform Angular Router navigation to listings
        this.router.navigate(['/listings'], { queryParams });
      }, 250);
    } else {
      // Mark all form controls as touched for error rendering
      this.searchForm.markAllAsTouched();

      // Log validation warning
      console.warn('[HomeComponent] Search form is invalid');
    }
  }

  // Method: Close guest dropdown
  closeGuestDropdown(): void {
    this.showGuestDropdown = false;
  }

  // Method: Stop event propagation
  stopEventPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  // Method: Book now button click handler
  onBookNowClick(hotelId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.navigateToListing(hotelId);
  }

  // Method: Navigate to hotel details route
  navigateToListing(hotelId: number): void {
    this.router.navigate(['/listings', hotelId]);
  }

  // Method: Navigate to listings filtered by destination city
  navigateToDestination(city: string): void {
    this.router.navigate(['/listings'], { queryParams: { location: city } });
  }

  // Method: HostListener closing open dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Concept: instanceof check on EventTarget
    if (event?.target instanceof HTMLElement) {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-bar__field--location') && !target.closest('.location-dropdown')) {
        this.showLocationDropdown = false;
      }
      if (!target.closest('.search-bar__field--guests') && !target.closest('.guests-dropdown')) {
        this.showGuestDropdown = false;
      }
    }
  }

  // Method: TrackBy optimization functions for *ngFor directives
  trackByHotel(_: number, item: Hotel): number { return item?.id; }
  trackByDest(_: number, item: Destination): number { return item?.id; }
  trackByCat(_: number, item: Category): string { return item?.value; }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
