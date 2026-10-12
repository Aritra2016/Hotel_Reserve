import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HotelService } from '../../core/services/hotel.service';
import { Hotel, Destination, Category, FilterCriteria, PaginatedResult } from '../../core/models/hotel.model';

@Injectable({ providedIn: 'root' })
export class HomeService {
  constructor(private hotelService: HotelService) {}

  // Method: Return available property categories
  get categories(): Category[] {
    // Delegate to HotelService categories property
    return this.hotelService.categories;
  }

  // Method: Retrieve featured hotels list
  getFeaturedHotels(): Observable<Hotel[]> {
    // Delegate to HotelService getFeaturedHotels
    return this.hotelService.getFeaturedHotels();
  }

  // Method: Retrieve hotels filtered by specific category
  getHotelsByCategory(category: string): Observable<Hotel[]> {
    // Delegate to HotelService getHotelsByCategory
    return this.hotelService.getHotelsByCategory(category);
  }

  // Method: Retrieve popular travel destinations
  getPopularDestinations(): Observable<Destination[]> {
    // Delegate to HotelService getPopularDestinations
    return this.hotelService.getPopularDestinations();
  }

  // Method: Live HTTP search execution for Home component search button click
  searchHotelsLive(criteria: FilterCriteria): Observable<PaginatedResult<Hotel>> {
    // Delegate to HotelService searchHotels which executes live HttpClient.get visible in Network tab
    return this.hotelService.searchHotels(criteria);
  }

  // Method: Retrieve complete list of hotels for reactive search filtering
  getAllHotels(): Observable<Hotel[]> {
    // Delegate to HotelService getAllHotels
    return this.hotelService.getAllHotels();
  }
}
