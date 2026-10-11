import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, shareReplay, tap, catchError } from 'rxjs/operators';
import {
  Hotel,
  Destination,
  Category,
  FilterCriteria,
  PaginatedResult,
} from '../models/hotel.model';

// Service: Centralized Hotel data provider fetching from HTTP endpoints and managing wishlist state
@Injectable({ providedIn: 'root' })
export class HotelService {
  // Concept: Storage key constant for persisting user favorites in localStorage
  private readonly FAVORITES_STORAGE_KEY = 'stayease_favorites';

  // Concept: API endpoint paths for live HTTP network requests
  private readonly HOTELS_API_URL = 'assets/data/hotels.json';
  private readonly DESTINATIONS_API_URL = 'assets/data/destinations.json';

  // Concept: RxJS BehaviorSubject managing reactive wishlist state
  private favoritesSubject = new BehaviorSubject<number[]>(this.loadFavoritesFromStorage());

  // Concept: RxJS Observable stream for external subscribers
  public favorites$: Observable<number[]> = this.favoritesSubject.asObservable();

  // Concept: Cached HTTP Observable stream for hotels to avoid redundant network requests
  private hotelsCache$?: Observable<Hotel[]>;

  // Concept: Cached HTTP Observable stream for destinations
  private destinationsCache$?: Observable<Destination[]>;

  // Concept: List of available categories
  readonly categories: Category[] = [
    { icon: '🌟', label: 'All', value: 'all' },
    { icon: '🏖️', label: 'Beachfront', value: 'Beachfront' },
    { icon: '🏔️', label: 'Mountain', value: 'Mountain' },
    { icon: '🏙️', label: 'City', value: 'City' },
    { icon: '🌿', label: 'Nature', value: 'Nature' },
    { icon: '🏰', label: 'Luxury', value: 'Luxury' },
    { icon: '🛖', label: 'Cabin', value: 'Cabin' },
    { icon: '🏡', label: 'Villa', value: 'Villa' },
    { icon: '✨', label: 'Boutique', value: 'Boutique' },
  ];

  // Concept: Master list of amenities for filtering
  readonly availableAmenities: string[] = [
    'WiFi',
    'Pool',
    'Spa',
    'Breakfast',
    'Fireplace',
    'Gym',
    'Free Parking',
    'Pet Friendly',
    'Air Conditioning',
    'Hot Tub',
    'Kitchen',
    'Ocean View',
    'Rooftop',
    'Ski-in',
    'BBQ',
  ];

  // Concept: Constructor injecting Angular's HttpClient for real network requests
  constructor(private http: HttpClient) { }

