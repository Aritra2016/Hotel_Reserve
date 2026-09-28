import { Component, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
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

  // Concept: RxJS Subject for managing component cleanup
  private destroy$ = new Subject<void>();

  // Concept: Constructor injecting FormBuilder, Router, and HomeService
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private homeService: HomeService
  ) {}

  // LifeCycle Hook: ngOnInit initializes dates, reactive form, categories, and async datasets
  ngOnInit(): void {
    // Concept: Initialize minimum date restrictions
    this.initDates();

    // Concept: Build reactive FormGroup with FormControls
    this.buildForm();

    // Concept: Retrieve categories from service
    this.categories = this.homeService.categories;

    // Concept: Load asynchronous featured hotels and popular destinations
    this.loadFeaturedHotels();
    this.loadDestinations();

    // Concept: Debugging log for Home component initialization
    console.debug('[HomeComponent] Initialized with categories count:', this.categories.length);
  }

  // LifeCycle Hook: ngAfterViewInit executes after template has rendered
  ngAfterViewInit(): void {
    // Concept: setTimeout demonstration to log welcome status after rendering
    setTimeout(() => {
      console.log('[HomeComponent] Hero and Search bar rendered ready for interaction');
    }, 150);
  }

  // Method: Initialize date restrictions using JavaScript Date objects and instanceof check
  private initDates(): void {
    const today = new Date();
    // Concept: instanceof check on Date object
    if (today instanceof Date && !isNaN(today.getTime())) {
      this.todayStr = today.toISOString().split('T')[0];

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.minCheckOutDate = tomorrow.toISOString().split('T')[0];
    }
  }

  // Method: Build reactive FormGroup with explicit FormControls and valueChanges RxJS streams
  private buildForm(): void {
    this.searchForm = this.fb.group({
      location: new FormControl(''),
      checkIn: new FormControl(''),
      checkOut: new FormControl(''),
      guests: new FormControl(1),
    });

    // Concept: RxJS Observable stream listening to checkIn changes to adjust checkOut bounds
    this.searchForm.get('checkIn')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val: string) => {
        if (val) {
          const checkInDate = new Date(val);
          // Concept: instanceof check
          if (checkInDate instanceof Date && !isNaN(checkInDate.getTime())) {
            const nextDay = new Date(checkInDate);
            nextDay.setDate(nextDay.getDate() + 1);
            this.minCheckOutDate = nextDay.toISOString().split('T')[0];

            // Concept: Optional chaining (?.) to compare checkOut date
            const currentCheckOut = this.searchForm.get('checkOut')?.value;
            if (currentCheckOut && new Date(currentCheckOut) <= checkInDate) {
              this.searchForm.patchValue({ checkOut: this.minCheckOutDate });
            }
          }
        }
      });

    // Concept: RxJS Observable stream listening to location input to filter autocomplete suggestions
    this.searchForm.get('location')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val: string) => {
        if (!val || val.trim().length === 0) {
          this.filteredSuggestions = [...this.popularSuggestions];
        } else {
          const query = val.toLowerCase().trim();
          // Concept: Array.filter() to find matching destination items
          this.filteredSuggestions = this.popularSuggestions.filter(
            s =>
              s.city.toLowerCase().includes(query) ||
              s.country.toLowerCase().includes(query) ||
              s.label.toLowerCase().includes(query)
          );
        }
      });
  }

  // Method: RxJS Subscribe to load featured hotels from service
  private loadFeaturedHotels(): void {
    this.loadingFeatured = true;
    this.homeService.getFeaturedHotels()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingFeatured = false))
      )
      .subscribe({
        next: (hotels: Hotel[]) => {
          this.featuredHotels = hotels;
          // Concept: Array.forEach() logging featured item names
          this.featuredHotels.forEach(h => console.debug('[FeaturedStay]', h?.name));
        },
        error: (err: unknown) => {
          // Concept: instanceof check for error logging
          if (err instanceof Error) {
            console.error('[HomeComponent] Failed to load featured stays:', err.message);
          }
        },
      });
  }

  // Method: RxJS Subscribe to load popular destinations from service
  private loadDestinations(): void {
    this.loadingDestinations = true;
    this.homeService.getPopularDestinations()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingDestinations = false))
      )
      .subscribe((destinations: Destination[]) => {
        this.destinations = destinations;
      });
  }

  // Method: Open location suggestions dropdown and close guests dropdown
  openLocationDropdown(): void {
    this.showLocationDropdown = true;
    this.showGuestDropdown = false;
  }

  // Method: Select a location suggestion and update form control
  selectLocation(item: { city: string; label: string }): void {
    this.searchForm.patchValue({ location: item?.city });
    this.showLocationDropdown = false;
  }

  // Method: Open guest selection stepper dropdown
  openGuestDropdown(): void {
    this.showGuestDropdown = true;
    this.showLocationDropdown = false;
  }

  // Method: Update adult or children counter steppers and patch total guest count
  updateGuests(type: 'adults' | 'children', delta: number): void {
    if (type === 'adults') {
      this.adultsCount = Math.max(1, Math.min(16, this.adultsCount + delta));
    } else {
      this.childrenCount = Math.max(0, Math.min(10, this.childrenCount + delta));
    }
    const total = this.adultsCount + this.childrenCount;
    this.searchForm.patchValue({ guests: total });
  }

  // Method: Generate formatted total guest label string
  get totalGuestLabel(): string {
    const total = this.adultsCount + this.childrenCount;
    return total === 1 ? '1 guest' : `${total} guests`;
  }

  // Method: Select active category and filter hotels asynchronously
  selectCategory(category: string): void {
    if (this.activeCategory === category) return;
    this.activeCategory = category;
    this.loadingFiltered = true;
    this.homeService.getHotelsByCategory(category).pipe(takeUntil(this.destroy$),finalize(() => (this.loadingFiltered = false))).subscribe((hotels: Hotel[]) => {this.filteredHotels = hotels;});
  }

  // Method: Submit search query and navigate to /listings with query parameters
  onSearch(): void {
    this.showLocationDropdown = false;
    this.showGuestDropdown = false;

    // Concept: Optional chaining (?.) on form value
    const raw = this.searchForm?.value;
    const queryParams: any = {};

    if (raw?.location && raw.location.trim().length > 0) {
      queryParams.location = raw.location.trim();
    }
    if (raw?.checkIn) {
      queryParams.checkIn = raw.checkIn;
    }
    if (raw?.checkOut) {
      queryParams.checkOut = raw.checkOut;
    }
    if (raw?.guests && raw.guests > 1) {
      queryParams.guests = raw.guests;
    }

    // Concept: Debugging log for search action
    console.debug('[HomeComponent] Submitting search with queryParams:', queryParams);

    // Concept: Angular Router navigation
    this.router.navigate(['/listings'], { queryParams });
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
