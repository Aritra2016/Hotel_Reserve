import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, FormArray, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize, tap } from 'rxjs/operators';
import { Hotel } from '../../../core/models/hotel.model';
import { BookingConfirmation, BookingRequest } from '../../../core/models/booking.model';
import { HotelService } from '../../../core/services/hotel.service';
import { BookingService } from '../../../core/services/booking.service';
import { RazorpayService } from '../../../core/services/razorpay.service';

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

  // Concept: Constructor injecting Router, ActivatedRoute, FormBuilder, HotelService, BookingService, RazorpayService, and ChangeDetectorRef
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private hotelService: HotelService,
    private bookingService: BookingService,
    public razorpayService: RazorpayService,
    private cdr: ChangeDetectorRef
  ) {}

  // LifeCycle Hook: ngOnInit initializes dates, reactive forms, and queries route parameters
  ngOnInit(): void {
    // Initialize default check-in and check-out dates
    this.initDefaultDates();

    // Build reactive checkout form with FormControls and FormArray
    this.buildCheckoutForm();

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
    this.checkInDate = val;
    const start = new Date(val);
    if (start instanceof Date && !isNaN(start.getTime())) {
      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + 1);
      this.minCheckOutDate = nextDay.toISOString().split('T')[0];

      if (new Date(this.checkOutDate) <= start) {
        this.checkOutDate = this.minCheckOutDate;
      }
    }
  }

  onCheckOutChange(val: string): void {
    this.checkOutDate = val;
  }

  // Method: Update adult or children counter steppers
  updateGuests(type: 'adults' | 'children', delta: number): void {
    if (type === 'adults') {
      const maxAllowed = this.hotel?.maxGuests || 6;
      this.adultsCount = Math.max(1, Math.min(maxAllowed, this.adultsCount + delta));
    } else {
      this.childrenCount = Math.max(0, Math.min(6, this.childrenCount + delta));
    }
  }

  // Method: Toggle and close guests selection dropdown
  toggleGuestsDropdown(): void {
    this.isGuestsDropdownOpen = !this.isGuestsDropdownOpen;
  }

  closeGuestsDropdown(): void {
    this.isGuestsDropdownOpen = false;
  }

  // Method: Stop click event propagation to parent elements
  stopEventPropagation(event: MouseEvent | Event): void {
    event.stopPropagation();
  }

  // Method: Dismiss the Razorpay gateway modal
  closeRazorpayModal(): void {
    this.isRazorpayModalOpen = false;
  }

  // Method: Toggle wishlist favorite state
  toggleFavorite(): void {
    if (this.hotel?.id) {
      this.hotelService.toggleFavorite(this.hotel.id);
      this.isFavorite = this.hotelService.isFavorite(this.hotel.id);
    }
  }

  // Method: Share listing link with temporary notification toast
  onShare(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
    this.showShareToast = true;
    // Concept: setTimeout to dismiss toast after 2.5s
    setTimeout(() => {
      this.showShareToast = false;
    }, 2500);
  }

  // Method: Lightbox gallery controls
  openLightbox(index: number = 0): void {
    this.activePhotoIndex = index;
    this.isLightboxOpen = true;
  }

  closeLightbox(): void {
    this.isLightboxOpen = false;
  }

  prevPhoto(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.activePhotoIndex =
      (this.activePhotoIndex - 1 + this.galleryImages.length) % this.galleryImages.length;
  }

  nextPhoto(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.activePhotoIndex = (this.activePhotoIndex + 1) % this.galleryImages.length;
  }

  // Method: Open the Multi-Step Checkout Modal
  openCheckoutModal(): void {
    this.checkoutStep = 'review';
    this.isCheckoutModalOpen = true;
    this.confirmedBooking = null;
  }

  // Method: Close the Checkout Modal
  closeCheckoutModal(): void {
    this.isCheckoutModalOpen = false;
    this.isRazorpayModalOpen = false;
    if (this.otpTimerRef) {
      clearInterval(this.otpTimerRef);
    }
  }

  // Method: Proceed to next step in checkout flow with if-else condition and setTimeout async calling
  goToCheckoutStep(step: 'review' | 'guest_info' | 'payment'): void {
    // Concept: if - else condition for step navigation
    if (step === 'guest_info') {
      this.checkoutStep = 'guest_info';
    } else if (step === 'payment') {
      // Validate primary guest fields before proceeding
      const primaryControls = ['firstName', 'lastName', 'email', 'phone'];
      let isValid = true;
      primaryControls.forEach(ctrl => {
        const c = this.checkoutForm.get(ctrl);
        c?.markAsTouched();
        // Concept: if - else condition checking control validity
        if (c?.invalid) {
          isValid = false;
        } else {
          // valid control
        }
      });

      // Concept: if - else condition on form validity
      if (isValid) {
        this.isProcessingPayment = true;
        // Concept: setTimeout for asynchronous transition
        setTimeout(() => {
          this.isProcessingPayment = false;
          this.checkoutStep = 'payment';
          this.mobileNumber = this.checkoutForm.get('phone')?.value || '+91 98765 43210';
          this.cdr.markForCheck();
        }, 250);
      } else {
        console.warn('[HotelDetailsComponent] Primary guest form is invalid');
      }
    } else {
      this.checkoutStep = step;
    }
  }

  // Method: Auto-format card number with spaces every 4 digits
  onCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      let val = input.value.replace(/\D/g, '').substring(0, 16);
      val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
      this.checkoutForm.patchValue({ cardNumber: val }, { emitEvent: false });
    }
  }

  // Method: Auto-format expiry date MM/YY
  onExpiryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      let val = input.value.replace(/\D/g, '').substring(0, 4);
      if (val.length >= 3) {
        val = `${val.substring(0, 2)}/${val.substring(2)}`;
      }
      this.checkoutForm.patchValue({ expiryDate: val }, { emitEvent: false });
    }
  }

  // Method: Initiate Razorpay Gateway and send Mobile OTP
  openRazorpayGateway(): void {
    this.mobileNumber = this.checkoutForm.get('phone')?.value || '+91 98765 43210';
    this.razorpayOrderId = this.razorpayService.generateOrderId(this.grandTotalInr);
    this.otpError = '';
    this.mobileOtp = '';
    this.isRazorpayModalOpen = true;
    this.sendRazorpayOtp();
  }

  // Method: Send / Resend Mobile OTP with 30-second countdown timer and setTimeout async calling
  sendRazorpayOtp(): void {
    // Concept: if - else condition for phone validation
    if (this.mobileNumber && this.mobileNumber.trim().length >= 8) {
      this.isOtpSent = false;
      this.otpError = '';
      this.otpCountdown = 30;

      if (this.otpTimerRef) {
        clearInterval(this.otpTimerRef);
      }

      // Concept: setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Concept: Calling RazorpayService method sendMobileOtp
        this.razorpayService.sendMobileOtp(this.mobileNumber).subscribe({
          next: (res) => {
            // Concept: if - else condition
            if (res && res.success) {
              this.isOtpSent = true;
              this.generatedOtp = res.testOtp;

              // Start countdown timer
              this.otpTimerRef = setInterval(() => {
                // Concept: if - else condition
                if (this.otpCountdown > 0) {
                  this.otpCountdown--;
                } else {
                  clearInterval(this.otpTimerRef);
                }
              }, 1000);
            } else {
              this.otpError = 'Failed to generate OTP.';
            }
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            if (err instanceof Error) {
              this.otpError = err.message;
            } else {
              this.otpError = 'Failed to transmit OTP.';
            }
            this.cdr.markForCheck();
          },
        });
      }, 250);
    } else {
      this.otpError = 'Please provide a valid mobile number.';
    }
  }

  // Method: Auto-fill test OTP (123456) for instant user convenience
  autoFillTestOtp(): void {
    this.mobileOtp = '123456';
    this.otpError = '';
  }

  // Method: Verify Razorpay Mobile OTP and finalize booking with if-else conditions and setTimeout async calling
  verifyRazorpayOtpAndPay(): void {
    // Concept: if - else condition checking 6-digit OTP
    if (this.mobileOtp && this.mobileOtp.trim().length === 6) {
      this.isVerifyingOtp = true;
      this.otpError = '';

      // Concept: setTimeout for asynchronous bank verification simulation
      setTimeout(() => {
        try {
          // Concept: Calling RazorpayService method verifyOtpAndPay
          this.razorpayService.verifyOtpAndPay(this.razorpayOrderId, this.mobileOtp, this.generatedOtp).subscribe({
            next: (res) => {
              // Concept: if - else condition
              if (res && res.success) {
                this.isVerifyingOtp = false;
                this.razorpayPaymentId = res.paymentId;
                this.isRazorpayModalOpen = false;
                // Finalize booking via service
                this.finalizeBookingWithPayment('razorpay', res.paymentId, this.razorpayOrderId);
              } else {
                this.isVerifyingOtp = false;
                this.otpError = 'Payment authorization could not be verified.';
              }
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              this.isVerifyingOtp = false;
              if (err instanceof Error) {
                this.otpError = err.message;
              } else {
                this.otpError = 'Payment authorization failed.';
              }
              this.cdr.markForCheck();
            },
          });
        } catch (e: unknown) {
          this.isVerifyingOtp = false;
          if (e instanceof Error) {
            this.otpError = e.message;
          } else {
            this.otpError = 'Unexpected payment exception.';
          }
          this.cdr.markForCheck();
        }
      }, 400);
    } else {
      this.otpError = 'Please enter the 6-digit OTP code (or click "Auto-fill 123456").';
    }
  }

  // Method: Submit direct credit card / alternate payment with if-else condition and setTimeout async calling
  submitDirectPayment(): void {
    // Concept: if - else condition validating Reactive Form
    if (this.checkoutForm.valid) {
      const paymentMethod = this.checkoutForm.get('paymentMethod')?.value;

      // Concept: if - else condition branching payment methods
      if (paymentMethod === 'razorpay') {
        this.openRazorpayGateway();
      } else if (paymentMethod === 'credit_card') {
        this.isProcessingPayment = true;
        // Concept: setTimeout for asynchronous card gateway processing
        setTimeout(() => {
          const paymentId = `pay_card_${Math.random().toString(36).substring(2, 10)}`;
          this.finalizeBookingWithPayment('credit_card', paymentId);
        }, 600);
      } else {
        this.isProcessingPayment = true;
        // Concept: setTimeout for alternate payment
        setTimeout(() => {
          const paymentId = `pay_alt_${Math.random().toString(36).substring(2, 10)}`;
          this.finalizeBookingWithPayment(paymentMethod || 'paypal', paymentId);
        }, 500);
      }
    } else {
      this.checkoutForm.markAllAsTouched();
      console.warn('[HotelDetailsComponent] Checkout form has validation errors');
    }
  }

  // Method: Create final confirmed booking object in BookingService with if-else and setTimeout async calling
  private finalizeBookingWithPayment(method: any, paymentId: string, orderId?: string): void {
    // Concept: if - else condition checking hotel existence
    if (this.hotel) {
      const formVal = this.checkoutForm.value;

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

      this.isProcessingPayment = true;

      // Concept: setTimeout function in component.ts for asynchronous calling simulation
      setTimeout(() => {
        // Concept: Calling BookingService method createBooking
        this.bookingService
          .createBooking(request)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              this.isProcessingPayment = false;
              this.cdr.markForCheck();
            })
          )
          .subscribe({
            next: (confirmation: BookingConfirmation) => {
              // Concept: if - else condition
              if (confirmation && confirmation.bookingId) {
                this.confirmedBooking = confirmation;
                this.checkoutStep = 'confirmed';
                console.debug('[HotelDetailsComponent] Booking confirmed via BookingService:', confirmation.bookingId);
              } else {
                console.warn('[HotelDetailsComponent] Empty booking confirmation response');
              }
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              if (err instanceof Error) {
                console.error('[HotelDetailsComponent] Booking confirmation failed:', err.message);
              } else {
                console.error('[HotelDetailsComponent] Unknown booking error');
              }
            },
          });
      }, 400);
    } else {
      console.error('[HotelDetailsComponent] Cannot book without an active hotel selection.');
      return;
    }
  }

  // Method: Navigate back to listings explore page
  goBackToListings(): void {
    this.router.navigate(['/listings']);
  }

  // Method: Navigate to home page
  goToHome(): void {
    this.router.navigate(['/']);
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
