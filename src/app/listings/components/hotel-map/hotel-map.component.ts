import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Hotel } from '../../../core/models/hotel.model';

// Component: Renders an interactive vector-styled map with price badge pins and popup previews
@Component({
  selector: 'app-hotel-map',
  templateUrl: './hotel-map.component.html',
  styleUrls: ['./hotel-map.component.css'],
})
export class HotelMapComponent implements OnInit, OnChanges, OnDestroy {
  // Concept: Component Input properties
  @Input() hotels: Hotel[] = [];
  @Input() hoveredHotelId: number | null = null;
  @Input() selectedHotelId: number | null = null;

  // Concept: Component Output EventEmitters
  @Output() markerClick = new EventEmitter<Hotel>();
  @Output() viewHotel = new EventEmitter<number>();

  // Concept: Map view configuration state
  zoomLevel = 12;
  mapType: 'street' | 'satellite' = 'street';
  selectedHotelPopup: Hotel | null = null;

  // LifeCycle Hook: ngOnInit initialization
  ngOnInit(): void {
    // Concept: Debugging log
    console.debug('[HotelMapComponent] Initialized vector map view with pins count:', this.hotels?.length);
  }

  // LifeCycle Hook: ngOnChanges detects selectedHotelId changes
  ngOnChanges(changes: SimpleChanges): void {
    // Concept: Optional chaining (?.) and synchronizing popup
    if (changes?.['selectedHotelId'] && this.selectedHotelId) {
      this.selectedHotelPopup =
        this.hotels.find(h => h?.id === this.selectedHotelId) || null;
    }
  }

  // Method: Calculate relative percentage map pin coordinate spread
  getPinPosition(hotel: Hotel, index: number): { top: string; left: string } {
    const cols = 4;
    const row = Math.floor(index / cols);
    const col = index % cols;

    // Concept: Deterministic jitter offset based on hotel id
    const jitterX = (((hotel?.id || 1) * 17) % 15) - 7;
    const jitterY = (((hotel?.id || 1) * 23) % 15) - 7;

    const leftPercent = 18 + col * 20 + jitterX;
    const topPercent = 20 + row * 24 + jitterY;

    return {
      left: `${Math.max(8, Math.min(88, leftPercent))}%`,
      top: `${Math.max(12, Math.min(84, topPercent))}%`,
    };
  }

  // Method: Handle map pin click event and open popup
  onPinClick(hotel: Hotel, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedHotelPopup = hotel;
    this.markerClick.emit(hotel);
  }

  // Method: Close floating map preview popup
  closePopup(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedHotelPopup = null;
  }

  // Method: Emit event to view full hotel details
  onViewHotel(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.viewHotel.emit(id);
  }

  // Method: Increase zoom level
  zoomIn(): void {
    if (this.zoomLevel < 18) this.zoomLevel++;
  }

  // Method: Decrease zoom level
  zoomOut(): void {
    if (this.zoomLevel > 6) this.zoomLevel--;
  }

  // Method: Toggle between street and satellite vector map layers
  toggleMapType(): void {
    this.mapType = this.mapType === 'street' ? 'satellite' : 'street';
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Concept: Map teardown
  }
}
