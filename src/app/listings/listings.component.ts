import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil, finalize, tap } from 'rxjs/operators';
import {
  Hotel,
  Category,
  FilterCriteria,
  PaginatedResult,
  SortOption,
} from '../core/models/hotel.model';
import { HotelService } from '../core/services/hotel.service';

// Component: Main controller for the Listings and Search Results view
@Component({
  selector: 'app-listings',
  templateUrl: './listings.component.html',
  styleUrls: ['./listings.component.css'],
})
export class ListingsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Concept: FormGroup for reactive search refinement
  refineSearchForm!: FormGroup;

  // Concept: Compact Search Refinement Form two-way binding properties
  searchLocation: string = '';
  searchCheckIn: string = '';
  searchCheckOut: string = '';
  searchGuests: number = 1;

  // Concept: Filter criteria model state
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

  // Concept: Paginated response result holding items and counters
  result: PaginatedResult<Hotel> | null = null;
  hotels: Hotel[] = [];
  categories: Category[] = [];
  isLoading = true;

  // Concept: View display mode ('grid' | 'list' | 'map')
  viewMode: 'grid' | 'list' | 'map' = 'grid';

  // Concept: Boolean UI toggle for sliding mobile drawer
  isFilterDrawerOpen = false;

  // Concept: Selected hotel for the Quick View modal dialog
  selectedHotelForQuickView: Hotel | null = null;

  // Concept: Map pin hover and selection state variables
  hoveredHotelId: number | null = null;
  selectedHotelId: number | null = null;

  // Concept: Search refinement dropdown open/close state
  isSearchDropdownOpen = false;

  // Concept: Numeric min/max boundary values for price sliders
  minPriceBound = 50;
  maxPriceBound = 1200;

  // Concept: RxJS Subject for memory-leak free unsubscription
  private destroy$ = new Subject<void>();

  // Concept: Dependency injection of Router, ActivatedRoute, FormBuilder, and HotelService
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private hotelService: HotelService
  ) {}

  // LifeCycle Hook: ngOnInit runs on component initialization
  ngOnInit(): void {
    // Concept: Initialize reactive FormBuilder group with FormControls and FormArray
    this.buildRefineForm();

    // Concept: Retrieve categories from hotel service
    this.categories = this.hotelService.categories;

    // Concept: Determine min/max price range from dataset
    const priceRange = this.hotelService.getPriceRange();
    this.minPriceBound = priceRange.min;
    this.maxPriceBound = priceRange.max;

    // Concept: RxJS Observable stream listening to route query parameters
    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$),
        tap(params => console.debug('[ListingsComponent] Received queryParams:', params))
      )
      .subscribe(params => {
        // Concept: Method call to parse and bind parameters to filters
        this.parseQueryParams(params);
        // Concept: Fetch matching hotel listings
        this.fetchListings();
      });
  }

  // LifeCycle Hook: ngAfterViewInit executes after component view has been fully initialized
  ngAfterViewInit(): void {
    // Concept: Debugging log confirming view initialization
    console.debug('[ListingsComponent] View initialized successfully');

    // Concept: setTimeout demonstration to execute code in the next browser macrotask
    setTimeout(() => {
      // Concept: Optional chaining (?.) to log loaded results
      if (this.result?.items) {
        console.log(`[ListingsComponent] Initial listings count: ${this.result.items.length}`);
      }
    }, 100);
  }

  // Method: Initialize reactive FormGroup with FormControls and FormArray
  private buildRefineForm(): void {
    this.refineSearchForm = this.fb.group({
      location: new FormControl(''),
      checkIn: new FormControl(''),
      checkOut: new FormControl(''),
      guests: new FormControl(1, [Validators.min(1)]),
      // Concept: FormArray for dynamically selectable quick amenities
      quickAmenities: this.fb.array([
        new FormControl(false),
        new FormControl(false),
        new FormControl(false),
      ]),
    });
  }

  // Concept: Getter accessing FormArray controls
  get quickAmenitiesFormArray(): FormArray {
    return this.refineSearchForm.get('quickAmenities') as FormArray;
  }

  // Method: Parse raw URL query params into typed FilterCriteria using Array.isArray, map, and filter
  private parseQueryParams(params: any): void {
    // Concept: Array.isArray check to ensure amenities is handled as an array
    const amenities: string[] = Array.isArray(params['amenities'])
      ? params['amenities']
      : params['amenities']
      ? [params['amenities']]
      : [];

    // Concept: Mapping parameter values into typed filter structure
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

    // Concept: Update local template properties
    this.searchLocation = this.filters.location || '';
    this.searchCheckIn = this.filters.checkIn || '';
    this.searchCheckOut = this.filters.checkOut || '';
    this.searchGuests = this.filters.guests || 1;

    // Concept: Patching reactive form values with optional chaining (?.)
    this.refineSearchForm.patchValue({
      location: this.filters.location,
      checkIn: this.filters.checkIn,
      checkOut: this.filters.checkOut,
      guests: this.filters.guests,
    });
  }

  // Method: RxJS Subscribe pipeline querying hotel service for paginated results
  fetchListings(): void {
    this.isLoading = true;
    // Concept: RxJS Observable subscription with pipe, takeUntil, and finalize operators
    this.hotelService
      .searchHotels(this.filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: (res: PaginatedResult<Hotel>) => {
          this.result = res;
          this.hotels = res.items;

          // Concept: Array.forEach() to inspect loaded hotels during debugging
          this.hotels.forEach(h => {
            console.debug(`[ListingItem] id: ${h.id}, name: ${h?.name}, price: $${h?.price}`);
          });
        },
        error: (err: unknown) => {
          // Concept: instanceof check for Error handling
          if (err instanceof Error) {
            console.error('[ListingsComponent] Error fetching listings:', err.message);
          }
        },
      });
  }

  // Method: Compute nights between checkIn and checkOut dates using Date instanceof and arithmetic
  get calculatedNights(): number {
    // Concept: Optional chaining (?.) to check checkIn and checkOut strings
    if (!this.filters?.checkIn || !this.filters?.checkOut) return 1;

    const start = new Date(this.filters.checkIn);
    const end = new Date(this.filters.checkOut);

    // Concept: instanceof check validating date objects
    if (start instanceof Date && end instanceof Date && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 1;
    }
    return 1;
  }

  // Method: Calculate total active filter count for badge display
  get activeFilterCount(): number {
    let count = 0;
    if (this.filters?.category && this.filters.category !== 'all') count++;
    if (this.filters?.minPrice !== null || this.filters?.maxPrice !== null) count++;
    if (this.filters?.minRating !== null) count++;
    // Concept: Array.isArray check on amenities
    if (Array.isArray(this.filters?.amenities) && this.filters.amenities.length > 0) {
      count += this.filters.amenities.length;
    }
    if (this.filters?.superhostOnly) count++;
    if (this.filters?.freeCancellationOnly) count++;
    if (this.filters?.instantBookOnly) count++;
    return count;
  }

  // Method: Handle category selection and update router query parameters
  onSelectCategory(catValue: string): void {
    this.updateQueryParam({ category: catValue, page: 1 });
  }

  // Method: Handle sort selection change
  onSortChange(sortBy: SortOption): void {
    this.updateQueryParam({ sortBy, page: 1 });
  }

  // Method: Switch display mode between grid, list, and split interactive map
  setViewMode(mode: 'grid' | 'list' | 'map'): void {
    this.viewMode = mode;
    this.filters.pageSize = mode === 'map' ? 12 : 9;
    this.fetchListings();
  }

  // Method: Receive updated filters from child filter component and sync to URL
  onFiltersChanged(updatedFilters: FilterCriteria): void {
    this.updateQueryParam({
      category: updatedFilters?.category || 'all',
      minPrice: updatedFilters?.minPrice ?? null,
      maxPrice: updatedFilters?.maxPrice ?? null,
      minRating: updatedFilters?.minRating ?? null,
      amenities: Array.isArray(updatedFilters?.amenities) && updatedFilters.amenities.length > 0
        ? updatedFilters.amenities
        : null,
      superhostOnly: updatedFilters?.superhostOnly ? 'true' : null,
      freeCancellationOnly: updatedFilters?.freeCancellationOnly ? 'true' : null,
      instantBookOnly: updatedFilters?.instantBookOnly ? 'true' : null,
      page: 1,
    });
  }

  // Method: Submit refine search form values
  onRefineSearch(): void {
    this.isSearchDropdownOpen = false;

    this.updateQueryParam({
      location: this.searchLocation ? this.searchLocation.trim() : null,
      checkIn: this.searchCheckIn || null,
      checkOut: this.searchCheckOut || null,
      guests: this.searchGuests && this.searchGuests > 1 ? this.searchGuests : null,
      page: 1,
    });
  }

  // Method: Remove a specific individual filter chip
  removeFilter(filterKey: string, value?: string): void {
    if (filterKey === 'category') {
      this.updateQueryParam({ category: 'all', page: 1 });
    } else if (filterKey === 'price') {
      this.updateQueryParam({ minPrice: null, maxPrice: null, page: 1 });
    } else if (filterKey === 'rating') {
      this.updateQueryParam({ minRating: null, page: 1 });
    } else if (filterKey === 'amenity' && value) {
      // Concept: Array.filter() to remove unselected amenity
      const remaining = (this.filters.amenities || []).filter(a => a !== value);
      this.updateQueryParam({
        amenities: remaining.length > 0 ? remaining : null,
        page: 1,
      });
    } else if (filterKey === 'superhost') {
      this.updateQueryParam({ superhostOnly: null, page: 1 });
    } else if (filterKey === 'cancellation') {
      this.updateQueryParam({ freeCancellationOnly: null, page: 1 });
    } else if (filterKey === 'instant') {
      this.updateQueryParam({ instantBookOnly: null, page: 1 });
    }
  }

  // Method: Reset all filters while preserving core search parameters
  resetAllFilters(): void {
    this.router.navigate(['/listings'], {
      queryParams: {
        location: this.filters?.location || null,
        checkIn: this.filters?.checkIn || null,
        checkOut: this.filters?.checkOut || null,
        guests: this.filters?.guests && this.filters.guests > 1 ? this.filters.guests : null,
      },
    });
  }

  // Method: Navigate to selected page number with smooth scroll
  goToPage(pageNum: number): void {
    if (pageNum < 1 || (this.result && pageNum > this.result.totalPages)) return;
    this.updateQueryParam({ page: pageNum });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Method: Merge and push query parameters to the Angular router
  private updateQueryParam(newParams: any): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams,
      queryParamsHandling: 'merge',
    });
  }

  // Method: Open the Quick View modal dialog for a selected hotel
  openQuickView(hotel: Hotel): void {
    this.selectedHotelForQuickView = hotel;
  }

  // Method: Close the Quick View modal dialog
  closeQuickView(): void {
    this.selectedHotelForQuickView = null;
  }

  // Method: Navigate to hotel details route
  navigateToListing(hotelId: number): void {
    this.router.navigate(['/listings', hotelId]);
  }

  // Method: Sync hovered hotel ID with map pin marker
  onHotelHover(hotelId: number | null): void {
    this.hoveredHotelId = hotelId;
  }

  // Method: Select map marker on user click
  onMapMarkerClick(hotel: Hotel): void {
    this.selectedHotelId = hotel?.id ?? null;
  }

  // Method: Toggle mobile filter drawer
  toggleFilterDrawer(): void {
    this.isFilterDrawerOpen = !this.isFilterDrawerOpen;
  }

  // Method: Toggle compact search dropdown modal
  toggleSearchDropdown(): void {
    this.isSearchDropdownOpen = !this.isSearchDropdownOpen;
  }

  // Method: TrackBy optimization function for *ngFor directives
  trackByHotel(_: number, item: Hotel): number {
    return item?.id;
  }

  // LifeCycle Hook: ngOnDestroy triggers cleanup to prevent memory leaks
  ngOnDestroy(): void {
    // Concept: Emitting next() and complete() on destroy$ Subject
    this.destroy$.next();
    this.destroy$.complete();
    // Concept: Debugging log for component destruction
    console.debug('[ListingsComponent] Destroyed and unsubscribed successfully');
  }
}
