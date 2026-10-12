import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, Optional } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, FormArray, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize, tap } from 'rxjs/operators';
import { Hotel } from '../../../core/models/hotel.model';
import { BookingConfirmation, BookingRequest } from '../../../core/models/booking.model';
import { HotelService } from '../../../core/services/hotel.service';
import { BookingService } from '../../../core/services/booking.service';
import { RazorpayService } from '../../../core/services/razorpay.service';
import { RouteTrackerService } from '../../../core/services/route-tracker.service';
import { AppComponent } from '../../../app.component';

// Component: Controller for Hotel Details view, multi-step booking checkout, and Razorpay Mobile OTP payment flow
@Component({
  selector: 'app-hotel-details',
  templateUrl: './hotel-details.component.html',
  styleUrls: ['./hotel-details.component.css'],
})
export class HotelDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Concept: Active hotel model state
  hotel: Hotel | null = null;
  hotelId: number | null = null;
  isLoading = true;

  // Concept: Photo Gallery state
  activePhotoIndex = 0;
  isLightboxOpen = false;

  // Concept: Booking Widget Dates & Guests state
  checkInDate: string = '';
  checkOutDate: string = '';
  minCheckInDate: string = '';
  minCheckOutDate: string = '';
  adultsCount: number = 1;
  childrenCount: number = 0;
  isGuestsDropdownOpen = false;

  // Concept: Multi-Step Checkout Modal state
  isCheckoutModalOpen = false;
  checkoutStep: 'review' | 'guest_info' | 'payment' | 'confirmed' = 'review';
  isProcessingPayment = false;
  confirmedBooking: BookingConfirmation | null = null;

  // Concept: Razorpay Gateway & Mobile OTP state variables
  isRazorpayModalOpen = false;
  razorpayOrderId = '';
  mobileNumber = '';
  mobileOtp = '';
  generatedOtp = '123456';
  isOtpSent = false;
  otpCountdown = 30;
  otpTimerRef: any = null;
  isVerifyingOtp = false;
  otpError = '';
  razorpayPaymentId = '';

  // Concept: Reactive FormGroup for Guest and Payment checkout information
  checkoutForm!: FormGroup;

  // Concept: Share and Wishlist state
  isFavorite = false;
  showShareToast = false;

  // Concept: Categorized Amenities list
  amenitiesByCategory: { category: string; icon: string; items: string[] }[] = [];

  // Concept: Simulated customer reviews
  reviews = [
    {
      id: 1,
      author: 'Sophia Martinez',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
      rating: 5,
      date: '2 weeks ago',
      content: 'An extraordinary stay! The views are completely mesmerizing and the host went above and beyond with personal touches and recommendations.',
    },
    {
      id: 2,
      author: 'David Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
      rating: 5,
      date: 'Last month',
      content: 'Spotless property, ultra-comfortable beds, and the amenities were top notch. Will definitely be rebooking for our next holiday!',
    },
    {
      id: 3,
      author: 'Emma Watson',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&q=80',
      rating: 4.8,
      date: '2 months ago',
      content: 'Peaceful and luxurious. The photos honestly do not do it justice. The sunsets from the deck were the highlight of our vacation.',
    },
  ];

  // Concept: Ratings breakdown scores
  ratingBreakdown = [
    { category: 'Cleanliness', score: '4.9' },
    { category: 'Accuracy', score: '4.9' },
    { category: 'Communication', score: '5.0' },
    { category: 'Location', score: '4.8' },
    { category: 'Check-in', score: '5.0' },
    { category: 'Value', score: '4.8' },
  ];

  // Data Structure: Map associating amenity names to graphical icons
  amenityIconsMap = new Map<string, string>([
    ['WiFi', '📶'],
    ['Pool', '🏊'],
    ['Spa', '🧖'],
    ['Breakfast', '🍳'],
    ['Fireplace', '🔥'],
    ['Gym', '🏋️'],
    ['Free Parking', '🚗'],
    ['Pet Friendly', '🐾'],
    ['Air Conditioning', '❄️'],
    ['Hot Tub', '🛁'],
    ['Kitchen', '🍳'],
    ['Ocean View', '🌊'],
    ['Rooftop', '🌆'],
    ['Ski-in', '⛷️'],
    ['BBQ', '🍖'],
  ]);

  // Data Structure: Set storing favorite hotel IDs for O(1) wishlist lookups
  favoriteHotelIdsSet = new Set<number>();

  // Settings: View configuration flags for the details template
  detailsSettings = {
    showTaxesInLedger: true,
    compactSummary: false,
    currency: 'USD'
  };

  // RxJS Subject for clean unsubscription
  private destroy$ = new Subject<void>();

  // Method: Calculate average customer review rating score dynamically using Array.reduce()
  get averageCustomerRating(): number {
    // Check if reviews list exists
    if (!this.reviews || this.reviews.length === 0) {
      // Return static hotel rating or default
      return this.hotel?.rating || 4.9;
    }
    // Sum review ratings using Array.reduce() with optional chaining
    const totalScore = this.reviews.reduce((acc, r) => acc + (r?.rating || 0), 0);
    // Return rounded average to 1 decimal place
    return Math.round((totalScore / this.reviews.length) * 10) / 10;
  }

  // Concept: Constructor injecting Router, ActivatedRoute, FormBuilder, HotelService, BookingService, RazorpayService, RouteTrackerService, ChangeDetectorRef, and parent AppComponent
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private hotelService: HotelService,
    private bookingService: BookingService,
    public razorpayService: RazorpayService,
    public routeTracker: RouteTrackerService,
    private cdr: ChangeDetectorRef,
    @Optional() private appComponent?: AppComponent
  ) {}

  // LifeCycle Hook: ngOnInit initializes dates, reactive forms, and queries route parameters
  ngOnInit(): void {
    // Initialize default check-in and check-out dates
    this.initDefaultDates();

    // Build reactive checkout form with FormControls and FormArray
    this.buildCheckoutForm();

    // Expose amenityIconsMap globally on window for console inspection
    (window as any).amenityIconsMap = this.amenityIconsMap;
    // Log with console.debug for Verbose level
    console.debug('Amenity Icons Map data (amenityIconsMap):', this.amenityIconsMap);
    console.debug(this.amenityIconsMap);
    // Log amenity icons Map data to console for Info level
    console.log('Amenity Icons Map data (amenityIconsMap):', this.amenityIconsMap);
    // Log raw Map object for tree inspection
    console.log(this.amenityIconsMap);

    // Listen to route :id parameter changes
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      // Subscribe to route parameter observable
      .subscribe(params => {
        // Extract string ID parameter
        const idStr = params.get('id');
        // Validate ID parameter exists
        if (idStr) {
          // Parse integer ID
          this.hotelId = parseInt(idStr, 10);
          // Query hotel details from service
          this.fetchHotelDetails(this.hotelId);
        }
      });

    // Listen to route query parameter changes for checkout step and deep-linking routing
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      // Subscribe to route query parameter observable
      .subscribe(queryParams => {
        // Extract step parameter
        const step = queryParams.get('step');
        // Validate step value
        if (step && ['review', 'guest_info', 'payment', 'confirmed'].includes(step)) {
          // Assign active checkout step
          this.checkoutStep = step as any;
          // Open checkout modal dialog
          this.isCheckoutModalOpen = true;
          // Output formatted telemetry log to browser DevTools console
          console.log(`[HotelDetailsComponent:Route] Active checkout step synchronized from URL query: "${step}"`);
          // Request view change detection
          this.cdr.markForCheck();
        } else if (!step && this.isCheckoutModalOpen) {
          // Close modal if step removed from URL
          this.isCheckoutModalOpen = false;
          // Request view change detection
          this.cdr.markForCheck();
        }
      });
  }

  // LifeCycle Hook: ngAfterViewInit executes after view rendering
  ngAfterViewInit(): void {
    // Execute smooth scroll to top with setTimeout
    setTimeout(() => {
      // Scroll window to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Log render status
      console.debug('[HotelDetailsComponent] View rendered and scrolled to top');
    }, 50);
  }

  // Method: Initialize default check-in and check-out dates
  private initDefaultDates(): void {
    const today = new Date();
    // Concept: instanceof check on Date
    if (today instanceof Date && !isNaN(today.getTime())) {
      this.minCheckInDate = today.toISOString().split('T')[0];
      this.checkInDate = this.minCheckInDate;

      const defaultOut = new Date(today);
      defaultOut.setDate(defaultOut.getDate() + 3);
      this.minCheckOutDate = this.minCheckInDate;
      this.checkOutDate = defaultOut.toISOString().split('T')[0];
    }
  }

  // Method: Build reactive checkout form with FormControls, FormArray, and Validators
  private buildCheckoutForm(): void {
    this.checkoutForm = this.fb.group({
      // Primary Guest details
      firstName: new FormControl('', [Validators.required, Validators.minLength(2)]),
      lastName: new FormControl('', [Validators.required, Validators.minLength(2)]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', [Validators.required, Validators.pattern(/^[+0-9\s-()]{7,20}$/)]),
      specialRequests: new FormControl(''),

      // Concept: FormArray for additional accompanying guests
      additionalGuests: this.fb.array([]),

      // Payment details - defaults to razorpay
      paymentMethod: new FormControl('razorpay', [Validators.required]),
      cardNumber: new FormControl(''),
      cardHolder: new FormControl(''),
      expiryDate: new FormControl(''),
      cvv: new FormControl(''),
    });
  }

  // Concept: Getter for additional guests FormArray
  get additionalGuestsFormArray(): FormArray {
    return this.checkoutForm.get('additionalGuests') as FormArray;
  }

  // Method: Add dynamic guest entry to FormArray
  addAdditionalGuest(): void {
    // Concept: FormArray.push() adding a new FormGroup
    this.additionalGuestsFormArray.push(
      this.fb.group({
        fullName: new FormControl('', [Validators.required]),
        age: new FormControl(null),
      })
    );
  }

  // Method: Remove dynamic guest entry from FormArray
  removeAdditionalGuest(index: number): void {
    // Concept: FormArray.removeAt()
    this.additionalGuestsFormArray.removeAt(index);
  }

  // Method: RxJS Subscribe pipeline querying hotel details by ID with setTimeout async calling
  private fetchHotelDetails(id: number): void {
    this.isLoading = true;
    // Concept: setTimeout function in component.ts for asynchronous calling
    setTimeout(() => {
      // Concept: Calling HotelService method getHotelById
      this.hotelService
        .getHotelById(id)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.isLoading = false;
            this.cdr.markForCheck();
          })
        )
        .subscribe({
          next: (hotel?: Hotel) => {
            // Concept: if - else condition
            if (hotel) {
              this.hotel = hotel;
              this.isFavorite = this.hotelService.isFavorite(hotel.id);
              this.buildCategorizedAmenities(hotel.amenities);
              this.cdr.markForCheck();

              // Concept: Debugging log
              console.debug(`[HotelDetailsComponent] Loaded details for hotel: ${hotel.name} ($${hotel.price}/night)`);
            } else {
              this.hotel = null;
              console.warn('[HotelDetailsComponent] Hotel not found for ID:', id);
            }
          },
          error: (err: unknown) => {
            // Concept: if - else condition with instanceof check
            if (err instanceof Error) {
              console.error('[HotelDetailsComponent] Error fetching hotel:', err.message);
            } else {
              console.error('[HotelDetailsComponent] Unknown error fetching hotel');
            }
          },
        });
    }, 200);
  }

  // Method: Organize raw amenities array into visual categories using Array.filter() and map()
  private buildCategorizedAmenities(amenities: string[]): void {
    if (!Array.isArray(amenities)) return;

    this.amenitiesByCategory = [
      {
        category: 'Scenic & Views',
        icon: '🌅',
        items: amenities.filter(a => ['Ocean View', 'Rooftop', 'Ski-in'].includes(a)),
      },
      {
        category: 'Wellness & Relaxation',
        icon: '🧖',
        items: amenities.filter(a => ['Pool', 'Spa', 'Hot Tub'].includes(a)),
      },
      {
        category: 'Essentials & Comfort',
        icon: '🛏️',
        items: amenities.filter(a => ['WiFi', 'Air Conditioning', 'Fireplace', 'Breakfast', 'Gym'].includes(a)),
      },
      {
        category: 'Facilities & Outdoors',
        icon: '🏡',
        items: amenities.filter(a => ['Kitchen', 'Free Parking', 'Pet Friendly', 'BBQ'].includes(a)),
      },
    ].filter(cat => cat.items.length > 0);
  }

  // Method: Gallery images getter
  get galleryImages(): string[] {
    const h = this.hotel;
    if (h && Array.isArray(h.images) && h.images.length > 0) {
      return h.images;
    }
    return h?.imageUrl ? [h.imageUrl] : [];
  }

  // Method: Calculate stay nights
  get calculatedNights(): number {
    if (!this.checkInDate || !this.checkOutDate) return 1;
    const start = new Date(this.checkInDate);
    const end = new Date(this.checkOutDate);

    // Concept: instanceof check
    if (start instanceof Date && end instanceof Date && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 1;
    }
    return 1;
  }

  // Method: Calculate price breakdown figures in USD and INR
  get basePriceTotal(): number {
    return (this.hotel?.price || 0) * this.calculatedNights;
  }

  get cleaningFeeTotal(): number {
    return this.hotel?.cleaningFee || 35;
  }

  get serviceFeeTotal(): number {
    return this.hotel?.serviceFee || 25;
  }

  get discountTotal(): number {
    if (this.hotel?.discountPercent && this.hotel.discountPercent > 0) {
      return Math.round((this.basePriceTotal * this.hotel.discountPercent) / 100);
    }
    return 0;
  }

  get grandTotal(): number {
    return this.basePriceTotal + this.cleaningFeeTotal + this.serviceFeeTotal - this.discountTotal;
  }

  get grandTotalInr(): number {
    return this.razorpayService.convertToInr(this.grandTotal);
  }

  get totalGuestsCount(): number {
    return this.adultsCount + this.childrenCount;
  }

  get totalGuestsLabel(): string {
    const total = this.totalGuestsCount;
    return total === 1 ? '1 guest' : `${total} guests`;
  }

  // Method: Date change handlers
  onCheckInChange(val: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Change Check-In Date', { checkInDate: val });
    // Assign check-in date string
    this.checkInDate = val;
    // Instantiate Date from input string
    const start = new Date(val);
    // Concept: instanceof check on Date
    if (start instanceof Date && !isNaN(start.getTime())) {
      // Create next day date instance
      const nextDay = new Date(start);
      // Increment day by 1
      nextDay.setDate(nextDay.getDate() + 1);
      // Format minimum check-out date ISO string
      this.minCheckOutDate = nextDay.toISOString().split('T')[0];
      // Compare check-out date against new check-in date
      if (new Date(this.checkOutDate) <= start) {
        // Adjust check-out date to minimum allowable next day
        this.checkOutDate = this.minCheckOutDate;
      }
    }
    // Request view change detection
    this.cdr.markForCheck();
  }

  onCheckOutChange(val: string): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Change Check-Out Date', { checkOutDate: val });
    // Assign check-out date string
    this.checkOutDate = val;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Update adult or children counter steppers
  updateGuests(type: 'adults' | 'children', delta: number): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', `Update Guests Counter: ${type} (${delta > 0 ? '+1' : '-1'})`, {
      type,
      delta,
      currentAdults: this.adultsCount,
      currentChildren: this.childrenCount
    });
    // Check if updating adult guests
    if (type === 'adults') {
      // Calculate max guests capacity allowed
      const maxAllowed = this.hotel?.maxGuests || 6;
      // Clamp adults count between 1 and maxAllowed
      this.adultsCount = Math.max(1, Math.min(maxAllowed, this.adultsCount + delta));
    } else {
      // Clamp children count between 0 and 6
      this.childrenCount = Math.max(0, Math.min(6, this.childrenCount + delta));
    }
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Toggle and close guests selection dropdown
  toggleGuestsDropdown(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Toggle Guests Dropdown', {
      isOpen: !this.isGuestsDropdownOpen,
      totalGuests: this.totalGuestsCount
    });
    // Invert guests dropdown visibility flag
    this.isGuestsDropdownOpen = !this.isGuestsDropdownOpen;
    // Request view change detection
    this.cdr.markForCheck();
  }

  closeGuestsDropdown(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Close Guests Dropdown (Done)', {
      adults: this.adultsCount,
      children: this.childrenCount,
      totalGuests: this.totalGuestsCount
    });
    // Dismiss guests dropdown menu
    this.isGuestsDropdownOpen = false;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Stop click event propagation to parent elements
  stopEventPropagation(event: MouseEvent | Event): void {
    // Halt event bubbling
    event.stopPropagation();
  }

  // Method: Dismiss the Razorpay gateway modal
  closeRazorpayModal(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Close Razorpay Gateway Modal');
    // Dismiss razorpay modal dialog
    this.isRazorpayModalOpen = false;
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Toggle wishlist favorite state
  toggleFavorite(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Toggle Wishlist Favorite', {
      hotelId: this.hotel?.id,
      hotelName: this.hotel?.name,
      previouslyFavorite: this.isFavorite
    });
    // Validate hotel existence
    if (this.hotel?.id) {
      // Call HotelService method to toggle favorite
      this.hotelService.toggleFavorite(this.hotel.id);
      // Synchronize favorite boolean state
      this.isFavorite = this.hotelService.isFavorite(this.hotel.id);
      // Request view change detection
      this.cdr.markForCheck();
    }
  }

  // Method: Share listing link with temporary notification toast
  onShare(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Share Listing URL', {
      url: window.location.href
    });
    // Copy URL to user system clipboard
    if (navigator.clipboard) {
      // Write text to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
    // Display share toast banner
    this.showShareToast = true;
    // Concept: setTimeout to dismiss toast after 2.5s
    setTimeout(() => {
      // Dismiss share toast banner
      this.showShareToast = false;
      // Request view change detection
      this.cdr.markForCheck();
    }, 2500);
  }

  // Method: Lightbox gallery controls
  openLightbox(index: number = 0): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', `Open Photo Lightbox (Image #${index + 1})`, { index });
    // Set active lightbox photo index
    this.activePhotoIndex = index;
    // Open photo lightbox modal
    this.isLightboxOpen = true;
    // Request view change detection
    this.cdr.markForCheck();
  }

  closeLightbox(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Close Photo Lightbox');
    // Dismiss photo lightbox modal
    this.isLightboxOpen = false;
    // Request view change detection
    this.cdr.markForCheck();
  }

  prevPhoto(event?: MouseEvent): void {
    // Check if event was provided
    if (event) {
      // Halt event bubbling
      event.stopPropagation();
    }
    // Compute previous image index with wrap-around
    this.activePhotoIndex =
      (this.activePhotoIndex - 1 + this.galleryImages.length) % this.galleryImages.length;
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Previous Photo in Lightbox', { newIndex: this.activePhotoIndex });
    // Request view change detection
    this.cdr.markForCheck();
  }

  nextPhoto(event?: MouseEvent): void {
    // Check if event was provided
    if (event) {
      // Halt event bubbling
      event.stopPropagation();
    }
    // Compute next image index with wrap-around
    this.activePhotoIndex = (this.activePhotoIndex + 1) % this.galleryImages.length;
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Next Photo in Lightbox', { newIndex: this.activePhotoIndex });
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Open the Multi-Step Checkout Modal
  openCheckoutModal(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Reserve / Book Now', {
      hotelId: this.hotel?.id,
      hotelName: this.hotel?.name,
      checkIn: this.checkInDate,
      checkOut: this.checkOutDate,
      nights: this.calculatedNights,
      guests: this.totalGuestsCount,
      totalAmountUsd: this.grandTotal,
      totalAmountInr: this.grandTotalInr
    });
    // Set initial checkout step to review
    this.checkoutStep = 'review';
    // Open checkout dialog modal
    this.isCheckoutModalOpen = true;
    // Reset confirmed booking state
    this.confirmedBooking = null;
    // Synchronize router query parameter for deep-link routing
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: 'review' },
      queryParamsHandling: 'merge'
    });
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Close the Checkout Modal
  closeCheckoutModal(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Close Checkout Modal');
    // Dismiss checkout modal dialog
    this.isCheckoutModalOpen = false;
    // Dismiss razorpay modal if open
    this.isRazorpayModalOpen = false;
    // Clear active OTP timer
    if (this.otpTimerRef) {
      // Clear interval timer
      clearInterval(this.otpTimerRef);
    }
    // Remove query parameter from URL for proper back navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: null, bookingId: null },
      queryParamsHandling: 'merge'
    });
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Proceed to next step in checkout flow with if-else condition and setTimeout async calling
  goToCheckoutStep(step: 'review' | 'guest_info' | 'payment'): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', `Proceed to Checkout Step: ${step}`, {
      targetStep: step,
      currentStep: this.checkoutStep
    });
    // Concept: if - else condition for step navigation
    if (step === 'guest_info') {
      // Transition to guest info step
      this.checkoutStep = 'guest_info';
      // Synchronize router query parameter
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { step: 'guest_info' },
        queryParamsHandling: 'merge'
      });
      // Request view change detection
      this.cdr.markForCheck();
    } else if (step === 'payment') {
      // Validate primary guest fields before proceeding
      const primaryControls = ['firstName', 'lastName', 'email', 'phone'];
      // Track validation flag
      let isValid = true;
      // Iterate primary form controls
      primaryControls.forEach(ctrl => {
        // Retrieve control with form.get()
        const c = this.checkoutForm.get(ctrl);
        // Mark control as touched to trigger CSS error states
        c?.markAsTouched();
        // Concept: if - else condition checking control validity
        if (c?.invalid) {
          // Invalidate form flag
          isValid = false;
        } else {
          // Valid control
        }
      });

      // Concept: if - else condition on form validity
      if (isValid) {
        // Activate payment transition spinner
        this.isProcessingPayment = true;
        // Concept: setTimeout for asynchronous transition simulation
        setTimeout(() => {
          // Deactivate payment transition spinner
          this.isProcessingPayment = false;
          // Set checkout step to payment
          this.checkoutStep = 'payment';
          // Assign mobile number from form control
          this.mobileNumber = this.checkoutForm.get('phone')?.value || '+91 98765 43210';
          // Synchronize router query parameter
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { step: 'payment' },
            queryParamsHandling: 'merge'
          });
          // Request view change detection
          this.cdr.markForCheck();
        }, 250);
      } else {
        // Log form validation warning
        console.warn('[HotelDetailsComponent] Primary guest form is invalid');
      }
    } else {
      // Transition to specified step
      this.checkoutStep = step;
      // Synchronize router query parameter
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { step: step },
        queryParamsHandling: 'merge'
      });
      // Request view change detection
      this.cdr.markForCheck();
    }
  }

  // Method: Auto-format card number with spaces every 4 digits
  onCardNumberInput(event: Event): void {
    // Cast target to HTMLInputElement
    const input = event.target as HTMLInputElement;
    // Check if input element exists
    if (input) {
      // Strip non-digits and limit to 16 characters
      let val = input.value.replace(/\D/g, '').substring(0, 16);
      // Insert space every 4 digits
      val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
      // Patch formatted value into reactive form
      this.checkoutForm.patchValue({ cardNumber: val }, { emitEvent: false });
    }
  }

  // Method: Auto-format expiry date MM/YY
  onExpiryInput(event: Event): void {
    // Cast target to HTMLInputElement
    const input = event.target as HTMLInputElement;
    // Check if input element exists
    if (input) {
      // Strip non-digits and limit to 4 characters
      let val = input.value.replace(/\D/g, '').substring(0, 4);
      // Insert slash after month
      if (val.length >= 3) {
        // Format as MM/YY
        val = `${val.substring(0, 2)}/${val.substring(2)}`;
      }
      // Patch formatted value into reactive form
      this.checkoutForm.patchValue({ expiryDate: val }, { emitEvent: false });
    }
  }

  // Method: Initiate Razorpay Gateway and send Mobile OTP
  openRazorpayGateway(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Launch Razorpay Gateway Modal', {
      amountInr: this.grandTotalInr,
      amountUsd: this.grandTotal,
      mobile: this.checkoutForm.get('phone')?.value || '+91 98765 43210'
    });
    // Extract mobile number from reactive checkout form
    this.mobileNumber = this.checkoutForm.get('phone')?.value || '+91 98765 43210';
    // Generate order ID via RazorpayService
    this.razorpayOrderId = this.razorpayService.generateOrderId(this.grandTotalInr);
    // Clear previous OTP error message
    this.otpError = '';
    // Clear previously entered mobile OTP
    this.mobileOtp = '';
    // Open Razorpay gateway modal
    this.isRazorpayModalOpen = true;
    // Trigger OTP sending
    this.sendRazorpayOtp();
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Send / Resend Mobile OTP with 30-second countdown timer and setTimeout async calling
  sendRazorpayOtp(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Send / Resend Razorpay Mobile OTP', {
      mobileNumber: this.mobileNumber
    });
    // Concept: if - else condition for phone validation
    if (this.mobileNumber && this.mobileNumber.trim().length >= 8) {
      // Reset OTP sent status
      this.isOtpSent = false;
      // Clear OTP error
      this.otpError = '';
      // Reset countdown timer to 30 seconds
      this.otpCountdown = 30;

      // Check if previous timer exists
      if (this.otpTimerRef) {
        // Clear active interval
        clearInterval(this.otpTimerRef);
      }

      // Concept: setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Concept: Calling RazorpayService method sendMobileOtp
        this.razorpayService.sendMobileOtp(this.mobileNumber).subscribe({
          next: (res) => {
            // Concept: if - else condition
            if (res && res.success) {
              // Mark OTP as sent
              this.isOtpSent = true;
              // Cache generated test OTP
              this.generatedOtp = res.testOtp;

              // Start countdown timer
              this.otpTimerRef = setInterval(() => {
                // Concept: if - else condition
                if (this.otpCountdown > 0) {
                  // Decrement countdown
                  this.otpCountdown--;
                } else {
                  // Clear timer interval
                  clearInterval(this.otpTimerRef);
                }
              }, 1000);
            } else {
              // Assign error message
              this.otpError = 'Failed to generate OTP.';
            }
            // Request view change detection
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Check if Error instance
            if (err instanceof Error) {
              // Assign error message
              this.otpError = err.message;
            } else {
              // Assign fallback error
              this.otpError = 'Failed to transmit OTP.';
            }
            // Request view change detection
            this.cdr.markForCheck();
          },
        });
      }, 250);
    } else {
      // Assign mobile validation error
      this.otpError = 'Please provide a valid mobile number.';
      // Request view change detection
      this.cdr.markForCheck();
    }
  }

  // Method: Auto-fill test OTP (123456) for instant user convenience
  autoFillTestOtp(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Auto-Fill Test OTP (123456)');
    // Assign demo OTP value
    this.mobileOtp = '123456';
    // Clear OTP error
    this.otpError = '';
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Verify Razorpay Mobile OTP and finalize booking with if-else conditions and setTimeout async calling
  verifyRazorpayOtpAndPay(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Verify Razorpay OTP & Pay', {
      orderId: this.razorpayOrderId,
      enteredOtp: this.mobileOtp,
      expectedOtp: this.generatedOtp
    });
    // Concept: if - else condition checking 6-digit OTP
    if (this.mobileOtp && this.mobileOtp.trim().length === 6) {
      // Activate verifying state spinner
      this.isVerifyingOtp = true;
      // Clear OTP error
      this.otpError = '';

      // Concept: setTimeout for asynchronous bank verification simulation
      setTimeout(() => {
        try {
          // Concept: Calling RazorpayService method verifyOtpAndPay
          this.razorpayService.verifyOtpAndPay(this.razorpayOrderId, this.mobileOtp, this.generatedOtp).subscribe({
            next: (res) => {
              // Concept: if - else condition
              if (res && res.success) {
                // Deactivate verifying state
                this.isVerifyingOtp = false;
                // Cache payment ID
                this.razorpayPaymentId = res.paymentId;
                // Dismiss razorpay modal
                this.isRazorpayModalOpen = false;
                // Finalize booking via service
                this.finalizeBookingWithPayment('razorpay', res.paymentId, this.razorpayOrderId);
              } else {
                // Deactivate verifying state
                this.isVerifyingOtp = false;
                // Assign verification error
                this.otpError = 'Payment authorization could not be verified.';
              }
              // Request view change detection
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              // Deactivate verifying state
              this.isVerifyingOtp = false;
              // Check if Error instance
              if (err instanceof Error) {
                // Assign error message
                this.otpError = err.message;
              } else {
                // Assign fallback error
                this.otpError = 'Payment authorization failed.';
              }
              // Request view change detection
              this.cdr.markForCheck();
            },
          });
        } catch (e: unknown) {
          // Deactivate verifying state
          this.isVerifyingOtp = false;
          // Check if Error instance
          if (e instanceof Error) {
            // Assign error message
            this.otpError = e.message;
          } else {
            // Assign fallback error
            this.otpError = 'Unexpected payment exception.';
          }
          // Request view change detection
          this.cdr.markForCheck();
        }
      }, 400);
    } else {
      // Assign invalid OTP format error
      this.otpError = 'Please enter the 6-digit OTP code (or click "Auto-fill 123456").';
      // Request view change detection
      this.cdr.markForCheck();
    }
  }

  // Method: Submit direct credit card / alternate payment with if-else condition and setTimeout async calling
  submitDirectPayment(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Submit Direct Payment Form', {
      paymentMethod: this.checkoutForm.get('paymentMethod')?.value,
      isValid: this.checkoutForm.valid
    });
    // Concept: if - else condition validating Reactive Form
    if (this.checkoutForm.valid) {
      // Retrieve payment method control value
      const paymentMethod = this.checkoutForm.get('paymentMethod')?.value;

      // Concept: if - else condition branching payment methods
      if (paymentMethod === 'razorpay') {
        // Launch razorpay gateway
        this.openRazorpayGateway();
      } else if (paymentMethod === 'credit_card') {
        // Activate processing state
        this.isProcessingPayment = true;
        // Concept: setTimeout for asynchronous card gateway processing
        setTimeout(() => {
          // Generate card payment ID
          const paymentId = `pay_card_${Math.random().toString(36).substring(2, 10)}`;
          // Finalize booking
          this.finalizeBookingWithPayment('credit_card', paymentId);
        }, 600);
      } else {
        // Activate processing state
        this.isProcessingPayment = true;
        // Concept: setTimeout for alternate payment
        setTimeout(() => {
          // Generate alternate payment ID
          const paymentId = `pay_alt_${Math.random().toString(36).substring(2, 10)}`;
          // Finalize booking
          this.finalizeBookingWithPayment(paymentMethod || 'paypal', paymentId);
        }, 500);
      }
    } else {
      // Mark all controls touched to expose field errors
      this.checkoutForm.markAllAsTouched();
      // Log validation warning
      console.warn('[HotelDetailsComponent] Checkout form has validation errors');
    }
  }

  // Method: Create final confirmed booking object in BookingService with if-else and setTimeout async calling
  private finalizeBookingWithPayment(method: any, paymentId: string, orderId?: string): void {
    // Concept: if - else condition checking hotel existence
    if (this.hotel) {
      // Extract form snapshot value
      const formVal = this.checkoutForm.value;

      // Build structured booking request object
      const request: BookingRequest = {
        hotelId: this.hotel.id,
        hotelName: this.hotel.name,
        hotelLocation: this.hotel.location,
        hotelImage: this.hotel.imageUrl,
        checkIn: this.checkInDate,
        checkOut: this.checkOutDate,
        nights: this.calculatedNights,
        guestsCount: this.totalGuestsCount,
        adultsCount: this.adultsCount,
        childrenCount: this.childrenCount,
        pricePerNight: this.hotel.price,
        baseTotal: this.basePriceTotal,
        cleaningFee: this.cleaningFeeTotal,
        serviceFee: this.serviceFeeTotal,
        discountAmount: this.discountTotal,
        grandTotal: this.grandTotal,
        grandTotalInr: this.grandTotalInr,
        primaryGuest: {
          firstName: formVal.firstName,
          lastName: formVal.lastName,
          email: formVal.email,
          phone: formVal.phone,
          isPrimary: true,
        },
        specialRequests: formVal.specialRequests,
        payment: {
          paymentMethod: method,
          cardNumber: formVal.cardNumber,
          cardHolder: formVal.cardHolder,
          expiryDate: formVal.expiryDate,
          cvv: formVal.cvv,
          mobileNumber: this.mobileNumber,
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId,
          otpVerified: true,
        },
      };

      // Set payment processing spinner to true
      this.isProcessingPayment = true;

      // Concept: setTimeout function in component.ts for asynchronous calling simulation
      setTimeout(() => {
        // Concept: Calling BookingService method createBooking
        this.bookingService
          .createBooking(request)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              // Deactivate payment processing spinner
              this.isProcessingPayment = false;
              // Request view change detection
              this.cdr.markForCheck();
            })
          )
          .subscribe({
            next: (confirmation: BookingConfirmation) => {
              // Concept: if - else condition
              if (confirmation && confirmation.bookingId) {
                // Assign confirmed booking confirmation
                this.confirmedBooking = confirmation;
                // Transition to confirmed step
                this.checkoutStep = 'confirmed';
                // Log confirmation action to browser DevTools console
                this.routeTracker.logClickAction('HotelDetailsComponent', 'Booking Successfully Confirmed & Recorded', {
                  bookingId: confirmation.bookingId,
                  hotel: this.hotel?.name,
                  paymentId: paymentId
                });
                // Synchronize router query parameters for confirmed booking receipt
                this.router.navigate([], {
                  relativeTo: this.route,
                  queryParams: { step: 'confirmed', bookingId: confirmation.bookingId },
                  queryParamsHandling: 'merge'
                });
                // Log confirmation debug trace
                console.debug('[HotelDetailsComponent] Booking confirmed via BookingService:', confirmation.bookingId);
              } else {
                // Log warning
                console.warn('[HotelDetailsComponent] Empty booking confirmation response');
              }
              // Request view change detection
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              // Check if Error instance
              if (err instanceof Error) {
                // Log specific error message
                console.error('[HotelDetailsComponent] Booking confirmation failed:', err.message);
              } else {
                // Log fallback unknown error
                console.error('[HotelDetailsComponent] Unknown booking error');
              }
            },
          });
      }, 400);
    } else {
      // Log hotel selection error
      console.error('[HotelDetailsComponent] Cannot book without an active hotel selection.');
      // Return early
      return;
    }
  }

  // Method: Navigate back to listings explore page
  goBackToListings(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Navigate Back to Listings (/listings)');
    // Perform router navigation
    this.router.navigate(['/listings']);
  }

  // Method: Navigate to home page
  goToHome(): void {
    // Log user click action to browser DevTools console
    this.routeTracker.logClickAction('HotelDetailsComponent', 'Navigate to Home (/)');
    // Perform router navigation
    this.router.navigate(['/']);
  }

  // Method: Toggle tax inclusion setting in price ledger
  toggleLedgerTaxSetting(): void {
    // Invert the show taxes in ledger boolean setting
    this.detailsSettings.showTaxesInLedger = !this.detailsSettings.showTaxesInLedger;
    // Log the changed settings state to console
    console.log('[HotelDetailsComponent:Settings] Toggled showTaxesInLedger:', this.detailsSettings.showTaxesInLedger);
    // Emit debug message for telemetry
    console.debug('[HotelDetailsComponent] Current details settings:', this.detailsSettings);
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Toggle compact summary density setting
  toggleSummaryDensitySetting(): void {
    // Invert compact summary flag
    this.detailsSettings.compactSummary = !this.detailsSettings.compactSummary;
    // Emit debug message
    console.debug('[HotelDetailsComponent:Settings] Compact summary set to:', this.detailsSettings.compactSummary);
    // Request view change detection
    this.cdr.markForCheck();
  }

  // Method: Request parent AppComponent to open auth modal via component dependency
  openAuthFromDetails(): void {
    // Check if injected parent AppComponent is available
    if (this.appComponent) {
      // Direct call into parent component method via component-to-component dependency
      this.appComponent.openAuthModal('login');
      // Log successful component-to-component interaction
      console.log('[HotelDetailsComponent] Triggered auth modal through parent AppComponent dependency');
    } else {
      // Emit warning if parent component is missing
      console.warn('[HotelDetailsComponent] Parent AppComponent reference not found');
    }
  }

  // Method: Handle input events in checkout reactive form fields
  onCheckoutInput(event: Event, fieldName: string): void {
    // Cast event target to HTMLInputElement
    const inputEl = event.target as HTMLInputElement;
    // Retrieve value from input element
    const val = inputEl ? inputEl.value : '';
    // Emit debug logging for form input change
    console.debug(`[HotelDetailsComponent:Form] Input event on field "${fieldName}":`, val);
  }

  // Method: Handle keyup events in checkout form
  onCheckoutKeyUp(event: KeyboardEvent): void {
    // Emit debug log for key released
    console.debug('[HotelDetailsComponent:Form] KeyUp event key:', event.key);
    // Check if user pressed Escape key
    if (event.key === 'Escape') {
      // Log warning when user triggers escape key
      console.warn('[HotelDetailsComponent:Form] User pressed Escape key during checkout input');
    }
  }

  // Method: Handle keydown.enter events in checkout form
  onCheckoutEnter(event: Event): void {
    // Prevent default form submission enter action
    event.preventDefault();
    // Emit log message for Enter key submission intent
    console.log('[HotelDetailsComponent:Form] Enter key pressed on checkout form input');
    // Check if checkout form is valid on guest info step
    if (this.checkoutStep === 'guest_info' && this.checkoutForm.get('firstName')?.valid && this.checkoutForm.get('email')?.valid) {
      // Advance to payment step automatically
      this.goToCheckoutStep('payment');
    }
  }

  // LifeCycle Hook: ngOnDestroy cleanup
  ngOnDestroy(): void {
    if (this.otpTimerRef) {
      clearInterval(this.otpTimerRef);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
