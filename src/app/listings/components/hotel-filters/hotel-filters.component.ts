import { Component, Input, Output, EventEmitter, OnInit, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, FormArray } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FilterCriteria, Category } from '../../../core/models/hotel.model';
import { HotelService } from '../../../core/services/hotel.service';

// Component: Filter sidebar and sliding drawer component for listing filtering
@Component({
  selector: 'app-hotel-filters',
  templateUrl: './hotel-filters.component.html',
  styleUrls: ['./hotel-filters.component.css'],
})
export class HotelFiltersComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // Concept: Component Input properties
  @Input() filters: FilterCriteria = {};
  @Input() minBound = 100;
  @Input() maxBound = 1000;
  @Input() isOpen = false;

  // Concept: Component Output EventEmitters
  @Output() filtersChange = new EventEmitter<FilterCriteria>();
  @Output() closeDrawer = new EventEmitter<void>();

  // Concept: Reactive FormGroup for filter management
  filterForm!: FormGroup;

  categories: Category[] = [];
  amenitiesList: string[] = [];

  // Concept: Local state variables for filtering
  localMinPrice: number = 100;
  localMaxPrice: number = 1000;
  selectedCategory = 'all';
  selectedRating: number | null = null;
  selectedAmenities: string[] = [];
  superhostOnly = false;
  freeCancellationOnly = false;
  instantBookOnly = false;

  // Concept: Available star rating filter options
  readonly ratingOptions = [
    { label: 'Any', value: null },
    { label: '4.8 ★ & up', value: 4.8 },
    { label: '4.5 ★ & up', value: 4.5 },
    { label: '4.0 ★ & up', value: 4.0 },
  ];

  // Concept: Histogram distribution bars data
  readonly histogramBars = [
    12, 28, 45, 78, 92, 110, 85, 65, 52, 40, 32, 24, 18, 14, 8, 5
  ];

  // Data Structure: Set storing selected amenities for O(1) membership operations
  selectedAmenitiesSet = new Set<string>();

  // RxJS Subject for unsubscribing from observables on destroy
  private destroy$ = new Subject<void>();

  // Method: Calculate total property volume represented by histogram using Array.reduce()
  get totalHistogramCount(): number {
    // Array.reduce() aggregating density values across all histogram buckets
    return this.histogramBars.reduce((sum, val) => sum + val, 0);
  }

  // Concept: Constructor injecting HotelService, FormBuilder, and ChangeDetectorRef
  constructor(
    private hotelService: HotelService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  // LifeCycle Hook: ngOnInit runs on component initialization
  ngOnInit(): void {
    // Initialize categories list from service
    this.categories = this.hotelService.categories;

    // Initialize amenities master list from service
    this.amenitiesList = this.hotelService.availableAmenities;

    // Build reactive FormGroup with FormControls and FormArray
    this.buildFilterForm();

    // Synchronize local state with inputs
    this.syncLocalState();

    // Debugging log for filter component initialization
    console.debug('[HotelFiltersComponent] Initialized with amenities count:', this.amenitiesList.length);
  }

  // LifeCycle Hook: ngOnChanges detects changes to @Input properties from parent ListingsComponent
  ngOnChanges(changes: SimpleChanges): void {
    // Check if any bound input property changed
    if (changes?.['filters'] || changes?.['minBound'] || changes?.['maxBound'] || changes?.['isOpen']) {
      // Synchronize local filter variables
      this.syncLocalState();

      // Trigger change detection cycle
      this.cdr.markForCheck();
    }
  }

  // LifeCycle Hook: ngAfterViewInit runs after filter view components are initialized
  ngAfterViewInit(): void {
    // Log view attachment
    console.debug('[HotelFiltersComponent] Filters view initialized');
  }

  // Method: Initialize reactive FormGroup and dynamic FormArray
  private buildFilterForm(): void {
    // Create FormGroup with bound initial bounds
    this.filterForm = this.fb.group({
      minPriceCtrl: new FormControl(this.minBound),
      maxPriceCtrl: new FormControl(this.maxBound),
      categoryCtrl: new FormControl('all'),
      // FormArray holding dynamic amenity controls
      amenitiesArray: this.fb.array(
        this.amenitiesList.map(() => new FormControl(false))
      ),
    });
  }

  // FormArray getter
  get amenitiesFormArray(): FormArray {
    // Cast control to FormArray
    return this.filterForm.get('amenitiesArray') as FormArray;
  }

  // Method: Synchronize local filter state variables from @Input filters model
  private syncLocalState(): void {
    // Read min price or fallback to minimum bound
    this.localMinPrice = this.filters?.minPrice ?? this.minBound;

    // Read max price or fallback to maximum bound
    this.localMaxPrice = this.filters?.maxPrice ?? this.maxBound;

    // Read category or default to 'all'
    this.selectedCategory = this.filters?.category || 'all';

    // Read minimum rating threshold
    this.selectedRating = this.filters?.minRating ?? null;

    // Array.isArray verification and shallow copy
    this.selectedAmenities = Array.isArray(this.filters?.amenities) ? [...this.filters.amenities] : [];

    // Clear previous Set entries
    this.selectedAmenitiesSet.clear();

    // Populate Set with active amenities
    this.selectedAmenities.forEach(a => this.selectedAmenitiesSet.add(a));

    // Read superhost flag
    this.superhostOnly = !!this.filters?.superhostOnly;

    // Read free cancellation flag
    this.freeCancellationOnly = !!this.filters?.freeCancellationOnly;

    // Read instant book flag
    this.instantBookOnly = !!this.filters?.instantBookOnly;
  }

  // Method: Calculate count of currently active filter items
  get activeFiltersCount(): number {
    // Initialize counter
    let count = 0;

    // Increment if specific category is selected
    if (this.selectedCategory && this.selectedCategory !== 'all') count++;

    // Increment if price bounds deviate from baseline
    if (this.localMinPrice > this.minBound || this.localMaxPrice < this.maxBound) count++;

    // Increment if rating filter is active
    if (this.selectedRating) count++;

    // Increment for each selected amenity
    if (this.selectedAmenitiesSet.size > 0) {
      count += this.selectedAmenitiesSet.size;
    }

    // Increment for superhost perk
    if (this.superhostOnly) count++;

    // Increment for cancellation perk
    if (this.freeCancellationOnly) count++;

    // Increment for instant book perk
    if (this.instantBookOnly) count++;

    // Return total count
    return count;
  }

  // Method: Update category selection and apply filters
  onCategorySelect(cat: string): void {
    // Update local category variable
    this.selectedCategory = cat;

    // Trigger filter update
    this.applyFilters();
  }

  // Method: Update rating threshold and apply filters
  onRatingSelect(rating: number | null): void {
    // Log user click action to browser DevTools console
    console.log('[HotelFiltersComponent:onClick] 👆 Rating filter selected:', rating);

    // Update rating state
    this.selectedRating = rating;

    // Trigger filter update
    this.applyFilters();
  }

  // Method: Toggle an amenity using Set.has(), Set.delete(), and Set.add()
  toggleAmenity(amenity: string): void {
    // Log user click action to browser DevTools console
    console.log('[HotelFiltersComponent:onClick] 👆 Amenity filter toggled:', amenity);

    // Check if amenity exists in Set
    if (this.selectedAmenitiesSet.has(amenity)) {
      // Remove amenity from Set
      this.selectedAmenitiesSet.delete(amenity);
    } else {
      // Add amenity into Set
      this.selectedAmenitiesSet.add(amenity);
    }

    // Convert Set back to array representation using Array.from()
    this.selectedAmenities = Array.from(this.selectedAmenitiesSet);

    // Trigger filter dispatch
    this.applyFilters();
  }

  // Method: Determine if an amenity is currently selected using Set.has()
  isAmenitySelected(amenity: string): boolean {
    // Return O(1) Set membership check
    return this.selectedAmenitiesSet.has(amenity);
  }

  // Method: Handle price changes and auto-correct min/max bounds
  onPriceChange(): void {
    // Log user click action to browser DevTools console
    console.log('[HotelFiltersComponent:onClick] 👆 Price range slider adjusted:', this.localMinPrice, 'to', this.localMaxPrice);

    // Check if min exceeds max
    if (this.localMinPrice > this.localMaxPrice) {
      // Auto-correct min bound
      this.localMinPrice = this.localMaxPrice;
    }
    // Trigger filter dispatch
    this.applyFilters();
  }

  // Method: Toggle boolean perks (Superhost, Free Cancellation, Instant Book)
  togglePerk(perk: 'superhost' | 'cancellation' | 'instant'): void {
    // Log user click action to browser DevTools console
    console.log('[HotelFiltersComponent:onClick] 👆 Perk toggled:', perk);

    // Branch by perk type
    if (perk === 'superhost') this.superhostOnly = !this.superhostOnly;
    if (perk === 'cancellation') this.freeCancellationOnly = !this.freeCancellationOnly;
    if (perk === 'instant') this.instantBookOnly = !this.instantBookOnly;

    // Trigger filter dispatch
    this.applyFilters();
  }

  // Method: Reset all filters to their baseline defaults
  resetAll(): void {
    // Log user click action to browser DevTools console
    console.log('[HotelFiltersComponent:onClick] 👆 Reset All Filters clicked');

    // Reset min price
    this.localMinPrice = this.minBound;

    // Reset max price
    this.localMaxPrice = this.maxBound;

    // Reset category
    this.selectedCategory = 'all';

    // Reset rating
    this.selectedRating = null;

    // Clear selected amenities array
    this.selectedAmenities = [];

    // Clear selected amenities Set
    this.selectedAmenitiesSet.clear();

    // Reset superhost perk
    this.superhostOnly = false;

    // Reset cancellation perk
    this.freeCancellationOnly = false;

    // Reset instant book perk
    this.instantBookOnly = false;

    // Trigger filter dispatch
    this.applyFilters();
  }

  private filterDebounceTimer: any = null;

  // Method: Emit updated FilterCriteria to parent component with setTimeout asynchronous debounce and if-else
  applyFilters(): void {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }

    // Concept: setTimeout function in component.ts for asynchronous calling simulation
    this.filterDebounceTimer = setTimeout(() => {
      const updated: FilterCriteria = {
        ...this.filters,
        category: this.selectedCategory,
        minPrice: this.localMinPrice > this.minBound ? this.localMinPrice : null,
        maxPrice: this.localMaxPrice < this.maxBound ? this.localMaxPrice : null,
        minRating: this.selectedRating,
        amenities: [...this.selectedAmenities],
        superhostOnly: this.superhostOnly,
        freeCancellationOnly: this.freeCancellationOnly,
        instantBookOnly: this.instantBookOnly,
        page: 1,
      };

      // Concept: if - else condition checking active amenities
      if (Array.isArray(this.selectedAmenities) && this.selectedAmenities.length > 0) {
        console.debug('[HotelFiltersComponent] Applying filters with amenities:', this.selectedAmenities.length);
      } else {
        console.debug('[HotelFiltersComponent] Applying filters with no specific amenities');
      }

      // Concept: EventEmitter emit() call
      this.filtersChange.emit(updated);
    }, 150);
  }

  // Method: Close sliding drawer on mobile
  onClose(): void {
    // Log user click action to browser DevTools console
    console.log('[HotelFiltersComponent:onClick] 👆 Close filter drawer');

    // Output: Emit close drawer event
    this.closeDrawer.emit();
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
