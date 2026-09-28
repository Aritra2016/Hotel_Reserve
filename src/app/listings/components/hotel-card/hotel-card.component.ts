import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Hotel } from '../../../core/models/hotel.model';
import { HotelService } from '../../../core/services/hotel.service';

// Component: Renders an individual hotel listing card with image carousel, wishlist toggle, and pricing
@Component({
  selector: 'app-hotel-card',
  templateUrl: './hotel-card.component.html',
  styleUrls: ['./hotel-card.component.css'],
})
export class HotelCardComponent implements OnInit, OnChanges, OnDestroy {
  // Concept: Component Input properties
  @Input() hotel!: Hotel;
  @Input() isHorizontal = false;
  @Input() nights = 1;
  @Input() isHighlighted = false;

  // Concept: Component Output EventEmitters
  @Output() cardClick = new EventEmitter<number>();
  @Output() quickView = new EventEmitter<Hotel>();
  @Output() cardHover = new EventEmitter<number | null>();

  // Concept: Active image carousel index
  currentImageIndex = 0;

  // Concept: Dependency injection of HotelService
  constructor(private hotelService: HotelService) {}

  // LifeCycle Hook: ngOnInit runs upon card initialization
  ngOnInit(): void {
    // Concept: Debugging log for initialized card
    console.debug(`[HotelCardComponent] Initialized card for hotel ID: ${this.hotel?.id}`);
  }

  // LifeCycle Hook: ngOnChanges detects input changes
  ngOnChanges(changes: SimpleChanges): void {
    // Concept: Optional chaining (?.) checking hotel input change
    if (changes?.['hotel']) {
      this.currentImageIndex = 0;
    }
  }

  // Method: Check if this hotel is saved in user favorites
  get isFavorite(): boolean {
    return this.hotel?.id ? this.hotelService.isFavorite(this.hotel.id) : false;
  }

  // Method: Retrieve hotel image gallery array or fallback to primary image
  get images(): string[] {
    // Concept: Array.isArray check and length evaluation
    if (Array.isArray(this.hotel?.images) && this.hotel.images.length > 0) {
      return this.hotel.images;
    }
    return this.hotel?.imageUrl ? [this.hotel.imageUrl] : [];
  }

  // Method: Compute total stay price for the given number of nights
  get totalStayPrice(): number {
    return (this.hotel?.price || 0) * (this.nights || 1);
  }

  // Method: Toggle wishlist favorite state and stop event propagation
  toggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    if (this.hotel?.id) {
      this.hotelService.toggleFavorite(this.hotel.id);
    }
  }

  // Method: Navigate to previous image in carousel
  prevImage(event: MouseEvent): void {
    event.stopPropagation();
    this.currentImageIndex =
      (this.currentImageIndex - 1 + this.images.length) % this.images.length;
  }

  // Method: Navigate to next image in carousel
  nextImage(event: MouseEvent): void {
    event.stopPropagation();
    this.currentImageIndex = (this.currentImageIndex + 1) % this.images.length;
  }

  // Method: Select a specific carousel dot index
  selectImage(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.currentImageIndex = index;
  }

  // Method: Emit click event for card navigation
  onCardClick(): void {
    if (this.hotel?.id) {
      this.cardClick.emit(this.hotel.id);
    }
  }

  // Method: Emit Quick View event for modal preview
  onQuickView(event: MouseEvent): void {
    event.stopPropagation();
    if (this.hotel) {
      this.quickView.emit(this.hotel);
    }
  }

  // Method: Emit mouse enter event for map pin synchronization
  onMouseEnter(): void {
    if (this.hotel?.id) {
      this.cardHover.emit(this.hotel.id);
    }
  }

  // Method: Emit mouse leave event clearing map pin highlight
  onMouseLeave(): void {
    this.cardHover.emit(null);
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Concept: Clean teardown
  }
}
