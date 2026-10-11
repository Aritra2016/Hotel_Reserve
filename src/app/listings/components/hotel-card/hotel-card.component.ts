import { Component, Input, Output, EventEmitter, OnInit, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { Hotel } from '../../../core/models/hotel.model';
import { HotelService } from '../../../core/services/hotel.service';

// Component: Renders an individual hotel listing card with image carousel, wishlist toggle, and pricing
@Component({
  selector: 'app-hotel-card',
  templateUrl: './hotel-card.component.html',
  styleUrls: ['./hotel-card.component.css'],
})
export class HotelCardComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // Input: Hotel entity data object
  @Input() hotel!: Hotel;

  // Input: Flag indicating horizontal or compact layout
  @Input() isHorizontal = false;

  // Input: Selected number of stay nights for pricing calculation
  @Input() nights = 1;

  // Input: Flag indicating whether card is currently highlighted by map pin hover
  @Input() isHighlighted = false;

  // Output: Emits hotel ID when card is clicked
  @Output() cardClick = new EventEmitter<number>();

  // Output: Emits hotel object when quick view preview modal is requested
  @Output() quickView = new EventEmitter<Hotel>();

  // Output: Emits hotel ID on mouse enter or null on mouse leave for map pin sync
  @Output() cardHover = new EventEmitter<number | null>();

  // Active image carousel index
  currentImageIndex = 0;

  constructor(
    private hotelService: HotelService,
    private cdr: ChangeDetectorRef
  ) {}

  // LifeCycle Hook: ngOnInit runs upon card initialization
  ngOnInit(): void {
    // Log initialized card for debugging
    console.debug(`[HotelCardComponent] Initialized card for hotel ID: ${this.hotel?.id}`);
  }

  // LifeCycle Hook: ngOnChanges detects input changes from parent ListingsComponent
  ngOnChanges(changes: SimpleChanges): void {
    // Check if hotel input object changed
    if (changes?.['hotel']) {
      // Reset image carousel index to 0
      this.currentImageIndex = 0;

      // Trigger change detection
      this.cdr.markForCheck();
    }

    // Check if highlight state or night count changed
    if (changes?.['isHighlighted'] || changes?.['nights']) {
      // Request change detection update
      this.cdr.markForCheck();
    }
  }

  // LifeCycle Hook: ngAfterViewInit runs after view elements are rendered
  ngAfterViewInit(): void {
    // Output debug view attachment log
    console.debug(`[HotelCardComponent] Card view ready for hotel: ${this.hotel?.name}`);
  }

  // Method: Check if this hotel is saved in user favorites
  get isFavorite(): boolean {
    // Return true if hotel ID exists in HotelService favorites collection
    return this.hotel?.id ? this.hotelService.isFavorite(this.hotel.id) : false;
  }

  // Method: Retrieve hotel image gallery array or fallback to primary image
  get images(): string[] {
    // Check if image gallery array exists with at least one item
    if (Array.isArray(this.hotel?.images) && this.hotel.images.length > 0) {
      // Return full image gallery array
      return this.hotel.images;
    }

    // Return primary imageUrl wrapped in an array or empty array fallback
    return this.hotel?.imageUrl ? [this.hotel.imageUrl] : [];
  }

  // Method: Compute total stay price for the given number of nights
  get totalStayPrice(): number {
    // Multiply hotel nightly rate by selected number of nights
    return (this.hotel?.price || 0) * (this.nights || 1);
  }

  // Method: Toggle wishlist favorite state and stop event propagation
  toggleFavorite(event: MouseEvent): void {
    // Stop click event propagation to card container
    event.stopPropagation();

    // Check if hotel numeric identifier is present
    if (this.hotel?.id) {
      // Toggle favorite status via HotelService
      this.hotelService.toggleFavorite(this.hotel.id);
    }
  }

  // Method: Navigate to previous image in carousel
  prevImage(event: MouseEvent): void {
    // Stop click event propagation to card container
    event.stopPropagation();

    // Compute previous image index with wrap-around
    this.currentImageIndex =
      (this.currentImageIndex - 1 + this.images.length) % this.images.length;
  }

  // Method: Navigate to next image in carousel
  nextImage(event: MouseEvent): void {
    // Stop click event propagation to card container
    event.stopPropagation();

    // Compute next image index with wrap-around
    this.currentImageIndex = (this.currentImageIndex + 1) % this.images.length;
  }

  // Method: Select a specific carousel dot index
  selectImage(index: number, event: MouseEvent): void {
    // Stop click event propagation to card container
    event.stopPropagation();

    // Assign chosen carousel image index
    this.currentImageIndex = index;
  }

  // Method: Emit click event for card navigation
  onCardClick(): void {
    // Check if hotel numeric ID exists
    if (this.hotel?.id) {
      // Output: Emit cardClick event with hotel ID
      this.cardClick.emit(this.hotel.id);
    }
  }

  // Method: Emit Quick View event for modal preview
  onQuickView(event: MouseEvent): void {
    // Stop click event propagation to prevent background card navigation
    event.stopPropagation();

    // Check if hotel entity is present
    if (this.hotel) {
      // Output: Emit quickView event with hotel entity
      this.quickView.emit(this.hotel);
    }
  }

  // Method: Emit mouse enter event for map pin synchronization
  onMouseEnter(): void {
    // Check if hotel numeric ID exists
    if (this.hotel?.id) {
      // Output: Emit cardHover event with hotel ID
      this.cardHover.emit(this.hotel.id);
    }
  }

  // Method: Emit mouse leave event clearing map pin highlight
  onMouseLeave(): void {
    // Output: Emit cardHover event with null to clear pin highlight
    this.cardHover.emit(null);
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Teardown component resources
  }
}
