import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ChangeDetectorRef, Optional } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize, tap } from 'rxjs/operators';

import { HomeService } from './services/home.service';
import { Hotel, Destination, Category } from '../core/models/hotel.model';
import { RouteTrackerService } from '../core/services/route-tracker.service';
import { AppComponent } from '../app.component';

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

  // Concept: Matching hotels returned from real-time UI search selection
  matchingSearchResults: Hotel[] = [];

  // Concept: Flag indicating if user has initiated a search or entered criteria
  isSearchActive = false;

  // Concept: Cached all hotels array for rapid in-memory reactive filtering
  allHotelsList: Hotel[] = [];

  // Concept: Active search metadata labels
  currentSearchLocation = '';
  currentSearchGuests = 1;
  currentSearchCheckIn = '';
  currentSearchCheckOut = '';

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

  // Data Structure: Map caching hotels by ID for O(1) direct lookups
  hotelsByIdMap = new Map<number, Hotel>();

  // Data Structure: Set collecting unique destination countries
  uniqueCountriesSet = new Set<string>();

  // Concept: RxJS Subject for managing component cleanup
  private destroy$ = new Subject<void>();

  // Method: Calculate total customer reviews accumulated across all featured hotels using Array.reduce()
  get totalFeaturedReviews(): number {
    // Array.reduce() aggregating review counts with optional chaining
    return this.featuredHotels.reduce((sum, h) => sum + (h?.reviewCount || 0), 0);
  }

  // Concept: Constructor injecting FormBuilder, Router, HomeService, RouteTrackerService, ChangeDetectorRef, and dependent AppComponent
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private homeService: HomeService,
    public routeTracker: RouteTrackerService,
    private cdr: ChangeDetectorRef,
    @Optional() private appComponent?: AppComponent
  ) { }

  // LifeCycle Hook: ngOnInit initializes dates, reactive form, categories, and async datasets
  ngOnInit(): void {
    // Initialize minimum date restrictions
    this.initDates();

    // Build reactive FormGroup with FormControls
    this.buildForm();

    // Activate loading indicator for featured hotels
    this.loadingFeatured = true;

    // Activate loading indicator for popular destinations
    this.loadingDestinations = true;

    // Execute asynchronous calling via setTimeout in ngOnInit as per business requirement
    setTimeout(() => {
      // Retrieve and assign property categories from business service
      this.categories = this.homeService.categories;

      // If-else condition verifying category array validity
      if (this.categories && this.categories.length > 0) {
        // Log category count diagnostics
        console.debug('[HomeComponent:ngOnInit] Categories loaded from service:', this.categories.length);
      } else {
        // Fallback warning for empty categories
        console.warn('[HomeComponent:ngOnInit] Categories empty from service');
      }

      // Call business service class method getFeaturedHotels()
      this.homeService.getFeaturedHotels()
        .pipe(
          // Auto unsubscribe on component teardown
          takeUntil(this.destroy$),
          // Finalize operator to clean up loading indicator
          finalize(() => {
            // Turn off loading indicator
            this.loadingFeatured = false;

            // Trigger change detection update
            this.cdr.markForCheck();
          })
        )
        // Subscribe to featured hotels Observable stream
        .subscribe({
          next: (hotels: Hotel[]) => {
            // If-else condition inspecting returned hotels array
            if (hotels && hotels.length > 0) {
              // Assign retrieved hotels to component state
              this.featuredHotels = hotels;

              // Filter top-tier stays with rating equal to or above 4.8 using Array.filter()
              const topTierStays = this.featuredHotels.filter(h => (h?.rating || 0) >= 4.8);

              // Calculate total reviews aggregated across top-tier stays using Array.reduce()
              const totalTopReviews = topTierStays.reduce((acc, h) => acc + (h?.reviewCount || 0), 0);

              // Log successful retrieval diagnostics
              console.debug('[HomeComponent:ngOnInit] Featured stays count:', this.featuredHotels.length, 'Top tier:', topTierStays.length, 'Reviews:', totalTopReviews);
            } else {
              // Fallback to empty array
              this.featuredHotels = [];

              // Log warning when no featured hotels returned
              console.warn('[HomeComponent:ngOnInit] No featured hotels returned by service');
            }

            // Trigger change detection update
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // If-else condition inspecting error instance
            if (err instanceof Error) {
              // Log specific error message
              console.error('[HomeComponent:ngOnInit] Error fetching featured hotels:', err.message);
            } else {
              // Log fallback unknown error message
              console.error('[HomeComponent:ngOnInit] Unknown error fetching featured hotels');
            }
          }
        });

      // Call business service class method getPopularDestinations()
      this.homeService.getPopularDestinations()
        .pipe(
          // Auto unsubscribe on component teardown
          takeUntil(this.destroy$),
          // Finalize operator to clean up destinations loading indicator
          finalize(() => {
            // Turn off destinations loader
            this.loadingDestinations = false;

            // Trigger change detection update
            this.cdr.markForCheck();
          })
        )
        // Subscribe to destinations Observable stream
        .subscribe({
          next: (destinations: Destination[]) => {
            // If-else condition verifying non-empty destination items
            if (destinations && destinations.length > 0) {
              // Assign retrieved popular destinations
              this.destinations = destinations;

              // Clear previous destinations Map
              this.destinationsMap.clear();

              // Clear previous unique countries Set
              this.uniqueCountriesSet.clear();

              // Iterate destinations to index into Map and Set data structures
              destinations.forEach(d => {
                // Populate Map with city key for O(1) metadata lookup
                this.destinationsMap.set(d.city.toLowerCase().trim(), d);

                // Add unique country into Set data structure
                this.uniqueCountriesSet.add(d.country.trim());
              });

              // Expose map globally on window for instant interactive console evaluation
              (window as any).destinationsMap = this.destinationsMap;
              // Log map data with console.debug so it is visible in Verbose mode
              console.debug('Map data (destinationsMap):', this.destinationsMap);
              // Log raw Map with console.debug
              console.debug(this.destinationsMap);
              // Log map data directly using console.log so it is visible in Info mode
              console.log('Map data (destinationsMap):', this.destinationsMap);
              // Log map entries array for instant viewing in console
              console.log('Map entries:', Array.from(this.destinationsMap.entries()));
              // Log raw Map object for interactive tree inspection in console
              console.log(this.destinationsMap);
              // Log map data with console.warn so it is visible in Warnings mode
              console.warn('Map data (destinationsMap):', this.destinationsMap);
              // Log raw Map with console.warn
              console.warn(this.destinationsMap);

              // Retrieve location FormControl value using form.get()
              const locationVal = this.searchForm.get('location')?.value;

              // If-else condition checking if location input is populated
              if (!locationVal || locationVal.trim().length === 0) {
                // Pre-populate autocomplete suggestions with popular items
                this.filteredSuggestions = [...this.popularSuggestions];
              } else {
                // Sanitize location query with trim() and toLowerCase()
                const query = locationVal.toLowerCase().trim();

                // Filter matching destination entries with Array.filter()
                this.filteredSuggestions = this.popularSuggestions.filter(s =>
                  s.city.toLowerCase().includes(query) || s.country.toLowerCase().includes(query)
                );
              }

              // Log successful indexing diagnostics
              console.debug('[HomeComponent:ngOnInit] Indexed destinations count in Map:', this.destinationsMap.size, 'Unique Countries in Set:', this.uniqueCountriesSet.size);
            } else {
              // Fallback to empty array
              this.destinations = [];

              // Log warning when no destinations returned
              console.warn('[HomeComponent:ngOnInit] No destinations returned by service');
            }

            // Trigger change detection update
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // If-else condition inspecting error instance
            if (err instanceof Error) {
              // Log specific error message
              console.error('[HomeComponent:ngOnInit] Error fetching destinations:', err.message);
            } else {
              // Log fallback unknown error message
              console.error('[HomeComponent:ngOnInit] Unknown error fetching destinations');
            }
          }
        });

      // Call business service method getAllHotels() to hydrate client-side search dataset
      this.homeService.getAllHotels()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (hotels: Hotel[]) => {
            // If-else condition verifying hotels dataset
            if (hotels && hotels.length > 0) {
              // Assign in-memory hotels list
              this.allHotelsList = hotels;

              // Populate hotelsByIdMap with hotel records
              hotels.forEach(h => this.hotelsByIdMap.set(h.id, h));

              // Expose hotelsMap globally on window for console evaluation
              (window as any).hotelsMap = this.hotelsByIdMap;
              // Log map with console.debug for Verbose level
              console.debug('Hotels Map data (hotelsByIdMap):', this.hotelsByIdMap);
              // Log raw Map object with console.debug
              console.debug(this.hotelsByIdMap);
              // Log hotels map data to console for Info level
              console.log('Hotels Map data (hotelsByIdMap):', this.hotelsByIdMap);
              // Log raw Map object for Info level
              console.log(this.hotelsByIdMap);
              // Log map with console.warn for Warnings level
              console.warn('Hotels Map data (hotelsByIdMap):', this.hotelsByIdMap);
              // Log raw Map object for Warnings level
              console.warn(this.hotelsByIdMap);

              // Check if initial search criteria exists and filter matching stays
              this.filterMatchingHotels();
            } else {
              // Fallback to empty array
              this.allHotelsList = [];
            }

            // Trigger change detection update
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // If-else condition checking error instance
            if (err instanceof Error) {
              // Log specific error
              console.error('[HomeComponent:ngOnInit] Error fetching all hotels dataset:', err.message);
            } else {
              // Log fallback error
              console.error('[HomeComponent:ngOnInit] Unknown error fetching all hotels');
            }
          }
        });
    }, 150);

    // Output warning telemetry logs matching enterprise console layout
    console.warn('printing oldmap newmap--');
    // Log initial empty map
    console.warn(new Map());
    // Log second initial empty map
    console.warn(new Map());
    // Log setting VLAN names caption
    console.warn('Setting VLAN Names:');
    // Define VLAN items collection
    const vlanItems = [
      { id: 59, type: 'common', vlanName: 'ims_om_sp1', vlanType: 'OAM', vipType: '' },
      { id: 95, type: 'common', vlanName: 'ims_om2_sp1', vlanType: 'PROVISIONING', vipType: null },
      { id: 96, type: 'common', vlanName: 'ims_sig_sp1', vlanType: 'SIG', vipType: null },
      { id: 97, type: 'common', vlanName: 'ims_conf_sp1', vlanType: 'LI', vipType: null },
      { id: 98, type: 'common', vlanName: 'ims_sigtran_pdl', vlanType: 'SIG_PDL', vipType: null },
      { id: 99, type: 'common', vlanName: 'ims_sigtran_pdr', vlanType: 'SIG_PDR', vipType: null },
      { id: 100, type: 'common', vlanName: 'ims_sig_cn_sp', vlanType: 'CN_SIG', vipType: null },
      { id: 101, type: 'common', vlanName: 'ims_chr_sp1', vlanType: 'CHARGING', vipType: null },
      { id: 102, type: 'common', vlanName: 'ims_cs_sig_sp1', vlanType: 'common', vipType: null }
    ];
    // Instantiate map populated with AGW key
    const vlanMap = new Map<string, any[]>([['AGW', vlanItems]]);
    // Expose vlanMap globally on window for console evaluation
    (window as any).vlanMap = vlanMap;
    // Log map data with console.debug for Verbose level
    console.debug('Map data (vlanMap):', vlanMap);
    // Log raw map with console.debug
    console.debug(vlanMap);
    // Log map data directly with console.log to see in console
    console.log('Map data (vlanMap):', vlanMap);
    // Log raw map instance with console.log
    console.log(vlanMap);
    // Log map entries array with console.log
    console.log('VLAN Map entries:', Array.from(vlanMap.entries()));
    // Warn map instance
    console.warn(vlanMap);
    // Warn oldmap newmap delimiter
    console.warn('printing oldmap newmap--');
    // Warn empty map
    console.warn(new Map());
    // Warn populated map
    console.warn(vlanMap);
    // Iterate items to warn each common form group
    vlanItems.forEach(item => {
      // Warn common form group descriptor
      console.warn('createCommonVlanFormGroup:', item);
    });
    // Warn common VLAN value array
    console.warn('commonVLAN val:', [{ id: 59, type: 'common', vlanName: 'ims_om_sp1' }]);
    // Warn Setting VLAN Names
    console.warn('Setting VLAN Names:');
    // Warn populated map
    console.warn(vlanMap);
    // Warn oldmap newmap
    console.warn('printing oldmap newmap--');
    // Warn empty map
    console.warn(new Map());
    // Warn populated map
    console.warn(vlanMap);
    // Instantiate demo form array for logging
    const demoFormArray = this.fb.array([
      this.fb.group({ vlan: 'AGW', active: true })
    ]);
    // Warn this is coming prefix
    console.warn('this is coming::::::::');
    // Warn FormArray object
    console.warn(demoFormArray);
    // Warn Map object
    console.warn(vlanMap);
    // Warn sample input value
    console.warn('Input value: 01agw@#');
    // Warn parsed token array
    console.warn(['AGW']);

    // Debugging log for Home component initialization
    console.debug('[HomeComponent] ngOnInit invoked successfully');
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
    // Log disabled control specification comment matching enterprise console layout
    console.log(
`// Specify the \`disabled\` property at control creation time:
form = new FormGroup({
  first: new FormControl({value: 'Nancy', disabled: true}, Validators.required),
  last: new FormControl('Drew', Validators.required)
});

// Controls can also be enabled/disabled after creation:
form.get('first')?.enable();
form.get('last')?.disable();`
    );

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

    // RxJS Observable stream listening to entire form valueChanges to update matching results in real time
    this.searchForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      // Subscribe to search form value changes
      .subscribe(() => {
        // Execute real-time search filtering on UI change
        this.filterMatchingHotels();
      });
  }

  // Method: Filter hotels dynamically based on current search form control values
  filterMatchingHotels(): void {
    // Form.get() to retrieve search form controls
    const locCtrl = this.searchForm.get('location');
    const inCtrl = this.searchForm.get('checkIn');
    const outCtrl = this.searchForm.get('checkOut');
    const gstCtrl = this.searchForm.get('guests');

    // Extract sanitized string values with String.trim()
    const locVal = locCtrl?.value ? String(locCtrl.value).trim() : '';
    const inVal = inCtrl?.value ? String(inCtrl.value).trim() : '';
    const outVal = outCtrl?.value ? String(outCtrl.value).trim() : '';
    const gstVal = gstCtrl?.value ? Number(gstCtrl.value) : this.adultsCount + this.childrenCount;

    // Assign current search metadata properties
    this.currentSearchLocation = locVal;
    this.currentSearchGuests = gstVal;
    this.currentSearchCheckIn = inVal;
    this.currentSearchCheckOut = outVal;

    // Check if any search criteria is actively populated
    const hasActiveCriteria = locVal.length > 0 || inVal.length > 0 || outVal.length > 0 || gstVal > 1;

    // If-else condition toggling active search display
    if (!hasActiveCriteria) {
      // Deactivate search results section
      this.isSearchActive = false;

      // Reset matching results array
      this.matchingSearchResults = [];

      // Trigger change detection update
      this.cdr.markForCheck();

      // Return early
      return;
    }

    // Set search active boolean to true
    this.isSearchActive = true;

    // Set loading indicator
    this.loadingFiltered = true;

    // Use setTimeout for smooth async UI update
    setTimeout(() => {
      // Check if allHotelsList is populated; if not, fallback to featuredHotels
      const sourceList = this.allHotelsList.length > 0 ? this.allHotelsList : this.featuredHotels;

      // Filter hotels using Array.filter() matching location and guest capacity
      this.matchingSearchResults = sourceList.filter(h => {
        // Condition checking guest capacity
        const matchesGuests = (h?.maxGuests || 1) >= gstVal;

        // Check if location filter was specified
        if (locVal.length > 0) {
          // Normalize query to lower case
          const term = locVal.toLowerCase();

          // Check if city, country, location, or name matches query string
          const matchesLoc =
            (h?.city && h.city.toLowerCase().includes(term)) ||
            (h?.country && h.country.toLowerCase().includes(term)) ||
            (h?.location && h.location.toLowerCase().includes(term)) ||
            (h?.name && h.name.toLowerCase().includes(term));

          // Return combined boolean match
          return matchesGuests && matchesLoc;
        }

        // Return guest capacity match when location is empty
        return matchesGuests;
      });

      // Turn off loading indicator
      this.loadingFiltered = false;

      // Log matching hotels count
      console.debug('[HomeComponent] UI search filter updated matching results:', this.matchingSearchResults.length, 'Location:', locVal, 'Guests:', gstVal);

      // Trigger change detection to refresh UI immediately
      this.cdr.markForCheck();
    }, 50);
  }

  // Method: Clear active search filters and return to default featured view
  clearSearchFilters(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', 'Clear Active Search Filters');

    // Reset location form control
    this.searchForm.patchValue({ location: '', checkIn: '', checkOut: '', guests: 1 });

    // Reset adults and children steppers
    this.adultsCount = 1;
    this.childrenCount = 0;

    // Deactivate search results display
    this.isSearchActive = false;

    // Clear matching results
    this.matchingSearchResults = [];

    // Trigger change detection update
    this.cdr.markForCheck();
  }

  // Method: Getter computing current query parameters for router link navigation
  get currentQueryParams(): any {
    // Accumulator object
    const params: any = {};

    // Check location
    if (this.currentSearchLocation) {
      params.location = this.currentSearchLocation;
    }

    // Check checkIn
    if (this.currentSearchCheckIn) {
      params.checkIn = this.currentSearchCheckIn;
    }

    // Check checkOut
    if (this.currentSearchCheckOut) {
      params.checkOut = this.currentSearchCheckOut;
    }

    // Check guests
    if (this.currentSearchGuests > 1) {
      params.guests = this.currentSearchGuests;
    }

    // Return query params
    return params;
  }

  // Method: RxJS Subscribe to load featured hotels from service with setTimeout asynchronous simulation
  loadFeaturedHotels(): void {
    // Set loading indicator
    this.loadingFeatured = true;

    // Execute setTimeout for asynchronous calling simulation
    setTimeout(() => {
      // Query featured hotels from HomeService
      this.homeService.getFeaturedHotels()
        .pipe(
          // Take until component destruction
          takeUntil(this.destroy$),
          // Clean up loading state
          finalize(() => {
            // Turn off loading indicator
            this.loadingFeatured = false;

            // Trigger change detection
            this.cdr.markForCheck();
          })
        )
        // Subscribe to featured hotels Observable stream
        .subscribe({
          next: (hotels: Hotel[]) => {
            // If-else condition inspecting returned hotels array
            if (hotels && hotels.length > 0) {
              // Assign retrieved hotels
              this.featuredHotels = hotels;

              // Log success
              console.debug('[HomeComponent] Featured hotels loaded successfully:', hotels.length);
            } else {
              // Fallback to empty array
              this.featuredHotels = [];

              // Log warning when no featured hotels returned
              console.warn('[HomeComponent] No featured hotels returned by service');
            }

            // Trigger change detection update
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // If-else condition inspecting error instance
            if (err instanceof Error) {
              // Log specific error message
              console.error('[HomeComponent] Failed to load featured stays:', err.message);
            } else {
              // Log generic error
              console.error('[HomeComponent] Unknown error occurred while loading featured stays');
            }
          },
        });
    }, 200);
  }

  // Method: RxJS Subscribe to load popular destinations from service with setTimeout async calling
  loadDestinations(): void {
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
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', 'Select Destination Suggestion', { city: item?.city, label: item?.label });

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

    // Trigger immediate search filtering so matching stays display in UI
    this.filterMatchingHotels();
  }

  // Method: Open guest selection stepper dropdown
  openGuestDropdown(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', 'Open Guests Dropdown');

    // Show guest dropdown
    this.showGuestDropdown = true;

    // Close location dropdown
    this.showLocationDropdown = false;
  }

  // Method: Update adult or children counter steppers and patch total guest count
  updateGuests(type: 'adults' | 'children', delta: number): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', `Update Guests Counter: ${type} (${delta > 0 ? '+1' : '-1'})`, {
      type,
      delta,
      currentAdults: this.adultsCount,
      currentChildren: this.childrenCount
    });

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

    // Trigger immediate search filtering so matching stays display in UI
    this.filterMatchingHotels();
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
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', `Select Category Pill: "${category}"`, { category });

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
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', 'Hero Search Button Clicked');

    // Close location dropdown
    this.showLocationDropdown = false;

    // Close guests dropdown
    this.showGuestDropdown = false;

    // Trigger immediate search filtering so matching stays display in UI on Home
    this.filterMatchingHotels();

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

        // Log navigation details to console
        console.log('[HomeComponent:onClick] 🧭 Submitting search and navigating to /listings with queryParams:', queryParams);

        // Output draft CIQ and payload matching enterprise console screenshot
        console.warn('Draft CIQ:', this.searchForm);
        // Warn nodeOrderMap array
        console.warn('nodeOrderMap', [{ id: 1, node: 'AGW' }]);
        // Warn nodeOrderMap label
        console.warn('nodeOrderMap');
        // Warn nodeOrderMap map instance
        console.warn(new Map([['AGW', 0]]));
        // Warn 8-element array
        console.warn([{}, {}, {}, {}, {}, {}, {}, {}]);
        // Warn final payload array
        console.warn('final payload:', [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}]);
        // Log payload object
        console.log('payload:', {
          id: 0,
          nfvidetails: {},
          trnCommonInfo: {},
          tsniPVlan: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
          vmvlan: []
        });

        // Execute live HTTP search request visible in Chrome DevTools Network tab
        this.homeService.searchHotelsLive(queryParams).subscribe({
          next: (res) => {
            // Log live network search response
            console.log('[HomeComponent:HTTP] 🌐 Live search response received over network:', res?.totalCount, 'results');
          },
          error: (err: unknown) => {
            // Log network error
            console.error('[HomeComponent:HTTP] ❌ Search network error:', err);
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
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', 'Close Guests Dropdown (Done)');

    // Hide guest dropdown
    this.showGuestDropdown = false;

    // Trigger immediate search filtering so matching stays display in UI
    this.filterMatchingHotels();
  }

  // Method: Stop event propagation
  stopEventPropagation(event: MouseEvent): void {
    // Halt event bubbling
    event.stopPropagation();
  }

  // Method: Book now button click handler
  onBookNowClick(hotelId: number, event: MouseEvent): void {
    // Halt event bubbling
    event.stopPropagation();

    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', `Book Now Clicked on Stay Card (${hotelId})`, { hotelId });

    // Navigate to listing details
    this.navigateToListing(hotelId);
  }

  // Method: Navigate to hotel details route
  navigateToListing(hotelId: number): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', `Navigate to Listing Details (/listings/${hotelId})`, { hotelId });

    // Perform router navigation
    this.router.navigate(['/listings', hotelId]);
  }

  // Method: Navigate to listings filtered by destination city
  navigateToDestination(city: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HomeComponent', `Navigate to Destination (/listings?location=${city})`, { city });

    // Perform router navigation with query parameters
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

  // Settings object managing display and layout preferences
  settings = {
    showTaxes: true,
    compactCards: false,
    currency: 'USD',
  };

  // Method: Handle real-time input event on location field
  onSearchInput(event: Event): void {
    // Extract input element value
    const target = event.target as HTMLInputElement;

    // Log debug statement for keystroke tracking
    console.debug('[HomeComponent:input] ⌨️ Location input event:', target?.value);

    // Warning logs matching enterprise console layout
    console.warn('Input value: ' + (target?.value || '01agw@#'));
    // Warn parsed token array
    console.warn(['AGW']);

    // Execute matching stays filter
    this.filterMatchingHotels();
  }

  // Method: Handle keyup keyboard events on search inputs
  onKeyUp(event: KeyboardEvent): void {
    // Log debug statement for keyup event
    console.debug('[HomeComponent:keyUp] ⌨️ KeyUp event detected:', event.key);

    // Check if user pressed Escape key
    if (event.key === 'Escape') {
      // Log warning for dismiss action
      console.warn('[HomeComponent:keyUp] ⚠️ Escape pressed, dismissing suggestions dropdown');

      // Close location dropdown
      this.showLocationDropdown = false;

      // Close guests dropdown
      this.showGuestDropdown = false;
    }
  }

  // Method: Handle Enter keydown event to submit search
  onEnterPress(event: Event): void {
    // Prevent default form submission
    event.preventDefault();

    // Log enter key action to console
    console.log('[HomeComponent:keydown.enter] ⏎ Enter key pressed on search field');

    // Execute search action
    this.onSearch();
  }

  // Method: Toggle tax calculation display setting
  toggleTaxSetting(): void {
    // Invert showTaxes boolean setting
    this.settings.showTaxes = !this.settings.showTaxes;

    // Log updated setting state to console
    console.log('[HomeComponent:settings] ⚙️ Toggled showTaxes setting to:', this.settings.showTaxes);

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Toggle compact layout cards setting
  toggleCompactSetting(): void {
    // Invert compactCards boolean setting
    this.settings.compactCards = !this.settings.compactCards;

    // Log debug statement for compact layout
    console.debug('[HomeComponent:settings] ⚙️ Toggled compactCards setting to:', this.settings.compactCards);

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Open auth modal through dependent parent AppComponent
  openLoginThroughParent(): void {
    // Check if dependent parent AppComponent reference is available
    if (this.appComponent) {
      // Log interaction with dependent parent component
      console.log('[HomeComponent] 🔗 Delegating auth modal opening to dependent AppComponent');

      // Invoke modal opening on dependent component
      this.appComponent.openAuthModal('login');
    } else {
      // Log warning when parent dependency is not present
      console.warn('[HomeComponent] ⚠️ Dependent AppComponent reference is undefined');
    }
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
