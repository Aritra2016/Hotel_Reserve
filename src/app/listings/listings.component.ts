import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import {
  Hotel,
  Category,
  FilterCriteria,
  PaginatedResult,
  SortOption,
} from '../core/models/hotel.model';
import { HotelService } from '../core/services/hotel.service';
import { RouteTrackerService } from '../core/services/route-tracker.service';
import { HotelQuickViewComponent } from './components/hotel-quick-view/hotel-quick-view.component';

@Component({
  selector: 'app-listings',
  templateUrl: './listings.component.html',
  styleUrls: ['./listings.component.css'],
})
export class ListingsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Component Dependency: ViewChild referencing dependent child HotelQuickViewComponent
  @ViewChild(HotelQuickViewComponent) quickViewComponent?: HotelQuickViewComponent;

  // Settings object managing listings display and density preferences
  viewSettings = {
    density: 'standard' as 'standard' | 'compact',
    showMarketStats: true,
  };

  // Concept: Reactive FormGroup for search refinement
  refineSearchForm!: FormGroup;

  // Query & Filter State
  filters: FilterCriteria = {
    location: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
    category: 'all',
    minPrice: null,
    maxPrice: null,
    minRating: null,
    amenities: [],
    superhostOnly: false,
    freeCancellationOnly: false,
    instantBookOnly: false,
    sortBy: 'recommended',
    page: 1,
    pageSize: 9,
  };

  // Results State
  result: PaginatedResult<Hotel> | null = null;
  hotels: Hotel[] = [];
  categories: Category[] = [];
  isLoading = true;

  // View Mode: 'grid' | 'list' | 'map'
  viewMode: 'grid' | 'list' | 'map' = 'grid';

  // Mobile / Slide-in Filter Drawer
  isFilterDrawerOpen = false;

  // Quick View Modal
  selectedHotelForQuickView: Hotel | null = null;

  // Hovered and Selected Map Pins
  hoveredHotelId: number | null = null;
  selectedHotelId: number | null = null;

  // Compact Search Refinement Form state
  searchLocation = '';
  searchCheckIn = '';
  searchCheckOut = '';
  searchGuests = 1;
  isSearchDropdownOpen = false;

  // Min / Max Price Bounds from dataset
  // Min / Max Price Bounds from dataset
  minPriceBound = 50;
  maxPriceBound = 1200;

  // Data Structure: Map caching hotels by ID for O(1) pins, hover, and selection lookups
  hotelMap = new Map<number, Hotel>();

  // Data Structure: Map storing counts of available hotels per category
  categoryCountMap = new Map<string, number>();

  // Data Structure: Set containing distinct cities across current listings
  uniqueLocationsSet = new Set<string>();

  // Data Structure: Set containing all unique amenities found across loaded hotels
  availableAmenitiesSet = new Set<string>();

  // RxJS Subject for managing component cleanup
  private destroy$ = new Subject<void>();

  // Method: Calculate average price per night across matching hotels using Array.reduce()
  get averagePricePerNight(): number {
    // Check if hotels array is empty
    if (!this.hotels || this.hotels.length === 0) {
      // Return zero baseline
      return 0;
    }
    // Sum prices with Array.reduce() using optional chaining
    const totalPrice = this.hotels.reduce((acc, h) => acc + (h?.price || 0), 0);
    // Return rounded average
    return Math.round(totalPrice / this.hotels.length);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hotelService: HotelService,
    public routeTracker: RouteTrackerService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Load categories list from HotelService
    this.categories = this.hotelService.categories;

    // Retrieve global price range
    const priceRange = this.hotelService.getPriceRange();

    // Assign minimum price bound
    this.minPriceBound = priceRange.min;

    // Assign maximum price bound
    this.maxPriceBound = priceRange.max;

    // Initialize reactive search refinement FormGroup
    this.buildRefineForm();

    // Listen to query param changes via ActivatedRoute
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      // Subscribe to route parameter observable
      .subscribe(params => {
        // Parse incoming query parameters
        this.parseQueryParams(params);

        // Fetch filtered hotels from HotelService
        this.fetchListings();
      });
  }

  // Method: Build reactive search refinement FormGroup
  private buildRefineForm(): void {
    // Construct FormGroup instance with FormControls
    this.refineSearchForm = this.fb.group({
      location: new FormControl(this.searchLocation),
      checkIn: new FormControl(this.searchCheckIn),
      checkOut: new FormControl(this.searchCheckOut),
      guests: new FormControl(this.searchGuests),
    });
  }

  // LifeCycle Hook: ngAfterViewInit coordinates child view initializations
  ngAfterViewInit(): void {
    // Log view initialization status
    console.debug('[ListingsComponent] View initialized with child components');
  }

  private parseQueryParams(params: any): void {
    // Extract amenities array from params
    const amenities = params['amenities']
      ? Array.isArray(params['amenities'])
        ? params['amenities']
        : [params['amenities']]
      : [];

    // Construct filter criteria object
    this.filters = {
      location: params['location'] || '',
      checkIn: params['checkIn'] || '',
      checkOut: params['checkOut'] || '',
      guests: params['guests'] ? parseInt(params['guests'], 10) : 1,
      category: params['category'] || 'all',
      minPrice: params['minPrice'] ? parseFloat(params['minPrice']) : null,
      maxPrice: params['maxPrice'] ? parseFloat(params['maxPrice']) : null,
      minRating: params['minRating'] ? parseFloat(params['minRating']) : null,
      amenities,
      superhostOnly: params['superhostOnly'] === 'true',
      freeCancellationOnly: params['freeCancellationOnly'] === 'true',
      instantBookOnly: params['instantBookOnly'] === 'true',
      sortBy: (params['sortBy'] as SortOption) || 'recommended',
      page: params['page'] ? parseInt(params['page'], 10) : 1,
      pageSize: this.viewMode === 'map' ? 12 : 9,
    };

    // Store search location
    this.searchLocation = this.filters.location || '';

    // Store search check-in date
    this.searchCheckIn = this.filters.checkIn || '';

    // Store search check-out date
    this.searchCheckOut = this.filters.checkOut || '';

    // Store search guests count
    this.searchGuests = this.filters.guests || 1;

    // Synchronize reactive form control values
    if (this.refineSearchForm) {
      // Patch values to form without triggering circular valueChanges
      this.refineSearchForm.patchValue({
        location: this.searchLocation,
        checkIn: this.searchCheckIn,
        checkOut: this.searchCheckOut,
        guests: this.searchGuests,
      }, { emitEvent: false });
    }
  }

  // Method: Fetch listings from HotelService with setTimeout async calling and if-else branching
  fetchListings(): void {
    // Activate loading indicator
    this.isLoading = true;

    // Execute async calling simulation with setTimeout
    setTimeout(() => {
      // Calling HotelService method searchHotels
      this.hotelService.searchHotels(this.filters)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            // Turn off loading spinner
            this.isLoading = false;

            // Trigger change detection
            this.cdr.markForCheck();
          })
        )
        // Subscribe to paginated result Observable
        .subscribe({
          next: (res: PaginatedResult<Hotel>) => {
            // Validate response and items array
            if (res && Array.isArray(res.items)) {
              // Assign paginated result
              this.result = res;

              // Assign hotels array
              this.hotels = res.items;

              // Clear previous hotel Map entries
              this.hotelMap.clear();

              // Clear previous category counts Map
              this.categoryCountMap.clear();

              // Clear unique locations Set
              this.uniqueLocationsSet.clear();

              // Clear unique amenities Set
              this.availableAmenitiesSet.clear();

              // Index retrieved items into Map and Set data structures
              this.hotels.forEach(h => {
                // Populate Map by hotel ID for O(1) lookups
                this.hotelMap.set(h.id, h);

                // Add distinct city location into Set
                this.uniqueLocationsSet.add(h.city);

                // Count hotel occurrences by category in Map
                const currentCatCount = this.categoryCountMap.get(h.category) || 0;
                // Increment category count in Map
                this.categoryCountMap.set(h.category, currentCatCount + 1);

                // Add each amenity into unique amenities Set
                if (Array.isArray(h.amenities)) {
                  // Iterate over individual hotel amenities
                  h.amenities.forEach(a => this.availableAmenitiesSet.add(a));
                }
              });

              // Expose map objects globally on window for console inspection
              (window as any).hotelMap = this.hotelMap;
              (window as any).categoryCountMap = this.categoryCountMap;
              // Log map with console.debug for Verbose level
              console.debug('Map data (hotelMap):', this.hotelMap);
              console.debug(this.hotelMap);
              console.debug('Category Counts Map data:', this.categoryCountMap);
              console.debug(this.categoryCountMap);
              // Log hotelMap data with console.log to see in console
              console.log('Map data (hotelMap):', this.hotelMap);
              // Log raw Map object for tree inspection
              console.log(this.hotelMap);
              // Log categoryCountMap data with console.log
              console.log('Category Counts Map data:', this.categoryCountMap);
              // Log raw Map object
              console.log(this.categoryCountMap);

              // Log indexed stats
              console.debug(`[ListingsComponent] Fetched ${res.items.length} stays, indexed in Map & Set`);
            } else {
              // Reset hotels array
              this.hotels = [];

              // Reset result object
              this.result = null;

              // Log missing hotels warning
              console.warn('[ListingsComponent] No hotels found for criteria');
            }
            // Refresh view
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Check if Error instance
            if (err instanceof Error) {
              // Log specific error message
              console.error('[ListingsComponent] Search failed:', err.message);
            } else {
              // Log unknown error fallback
              console.error('[ListingsComponent] Unknown search error occurred');
            }
          },
        });
    }, 200);
  }

  // Calculate number of nights based on dates
  get calculatedNights(): number {
    if (!this.filters.checkIn || !this.filters.checkOut) return 1;
    const start = new Date(this.filters.checkIn);
    const end = new Date(this.filters.checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }

  // Active filter count for badge
  get activeFilterCount(): number {
    let count = 0;
    if (this.filters.category && this.filters.category !== 'all') count++;
    if (this.filters.minPrice !== null || this.filters.maxPrice !== null) count++;
    if (this.filters.minRating !== null) count++;
    if (this.filters.amenities && this.filters.amenities.length > 0)
      count += this.filters.amenities.length;
    if (this.filters.superhostOnly) count++;
    if (this.filters.freeCancellationOnly) count++;
    if (this.filters.instantBookOnly) count++;
    return count;
  }

  // Category Selection
  onSelectCategory(catValue: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Select Category Filter: "${catValue}"`, { category: catValue });
    // Update router query parameters for proper routing
    this.updateQueryParam({ category: catValue, page: 1 });
  }

  // Sorting
  onSortChange(sortBy: SortOption): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Change Sorting: "${sortBy}"`, { sortBy });
    // Update router query parameters for proper routing
    this.updateQueryParam({ sortBy, page: 1 });
  }

  // View Mode
  setViewMode(mode: 'grid' | 'list' | 'map'): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Switch View Mode: "${mode}"`, { mode });
    // Assign view mode
    this.viewMode = mode;
    // Set appropriate page size based on view
    this.filters.pageSize = mode === 'map' ? 12 : 9;
    // Fetch listings
    this.fetchListings();
  }

  // Filter component event
  onFiltersChanged(updatedFilters: FilterCriteria): void {
    this.updateQueryParam({
      category: updatedFilters.category || 'all',
      minPrice: updatedFilters.minPrice ?? null,
      maxPrice: updatedFilters.maxPrice ?? null,
      minRating: updatedFilters.minRating ?? null,
      amenities: updatedFilters.amenities && updatedFilters.amenities.length > 0
        ? updatedFilters.amenities
        : null,
      superhostOnly: updatedFilters.superhostOnly ? 'true' : null,
      freeCancellationOnly: updatedFilters.freeCancellationOnly ? 'true' : null,
      instantBookOnly: updatedFilters.instantBookOnly ? 'true' : null,
      page: 1,
    });
  }

  // Search Refinement Form Submit with Form Validation, if-else conditions, and setTimeout async calling
  onRefineSearch(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Refine Search Form Submitted', {
      location: this.refineSearchForm.get('location')?.value,
      checkIn: this.refineSearchForm.get('checkIn')?.value,
      checkOut: this.refineSearchForm.get('checkOut')?.value,
      guests: this.refineSearchForm.get('guests')?.value
    });
    // Validate Reactive Form validity
    if (this.refineSearchForm && this.refineSearchForm.valid) {
      // Close dropdown menu
      this.isSearchDropdownOpen = false;

      // Set loading indicator
      this.isLoading = true;

      // Execute simulated latency via setTimeout
      setTimeout(() => {
        // Retrieve location control with form.get()
        const locCtrl = this.refineSearchForm.get('location');
        // Retrieve checkIn control with form.get()
        const inCtrl = this.refineSearchForm.get('checkIn');
        // Retrieve checkOut control with form.get()
        const outCtrl = this.refineSearchForm.get('checkOut');
        // Retrieve guests control with form.get()
        const gstCtrl = this.refineSearchForm.get('guests');

        // Extract trimmed location string
        this.searchLocation = locCtrl?.value ? String(locCtrl.value).trim() : '';
        // Extract check-in string
        this.searchCheckIn = inCtrl?.value ? String(inCtrl.value).trim() : '';
        // Extract check-out string
        this.searchCheckOut = outCtrl?.value ? String(outCtrl.value).trim() : '';
        // Extract guest count number
        this.searchGuests = gstCtrl?.value ? Number(gstCtrl.value) : 1;

        // Build query parameters object
        const params: any = {
          location: this.searchLocation.length > 0 ? this.searchLocation : null,
          checkIn: this.searchCheckIn || null,
          checkOut: this.searchCheckOut || null,
          guests: this.searchGuests > 1 ? this.searchGuests : null,
          page: 1,
        };

        // Update URL query parameters
        this.updateQueryParam(params);
      }, 250);
    } else if (this.refineSearchForm) {
      // Mark all controls touched to show errors
      this.refineSearchForm.markAllAsTouched();

      // Log validation warning
      console.warn('[ListingsComponent] Refine search form is invalid');
    } else {
      // Dismiss dropdown
      this.isSearchDropdownOpen = false;
    }
  }

  // Quick Remove of specific active filter with if-else branching
  removeFilter(filterKey: string, value?: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Remove Filter: ${filterKey}`, { filterKey, value });
    // Check if category filter
    if (filterKey === 'category') {
      // Reset category to all
      this.updateQueryParam({ category: 'all', page: 1 });
    } else if (filterKey === 'price') {
      // Reset min and max price limits
      this.updateQueryParam({ minPrice: null, maxPrice: null, page: 1 });
    } else if (filterKey === 'rating') {
      // Reset rating threshold
      this.updateQueryParam({ minRating: null, page: 1 });
    } else if (filterKey === 'amenity' && value) {
      // Filter out selected amenity using Array.filter()
      const remaining = (this.filters.amenities || []).filter(a => a !== value);
      // Update amenities query param
      this.updateQueryParam({
        amenities: remaining.length > 0 ? remaining : null,
        page: 1,
      });
    } else if (filterKey === 'superhost') {
      // Reset superhost filter
      this.updateQueryParam({ superhostOnly: null, page: 1 });
    } else if (filterKey === 'cancellation') {
      // Reset free cancellation filter
      this.updateQueryParam({ freeCancellationOnly: null, page: 1 });
    } else if (filterKey === 'instant') {
      // Reset instant book filter
      this.updateQueryParam({ instantBookOnly: null, page: 1 });
    } else if (filterKey === 'location') {
      // Reset search location
      this.searchLocation = '';
      // Clear location query param
      this.updateQueryParam({ location: null, page: 1 });
    }
  }

  // Reset all filters to default baseline
  resetAllFilters(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Reset All Search Filters');
    // Navigate with cleared query parameters
    this.router.navigate(['/listings'], {
      queryParams: {
        location: this.filters.location || null,
        checkIn: this.filters.checkIn || null,
        checkOut: this.filters.checkOut || null,
        guests: this.filters.guests && this.filters.guests > 1 ? this.filters.guests : null,
      },
    });
  }

  // Navigate to specific pagination page
  goToPage(pageNum: number): void {
    // Guard against out of range page numbers
    if (pageNum < 1 || (this.result && pageNum > this.result.totalPages)) return;
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Navigate to Page ${pageNum}`, { page: pageNum });
    // Update page query parameter
    this.updateQueryParam({ page: pageNum });
    // Smooth scroll to top of listing view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Synchronize params to URL with Angular router
  private updateQueryParam(newParams: any): void {
    // Merge new params into active route
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams,
      queryParamsHandling: 'merge',
    });
  }

  // Open Quick View Modal for hotel
  openQuickView(hotel: Hotel): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Open Quick View Modal for Hotel ID: ${hotel?.id}`, { hotelId: hotel?.id, hotelName: hotel?.name });
    // Set active quick view hotel
    this.selectedHotelForQuickView = hotel;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Dismiss Quick View Modal
  closeQuickView(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Close Quick View Modal');
    // Clear quick view selection
    this.selectedHotelForQuickView = null;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Navigate to hotel details page
  navigateToListing(hotelId: number): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Navigate to Listing Details (/listings/${hotelId})`, { hotelId });
    // Perform router navigation
    this.router.navigate(['/listings', hotelId]);
  }

  // Map pin hover synchronization
  onHotelHover(hotelId: number | null): void {
    // Assign hovered hotel ID
    this.hoveredHotelId = hotelId;
  }

  // Map pin click handler
  onMapMarkerClick(hotel: Hotel): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', `Map Marker Clicked for Hotel ID: ${hotel?.id}`, { hotelId: hotel?.id, hotelName: hotel?.name });
    // Update selected hotel ID
    this.selectedHotelId = hotel.id;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Toggle filter drawer sliding visibility
  toggleFilterDrawer(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Toggle Filter Drawer', { isOpen: !this.isFilterDrawerOpen });
    // Invert boolean state
    this.isFilterDrawerOpen = !this.isFilterDrawerOpen;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Close filter drawer
  closeFilterDrawer(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Close Filter Drawer');
    // Set drawer flag to false
    this.isFilterDrawerOpen = false;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Toggle search dropdown modal
  toggleSearchDropdown(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Toggle Search Dropdown', { isOpen: !this.isSearchDropdownOpen });
    // Invert search dropdown state
    this.isSearchDropdownOpen = !this.isSearchDropdownOpen;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Close search dropdown modal
  closeSearchDropdown(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('ListingsComponent', 'Close Search Dropdown');
    // Dismiss dropdown
    this.isSearchDropdownOpen = false;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Stop mouse event propagation
  stopEventPropagation(event: MouseEvent): void {
    // Halt event bubbling
    event.stopPropagation();
  }

  // TrackBy optimization for hotel list
  trackByHotel(_: number, item: Hotel): number {
    // Return unique hotel ID
    return item.id;
  }

  // Method: Handle input keystrokes in search refinement
  onSearchInput(event: Event): void {
    // Extract input element value
    const target = event.target as HTMLInputElement;

    // Log debug statement for input tracking
    console.debug('[ListingsComponent:input] ⌨️ Refine destination input:', target?.value);
  }

  // Method: Handle keyup keyboard events in refinement modal
  onKeyUp(event: KeyboardEvent): void {
    // Log debug statement for keyup event
    console.debug('[ListingsComponent:keyUp] ⌨️ KeyUp detected:', event.key);

    // Check if user pressed Escape key
    if (event.key === 'Escape') {
      // Log warning for dismiss action
      console.warn('[ListingsComponent:keyUp] ⚠️ Escape pressed, dismissing search dropdown');

      // Dismiss search refinement dropdown
      this.isSearchDropdownOpen = false;
    }
  }

  // Method: Handle Enter keydown in search refinement
  onEnterPress(event: Event): void {
    // Prevent default form submission
    event.preventDefault();

    // Log enter key action to console
    console.log('[ListingsComponent:keydown.enter] ⏎ Enter pressed on refine search');

    // Execute refinement form submission
    this.onRefineSearch();
  }

  // Method: Toggle density layout setting
  toggleDensitySetting(): void {
    // Switch between standard and compact layout densities
    this.viewSettings.density = this.viewSettings.density === 'standard' ? 'compact' : 'standard';

    // Log updated setting state to console
    console.log('[ListingsComponent:settings] ⚙️ Switched density setting to:', this.viewSettings.density);

    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Toggle market overview stats table setting
  toggleMarketStatsSetting(): void {
    // Invert showMarketStats boolean setting
    this.viewSettings.showMarketStats = !this.viewSettings.showMarketStats;

    // Log debug diagnostics
    console.debug('[ListingsComponent:settings] ⚙️ Switched showMarketStats setting to:', this.viewSettings.showMarketStats);

    // Request view change detection
    this.cdr.markForCheck();
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Trigger unsubscription
    this.destroy$.next();
    // Complete subject
    this.destroy$.complete();
  }
}
