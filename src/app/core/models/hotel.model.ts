export interface Coordinates {
  lat: number;
  lng: number;
}

export interface HostInfo {
  id: number;
  name: string;
  avatar: string;
  isSuperhost: boolean;
  responseRate: number;
  joinedYear: number;
}

export interface Hotel {
  id: number;
  name: string;
  tagline?: string;
  description: string;
  location: string;
  city: string;
  country: string;
  category: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  images: string[];
  isFeatured: boolean;
  isSuperhost: boolean;
  isInstantBook: boolean;
  freeCancellation: boolean;
  amenities: string[];
  beds: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  coordinates: Coordinates;
  host?: HostInfo;
  cleaningFee?: number;
  serviceFee?: number;
}

export interface Destination {
  id: number;
  city: string;
  country: string;
  imageUrl: string;
  propertyCount: number;
}

export interface Category {
  icon: string;
  label: string;
  value: string;
}

export interface SearchQuery {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export type SortOption =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'reviews-desc';

export interface FilterCriteria {
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  category?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  amenities?: string[];
  superhostOnly?: boolean;
  freeCancellationOnly?: boolean;
  instantBookOnly?: boolean;
  sortBy?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  minAvailablePrice: number;
  maxAvailablePrice: number;
}