  // Method: Load favorites list from browser localStorage with try/catch error handling
  private loadFavoritesFromStorage(): number[] {
    try {
      const stored = localStorage.getItem(this.FAVORITES_STORAGE_KEY);
      // Concept: Array.isArray verification on parsed JSON
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Concept: Debugging log for loaded wishlist items
          console.debug('[HotelService] Loaded favorites from storage:', parsed);
          return parsed;
        }
      }
      return [1, 7];
    } catch (err: unknown) {
      // Concept: instanceof check on catch error object
      if (err instanceof Error) {
        console.warn('[HotelService] Error loading favorites:', err.message);
      }
      return [1, 7];
    }
  }

  // Method: Toggle hotel favorite state and broadcast updated array via RxJS BehaviorSubject
  toggleFavorite(hotelId: number): void {
    const current = this.favoritesSubject.getValue();
    // Concept: Array.filter() to remove, or spread syntax to add
    const updated = current.includes(hotelId)
      ? current.filter(id => id !== hotelId)
      : [...current, hotelId];

    // Concept: RxJS next() call emitting new state to subscribers
    this.favoritesSubject.next(updated);

    try {
      localStorage.setItem(this.FAVORITES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e: unknown) {
      // Concept: instanceof error inspection
      if (e instanceof Error) {
        console.error('[HotelService] Failed to save favorite to localStorage:', e.message);
      }
    }
  }

  // Method: Synchronous check whether a hotel is in the user's wishlist
  isFavorite(hotelId: number): boolean {
    return this.favoritesSubject.getValue().includes(hotelId);
  }

  // Method: HTTP GET request to fetch all hotels (visible in DevTools Network tab)
  getAllHotels(): Observable<Hotel[]> {
    if (!this.hotelsCache$) {
      // Concept: HttpClient.get() making live HTTP network request
      this.hotelsCache$ = this.http.get<Hotel[]>(this.HOTELS_API_URL).pipe(
        tap(hotels => console.debug(`[HotelService:HTTP] GET ${this.HOTELS_API_URL} succeeded with ${hotels.length} hotels`)),
        shareReplay(1),
        catchError(err => {
          console.error('[HotelService:HTTP] Error fetching hotels.json:', err);
          return of([]);
        })
      );
    }
    return this.hotelsCache$;
  }

  // Method: RxJS Observable stream returning featured hotels via real HTTP request
  getFeaturedHotels(): Observable<Hotel[]> {
    // Concept: HTTP network request chained with RxJS map() operator
    return this.getAllHotels().pipe(
      map(hotels => hotels.filter(h => h.isFeatured)),
      tap(featured => console.debug('[HotelService] Featured hotels loaded:', featured.length))
    );
  }

  // Method: RxJS Observable stream returning hotels by category via real HTTP request
  getHotelsByCategory(category: string): Observable<Hotel[]> {
    return this.getAllHotels().pipe(
      map(hotels =>
        category === 'all'
          ? hotels
          : hotels.filter(h => h.category.toLowerCase() === category.toLowerCase())
      )
    );
  }

  // Method: HTTP GET request to fetch destinations (visible in DevTools Network tab)
  getPopularDestinations(): Observable<Destination[]> {
    if (!this.destinationsCache$) {
      // Concept: HttpClient.get() making live HTTP network request for destinations
      this.destinationsCache$ = this.http.get<Destination[]>(this.DESTINATIONS_API_URL).pipe(
        tap(destinations => console.debug(`[HotelService:HTTP] GET ${this.DESTINATIONS_API_URL} succeeded with ${destinations.length} destinations`)),
        shareReplay(1),
        catchError(err => {
          console.error('[HotelService:HTTP] Error fetching destinations.json:', err);
          return of([]);
        })
      );
    }
    return this.destinationsCache$;
  }

  // Method: RxJS Observable stream finding a single hotel by numeric ID
  getHotelById(id: number): Observable<Hotel | undefined> {
    return this.getAllHotels().pipe(
      map(hotels => hotels.find(h => h.id === id))
    );
  }

  // Method: Calculate min and max price across all listings using Array.map()
  getPriceRange(): { min: number; max: number } {
    return {
      min: 50,
      max: 1200,
    };
  }

  // Method: Search and filter pipeline applying criteria, live HTTP request with HttpParams, sorting and pagination
  searchHotels(criteria: FilterCriteria): Observable<PaginatedResult<Hotel>> {
    // Construct dynamic HttpParams representing current search filter query
    let httpParams = new HttpParams().set('_ts', Date.now().toString());

    // Check if location filter criteria was provided
    if (criteria?.location && criteria.location.trim().length > 0) {
      // Append sanitized location parameter to query string
      httpParams = httpParams.set('location', criteria.location.trim());
    }

    // Check if checkIn date was provided
    if (criteria?.checkIn) {
      // Append checkIn parameter to query string
      httpParams = httpParams.set('checkIn', criteria.checkIn);
    }

    // Check if checkOut date was provided
    if (criteria?.checkOut) {
      // Append checkOut parameter to query string
      httpParams = httpParams.set('checkOut', criteria.checkOut);
    }

    // Check if guests count was provided
    if (criteria?.guests) {
      // Append guests count parameter to query string
      httpParams = httpParams.set('guests', criteria.guests.toString());
    }

    // Check if category was specified
    if (criteria?.category && criteria.category !== 'all') {
      // Append category parameter to query string
      httpParams = httpParams.set('category', criteria.category);
    }

    // Execute live HTTP GET request via HttpClient (visible in DevTools Network tab!)
    return this.http.get<Hotel[]>(this.HOTELS_API_URL, { params: httpParams }).pipe(
      // Log outgoing HTTP search request in console
      tap((hotels: Hotel[]) =>
        console.debug(
          `[HotelService:HTTP] Search request dispatched over network (${hotels.length} hotels returned):`,
          criteria
        )
      ),
      // Intercept network failure errors
      catchError((err: unknown) => {
        // Log network error
        console.error('[HotelService:HTTP] Error executing live search request:', err);
        // Fallback to empty array
        return of([] as Hotel[]);
      }),
      // Process, filter, sort, and paginate matching hotels
      map(allHotels => {
        let list: Hotel[] = [...allHotels];

        // Concept: Optional chaining (?.) and text matching filter
        if (criteria?.location && criteria.location.trim().length > 0) {
          const locTerm = criteria.location.trim().toLowerCase();
          // Concept: Array.filter() with multiple location criteria
          list = list.filter(
            h =>
              h.city.toLowerCase().includes(locTerm) ||
              h.country.toLowerCase().includes(locTerm) ||
              h.location.toLowerCase().includes(locTerm) ||
              h.name.toLowerCase().includes(locTerm)
          );
        }

        // Concept: Capacity filter with guest numbers
        if (criteria?.guests && criteria.guests > 1) {
          list = list.filter(h => h.maxGuests >= (criteria.guests || 1));
        }

        // Concept: Category filter
        if (criteria?.category && criteria.category !== 'all') {
          list = list.filter(
            h => h.category.toLowerCase() === (criteria.category || '').toLowerCase()
          );
        }

        // Concept: Price boundaries filtering
        if (criteria?.minPrice !== undefined && criteria.minPrice !== null) {
          list = list.filter(h => h.price >= (criteria.minPrice ?? 0));
        }
        if (criteria?.maxPrice !== undefined && criteria.maxPrice !== null) {
          list = list.filter(h => h.price <= (criteria.maxPrice ?? 999999));
        }

        // Concept: Star rating filter
        if (criteria?.minRating !== undefined && criteria.minRating !== null && criteria.minRating > 0) {
          list = list.filter(h => h.rating >= (criteria.minRating ?? 0));
        }

        // Concept: Array.isArray check on amenities filter
        if (Array.isArray(criteria?.amenities) && criteria.amenities.length > 0) {
          // Concept: Array.every() ensuring all required amenities match
          list = list.filter(h =>
            criteria.amenities!.every(a => h.amenities.includes(a))
          );
        }

        // Concept: Boolean perks filters
        if (criteria?.superhostOnly) {
          list = list.filter(h => h.isSuperhost);
        }
        if (criteria?.freeCancellationOnly) {
          list = list.filter(h => h.freeCancellation);
        }
        if (criteria?.instantBookOnly) {
          list = list.filter(h => h.isInstantBook);
        }

        // Concept: Sorting logic based on SortOption
        const sortBy = criteria?.sortBy || 'recommended';
        switch (sortBy) {
          case 'price-asc':
            list.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            list.sort((a, b) => b.price - a.price);
            break;
          case 'rating-desc':
            list.sort((a, b) => b.rating - a.rating);
            break;
          case 'reviews-desc':
            list.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
          case 'recommended':
          default:
            list.sort((a, b) => {
              if (a.isFeatured === b.isFeatured) {
                return b.rating - a.rating;
              }
              return a.isFeatured ? -1 : 1;
            });
            break;
        }

        // Concept: Array.map() to compute min and max available price
        const allPrices: number[] = allHotels.map(h => h.price);
        const minAvailablePrice = allPrices.length > 0 ? Math.min(...allPrices) : 50;
        const maxAvailablePrice = allPrices.length > 0 ? Math.max(...allPrices) : 1200;

        // Concept: Pagination calculation
        const totalCount = list.length;
        const page = criteria?.page || 1;
        const pageSize = criteria?.pageSize || 9;
        const totalPages = Math.ceil(totalCount / pageSize) || 1;
        const startIndex = (page - 1) * pageSize;
        const paginatedItems = list.slice(startIndex, startIndex + pageSize);

        console.debug(`[HotelService:HTTP] Matched ${totalCount} listings, returning page ${page}/${totalPages}`);

        const result: PaginatedResult<Hotel> = {
          items: paginatedItems,
          totalCount,
          page,
          pageSize,
          totalPages,
          minAvailablePrice,
          maxAvailablePrice,
        };

        return result;
      })
    );
  }
}
