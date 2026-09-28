import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HotelService } from '../../core/services/hotel.service';
import { Hotel, Destination, Category } from '../../core/models/hotel.model';

@Injectable({ providedIn: 'root' })
export class HomeService {
  constructor(private hotelService: HotelService) {}

  get categories(): Category[] {
    return this.hotelService.categories;
  }

  getFeaturedHotels(): Observable<Hotel[]> {
    return this.hotelService.getFeaturedHotels();
  }

  getHotelsByCategory(category: string): Observable<Hotel[]> {
    return this.hotelService.getHotelsByCategory(category);
  }

  getPopularDestinations(): Observable<Destination[]> {
    return this.hotelService.getPopularDestinations();
  }
}
