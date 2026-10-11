import { Component, Input, Output, EventEmitter, OnInit, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { Hotel } from '../../../core/models/hotel.model';
import { HotelService } from '../../../core/services/hotel.service';

// Component: Modal dialog rendering a rich interactive quick view of a selected hotel
@Component({
  selector: 'app-hotel-quick-view',
  templateUrl: './hotel-quick-view.component.html',
  styleUrls: ['./hotel-quick-view.component.css'],
})
export class HotelQuickViewComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // Input: Selected hotel entity to display in quick view modal
  @Input() hotel: Hotel | null = null;

  // Input: Number of selected nights for cost calculation
  @Input() nights = 1;

  // Input: Number of guests
  @Input() guests = 1;

  // Output: Emits when quick view modal dialog is closed
  @Output() close = new EventEmitter<void>();

  // Output: Emits hotel ID when reserve CTA button is clicked
  @Output() reserve = new EventEmitter<number>();

  // Active gallery photo index state
  activePhotoIndex = 0;

  constructor(
    private hotelService: HotelService,
    private cdr: ChangeDetectorRef
  ) {}

  // LifeCycle Hook: ngOnInit initialization
  ngOnInit(): void {
    // Log initialization for debugging
    console.debug('[HotelQuickViewComponent] Initialized quick view modal component');
  }

  // LifeCycle Hook: ngOnChanges detects hotel selection changes from parent ListingsComponent
  ngOnChanges(changes: SimpleChanges): void {
    // Check if selected hotel object changed
    if (changes?.['hotel']) {
      // Reset active enlarged photo index to 0
      this.activePhotoIndex = 0;

      // Trigger change detection
      this.cdr.markForCheck();
    }

    // Check if nights or guests input changed
    if (changes?.['nights'] || changes?.['guests']) {
      // Request change detection update
      this.cdr.markForCheck();
    }
  }

  // LifeCycle Hook: ngAfterViewInit runs when quick view DOM elements are ready
  ngAfterViewInit(): void {
    // Output debug view attachment log
    console.debug('[HotelQuickViewComponent] Quick view modal rendered');
  }

  // Method: Check if current modal hotel is in favorites wishlist
  get isFavorite(): boolean {
    // Return true if hotel ID exists in favorites collection
    return this.hotel?.id ? this.hotelService.isFavorite(this.hotel.id) : false;
  }

  // Method: Retrieve hotel photos array or fallback
  get images(): string[] {
    // Cache reference to current hotel object
    const hotelObj = this.hotel;

    // Check if gallery images array exists and has elements
    if (hotelObj && Array.isArray(hotelObj.images) && hotelObj.images.length > 0) {
      // Return images array
      return hotelObj.images;
    }

    // Fallback to single primary image URL or empty array
    return hotelObj?.imageUrl ? [hotelObj.imageUrl] : [];
  }

  // Method: Calculate baseline stay total for the given number of nights
  get stayTotal(): number {
    // Guard against missing price
    if (!this.hotel?.price) return 0;

    // Multiply nightly price by nights count
    return this.hotel.price * (this.nights || 1);
  }

  // Method: Calculate grand total including cleaning and service fees
  get grandTotal(): number {
    // Guard against null hotel object
    if (!this.hotel) return 0;

    // Extract cleaning fee with 0 fallback
    const cleaning = this.hotel?.cleaningFee || 0;

    // Extract service fee with 0 fallback
    const service = this.hotel?.serviceFee || 0;

    // Sum stay total with cleaning and service fees
    return this.stayTotal + cleaning + service;
  }

  // Method: Toggle wishlist favorite state and stop event propagation
  toggleFavorite(event: MouseEvent): void {
    // Stop click event propagation to backdrop
    event.stopPropagation();

    // Check if hotel ID exists
    if (this.hotel?.id) {
      // Toggle favorite status via HotelService
      this.hotelService.toggleFavorite(this.hotel.id);
    }
  }

  // Method: Switch the active enlarged photo index
  selectPhoto(index: number): void {
    // Assign selected photo index
    this.activePhotoIndex = index;
  }

  // Method: Emit close dialog event
  onClose(): void {
    // Output: Emit close modal event
    this.close.emit();
  }

  // Method: Stop click event propagation on dialog container
  onDialogClick(event: MouseEvent): void {
    // Prevent backdrop click handler from closing modal
    event.stopPropagation();
  }

  // Method: Emit reserve booking CTA event
  onReserve(): void {
    // Check if hotel numeric ID exists
    if (this.hotel?.id) {
      // Output: Emit reserve event with hotel ID
      this.reserve.emit(this.hotel.id);
    }
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Clean teardown
  }
}
