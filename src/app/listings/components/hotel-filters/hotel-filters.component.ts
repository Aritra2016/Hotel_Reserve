import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
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
export class HotelFiltersComponent implements OnInit, OnChanges, OnDestroy {
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

  // Concept: Subject for unsubscribing from observables on destroy
  private destroy$ = new Subject<void>();

  // Concept: Constructor injecting HotelService and FormBuilder
  constructor(
    private hotelService: HotelService,
    private fb: FormBuilder
  ) {}

  // LifeCycle Hook: ngOnInit runs on component initialization
  ngOnInit(): void {
    // Concept: Initialize categories and amenities lists
    this.categories = this.hotelService.categories;
    this.amenitiesList = this.hotelService.availableAmenities;

    // Concept: Build reactive FormGroup with FormControls and FormArray
    this.buildFilterForm();

    // Concept: Synchronize local state with inputs
    this.syncLocalState();

    // Concept: Debugging log for filter component initialization
    console.debug('[HotelFiltersComponent] Initialized with amenities count:', this.amenitiesList.length);
  }

  // LifeCycle Hook: ngOnChanges detects changes to @Input properties
  ngOnChanges(changes: SimpleChanges): void {
    // Concept: Optional chaining (?.) and property change detection
    if (changes?.['filters'] || changes?.['minBound'] || changes?.['maxBound']) {
      this.syncLocalState();
    }
  }

  // Method: Initialize reactive FormGroup and dynamic FormArray
  private buildFilterForm(): void {
    this.filterForm = this.fb.group({
      minPriceCtrl: new FormControl(this.minBound),
      maxPriceCtrl: new FormControl(this.maxBound),
      categoryCtrl: new FormControl('all'),
      // Concept: FormArray holding dynamic amenity controls
      amenitiesArray: this.fb.array(
        this.amenitiesList.map(() => new FormControl(false))
      ),
    });
  }

  // Concept: FormArray getter
  get amenitiesFormArray(): FormArray {
    return this.filterForm.get('amenitiesArray') as FormArray;
  }

  // Method: Synchronize local filter state variables from @Input filters model
  private syncLocalState(): void {
    this.localMinPrice = this.filters?.minPrice ?? this.minBound;
    this.localMaxPrice = this.filters?.maxPrice ?? this.maxBound;
    this.selectedCategory = this.filters?.category || 'all';
    this.selectedRating = this.filters?.minRating ?? null;
    // Concept: Array.isArray verification and shallow copy
    this.selectedAmenities = Array.isArray(this.filters?.amenities) ? [...this.filters.amenities] : [];
    this.superhostOnly = !!this.filters?.superhostOnly;
    this.freeCancellationOnly = !!this.filters?.freeCancellationOnly;
    this.instantBookOnly = !!this.filters?.instantBookOnly;
  }

  // Method: Calculate count of currently active filter items
  get activeFiltersCount(): number {
    let count = 0;
    if (this.selectedCategory && this.selectedCategory !== 'all') count++;
    if (this.localMinPrice > this.minBound || this.localMaxPrice < this.maxBound) count++;
    if (this.selectedRating) count++;
    // Concept: Array.isArray check on selectedAmenities
    if (Array.isArray(this.selectedAmenities) && this.selectedAmenities.length > 0) {
      count += this.selectedAmenities.length;
    }
    if (this.superhostOnly) count++;
    if (this.freeCancellationOnly) count++;
    if (this.instantBookOnly) count++;
    return count;
  }

  // Method: Update category selection and apply filters
  onCategorySelect(cat: string): void {
    this.selectedCategory = cat;
    this.applyFilters();
  }

  // Method: Update rating threshold and apply filters
  onRatingSelect(rating: number | null): void {
    this.selectedRating = rating;
    this.applyFilters();
  }

  // Method: Toggle an amenity in the selected list
  toggleAmenity(amenity: string): void {
    const idx = this.selectedAmenities.indexOf(amenity);
    if (idx >= 0) {
      // Concept: Array.splice() to remove item
      this.selectedAmenities.splice(idx, 1);
    } else {
      // Concept: Array.push() to add item
      this.selectedAmenities.push(amenity);
    }
    this.applyFilters();
  }

  // Method: Determine if an amenity is currently selected
  isAmenitySelected(amenity: string): boolean {
    return this.selectedAmenities.includes(amenity);
  }

  // Method: Handle price changes and auto-correct min/max bounds
  onPriceChange(): void {
    if (this.localMinPrice > this.localMaxPrice) {
      this.localMinPrice = this.localMaxPrice;
    }
    this.applyFilters();
  }

  // Method: Toggle boolean perks (Superhost, Free Cancellation, Instant Book)
  togglePerk(perk: 'superhost' | 'cancellation' | 'instant'): void {
    if (perk === 'superhost') this.superhostOnly = !this.superhostOnly;
    if (perk === 'cancellation') this.freeCancellationOnly = !this.freeCancellationOnly;
    if (perk === 'instant') this.instantBookOnly = !this.instantBookOnly;
    this.applyFilters();
  }

  // Method: Reset all filters to their baseline defaults
  resetAll(): void {
    this.localMinPrice = this.minBound;
    this.localMaxPrice = this.maxBound;
    this.selectedCategory = 'all';
    this.selectedRating = null;
    this.selectedAmenities = [];
    this.superhostOnly = false;
    this.freeCancellationOnly = false;
    this.instantBookOnly = false;
    this.applyFilters();
  }

  // Method: Emit updated FilterCriteria to parent component
  applyFilters(): void {
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

    // Concept: Array.forEach() logging active filter values
    this.selectedAmenities.forEach(a => console.debug('[FilterApplied] Amenity:', a));

    // Concept: EventEmitter emit() call
    this.filtersChange.emit(updated);
  }

  // Method: Close sliding drawer on mobile
  onClose(): void {
    this.closeDrawer.emit();
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
