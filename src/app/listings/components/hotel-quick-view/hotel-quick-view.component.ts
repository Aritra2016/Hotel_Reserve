import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Hotel } from '../../../core/models/hotel.model';
import { HotelService } from '../../../core/services/hotel.service';

// Component: Modal dialog rendering a rich interactive quick view of a selected hotel
@Component({
  selector: 'app-hotel-quick-view',
  templateUrl: './hotel-quick-view.component.html',
  styleUrls: ['./hotel-quick-view.component.css'],
})
export class HotelQuickViewComponent implements OnInit, OnChanges, OnDestroy {
  // Concept: Component Input properties
  @Input() hotel: Hotel | null = null;
  @Input() nights = 1;
  @Input() guests = 1;

  // Concept: Component Output EventEmitters
  @Output() close = new EventEmitter<void>();
  @Output() reserve = new EventEmitter<number>();

  // Concept: Active gallery photo index state
  activePhotoIndex = 0;

  // Concept: Dependency injection of HotelService
  constructor(private hotelService: HotelService) {}

  // LifeCycle Hook: ngOnInit initialization
  ngOnInit(): void {
    // Concept: Debugging log
    console.debug('[HotelQuickViewComponent] Initialized quick view modal component');
  }

  // LifeCycle Hook: ngOnChanges detects hotel selection changes
  ngOnChanges(changes: SimpleChanges): void {
    // Concept: Optional chaining (?.) and resetting active photo
    if (changes?.['hotel'] && this.hotel) {
      this.activePhotoIndex = 0;
    }
  }

  // Method: Check if current modal hotel is in favorites wishlist
  get isFavorite(): boolean {
    return this.hotel?.id ? this.hotelService.isFavorite(this.hotel.id) : false;
  }

  // Method: Retrieve hotel photos array or fallback
  get images(): string[] {
    const hotelObj = this.hotel;
    // Concept: Array.isArray check on image gallery with null safety
    if (hotelObj && Array.isArray(hotelObj.images) && hotelObj.images.length > 0) {
      return hotelObj.images;
    }
    return hotelObj?.imageUrl ? [hotelObj.imageUrl] : [];
  }

  // Method: Calculate baseline stay total for the given number of nights
  get stayTotal(): number {
    if (!this.hotel?.price) return 0;
    return this.hotel.price * (this.nights || 1);
  }

  // Method: Calculate grand total including cleaning and service fees
  get grandTotal(): number {
    if (!this.hotel) return 0;
    const cleaning = this.hotel?.cleaningFee || 0;
    const service = this.hotel?.serviceFee || 0;
    return this.stayTotal + cleaning + service;
  }

  // Method: Toggle wishlist favorite state and stop event propagation
  toggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    if (this.hotel?.id) {
      this.hotelService.toggleFavorite(this.hotel.id);
    }
  }

  // Method: Switch the active enlarged photo index
  selectPhoto(index: number): void {
    this.activePhotoIndex = index;
  }

  // Method: Emit close dialog event
  onClose(): void {
    this.close.emit();
  }

  // Method: Emit reserve booking CTA event
  onReserve(): void {
    if (this.hotel?.id) {
      this.reserve.emit(this.hotel.id);
    }
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Concept: Modal cleanup
  }
}
