import { Component, Input, Output, EventEmitter, OnInit, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { Hotel } from '../../../core/models/hotel.model';

// Component: Renders an interactive vector-styled map with price badge pins and popup previews
@Component({
  selector: 'app-hotel-map',
  templateUrl: './hotel-map.component.html',
  styleUrls: ['./hotel-map.component.css'],
})
export class HotelMapComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // Input: List of hotels rendered as pins on vector map
  @Input() hotels: Hotel[] = [];

  // Input: Currently hovered hotel numeric ID for synchronized badge glow
  @Input() hoveredHotelId: number | null = null;

  // Input: Currently selected hotel numeric ID for active popup preview
  @Input() selectedHotelId: number | null = null;

  // Output: Emits hotel object when a map pin is clicked
  @Output() markerClick = new EventEmitter<Hotel>();

  // Output: Emits hotel numeric ID to open hotel detail page
  @Output() viewHotel = new EventEmitter<number>();

  // Zoom level state index for vector canvas
  zoomLevel = 12;

  // Layer mode for map rendering ('street' or 'satellite')
  mapType: 'street' | 'satellite' = 'street';

  // Currently focused hotel for popup card overlay
  selectedHotelPopup: Hotel | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  // LifeCycle Hook: ngOnInit initialization
  ngOnInit(): void {
    // Log initialized vector map
    console.debug('[HotelMapComponent] Initialized vector map view with pins count:', this.hotels?.length);

    // Synchronize popup based on initial selectedHotelId input
    this.syncSelectedPopup();
  }

  // LifeCycle Hook: ngOnChanges detects updates to hotels, selectedHotelId, or hoveredHotelId
  ngOnChanges(changes: SimpleChanges): void {
    // Check if hotels array or selected hotel ID changed
    if (changes?.['hotels'] || changes?.['selectedHotelId']) {
      // Synchronize popup modal state
      this.syncSelectedPopup();

      // Trigger change detection
      this.cdr.markForCheck();
    }

    // Check if hovered hotel ID changed
    if (changes?.['hoveredHotelId']) {
      // Trigger change detection to redraw pin glows
      this.cdr.markForCheck();
    }
  }

  // LifeCycle Hook: ngAfterViewInit executes once map canvas has rendered
  ngAfterViewInit(): void {
    // Output debug view attachment log
    console.debug('[HotelMapComponent] Map canvas view rendered ready');
  }

  // Method: Synchronize active popup hotel entity from hotels array
  private syncSelectedPopup(): void {
    // Check if selectedHotelId is set and hotels is an array
    if (this.selectedHotelId && Array.isArray(this.hotels)) {
      // Locate matching hotel entity by ID or fallback to null
      this.selectedHotelPopup = this.hotels.find((h: Hotel) => h?.id === this.selectedHotelId) || null;
    } else {
      // Clear selected hotel popup
      this.selectedHotelPopup = null;
    }
  }

  // Method: Calculate relative percentage map pin coordinate spread
  getPinPosition(hotel: Hotel, index: number): { top: string; left: string } {
    // Define column count for pin grid distribution
    const cols = 4;

    // Calculate row index based on pin index
    const row = Math.floor(index / cols);

    // Calculate column index based on pin index
    const col = index % cols;

    // Compute deterministic horizontal jitter based on hotel ID
    const jitterX = (((hotel?.id || 1) * 17) % 15) - 7;

    // Compute deterministic vertical jitter based on hotel ID
    const jitterY = (((hotel?.id || 1) * 23) % 15) - 7;

    // Calculate base left percentage coordinate
    const leftPercent = 18 + col * 20 + jitterX;

    // Calculate base top percentage coordinate
    const topPercent = 20 + row * 24 + jitterY;

    // Return bounded CSS percentage coordinates for pin placement
    return {
      left: `${Math.max(8, Math.min(88, leftPercent))}%`,
      top: `${Math.max(12, Math.min(84, topPercent))}%`,
    };
  }

  // Method: Handle map pin click event and open popup
  onPinClick(hotel: Hotel, event: MouseEvent): void {
    // Stop click event propagation to map canvas
    event.stopPropagation();

    // Assign clicked hotel to popup card preview
    this.selectedHotelPopup = hotel;

    // Output: Emit markerClick event with hotel entity
    this.markerClick.emit(hotel);
  }

  // Method: Close floating map preview popup
  closePopup(event: MouseEvent): void {
    // Stop click event propagation
    event.stopPropagation();

    // Reset popup hotel preview to null
    this.selectedHotelPopup = null;
  }

  // Method: Stop click event propagation on map preview popup
  onPopupClick(event: MouseEvent): void {
    // Stop propagation so popup does not close when interacting with it
    event.stopPropagation();
  }

  // Method: Emit event to view full hotel details
  onViewHotel(id: number, event: MouseEvent): void {
    // Stop propagation to background map
    event.stopPropagation();

    // Output: Emit viewHotel event with numeric hotel ID
    this.viewHotel.emit(id);
  }

  // Method: Increase zoom level
  zoomIn(): void {
    // Check if zoom level is under upper bound
    if (this.zoomLevel < 18) {
      // Increment zoom level
      this.zoomLevel++;
    }
  }

  // Method: Decrease zoom level
  zoomOut(): void {
    // Check if zoom level is above lower bound
    if (this.zoomLevel > 6) {
      // Decrement zoom level
      this.zoomLevel--;
    }
  }

  // Method: Toggle between street and satellite vector map layers
  toggleMapType(): void {
    // Toggle layer mode between street and satellite
    this.mapType = this.mapType === 'street' ? 'satellite' : 'street';
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    // Clean teardown
  }
}
