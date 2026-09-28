import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
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

  // Concept: RxJS Subject for clean unsubscription
  private destroy$ = new Subject<void>();

  // Concept: Constructor injecting Router, ActivatedRoute, FormBuilder, HotelService, BookingService, and RazorpayService
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private hotelService: HotelService,
    private bookingService: BookingService,
    public razorpayService: RazorpayService
  ) {}

  // LifeCycle Hook: ngOnInit initializes dates, reactive forms, and queries route parameters
  ngOnInit(): void {
    // Concept: Initialize date restrictions
    this.initDefaultDates();

    // Concept: Build reactive checkout form with FormControls and FormArray
    this.buildCheckoutForm();

    // Concept: RxJS Observable listening to route :id parameter changes
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const idStr = params.get('id');
        if (idStr) {
          this.hotelId = parseInt(idStr, 10);
          this.fetchHotelDetails(this.hotelId);
        }
      });
  }

  // LifeCycle Hook: ngAfterViewInit executes after view rendering
  ngAfterViewInit(): void {
    // Concept: setTimeout demonstration to scroll to top smoothly
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Method: RxJS Subscribe pipeline querying hotel details by ID
  private fetchHotelDetails(id: number): void {
    this.isLoading = true;
    this.hotelService
      .getHotelById(id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: (hotel?: Hotel) => {
          if (hotel) {
            this.hotel = hotel;
            this.isFavorite = this.hotelService.isFavorite(hotel.id);
            this.buildCategorizedAmenities(hotel.amenities);

            // Concept: Debugging log
            console.debug(`[HotelDetailsComponent] Loaded details for hotel: ${hotel.name} ($${hotel.price}/night)`);
          } else {
            console.warn('[HotelDetailsComponent] Hotel not found for ID:', id);
          }
        },
        error: (err: unknown) => {
          // Concept: instanceof check for Error handling
          if (err instanceof Error) {
            console.error('[HotelDetailsComponent] Error fetching hotel:', err.message);
          }
        },
      });
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

  // Method: Proceed to next step in checkout flow
  goToCheckoutStep(step: 'review' | 'guest_info' | 'payment'): void {
    if (step === 'guest_info') {
      this.checkoutStep = 'guest_info';
    } else if (step === 'payment') {
      // Validate primary guest fields before proceeding
      const primaryControls = ['firstName', 'lastName', 'email', 'phone'];
      let isValid = true;
      primaryControls.forEach(ctrl => {
        const c = this.checkoutForm.get(ctrl);
        c?.markAsTouched();
        if (c?.invalid) isValid = false;
      });
      if (isValid) {
        this.checkoutStep = 'payment';
        this.mobileNumber = this.checkoutForm.get('phone')?.value || '+91 98765 43210';
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

  // Method: Send / Resend Mobile OTP with 30-second countdown timer
  sendRazorpayOtp(): void {
    this.isOtpSent = false;
    this.otpError = '';
    this.otpCountdown = 30;

    if (this.otpTimerRef) {
      clearInterval(this.otpTimerRef);
    }

    this.razorpayService.sendMobileOtp(this.mobileNumber).subscribe(res => {
      this.isOtpSent = true;
      this.generatedOtp = res.testOtp;

      // Start countdown
      this.otpTimerRef = setInterval(() => {
        if (this.otpCountdown > 0) {
          this.otpCountdown--;
        } else {
          clearInterval(this.otpTimerRef);
        }
      }, 1000);
    });
  }

  // Method: Auto-fill test OTP (123456) for instant user convenience
  autoFillTestOtp(): void {
    this.mobileOtp = '123456';
    this.otpError = '';
  }

  // Method: Verify Razorpay Mobile OTP and finalize booking
  verifyRazorpayOtpAndPay(): void {
    if (!this.mobileOtp || this.mobileOtp.trim().length !== 6) {
      this.otpError = 'Please enter the 6-digit OTP code (or click "Auto-fill 123456").';
      return;
    }

    this.isVerifyingOtp = true;
    this.otpError = '';

    try {
      this.razorpayService.verifyOtpAndPay(this.razorpayOrderId, this.mobileOtp, this.generatedOtp).subscribe({
        next: (res) => {
          this.isVerifyingOtp = false;
          this.razorpayPaymentId = res.paymentId;
          this.isRazorpayModalOpen = false;
          // Finalize booking
          this.finalizeBookingWithPayment('razorpay', res.paymentId, this.razorpayOrderId);
        },
        error: (err: unknown) => {
          this.isVerifyingOtp = false;
          if (err instanceof Error) {
            this.otpError = err.message;
          }
        },
      });
    } catch (e: unknown) {
      this.isVerifyingOtp = false;
      if (e instanceof Error) {
        this.otpError = e.message;
      }
    }
  }

  // Method: Submit direct credit card / alternate payment without Razorpay popup
  submitDirectPayment(): void {
    const paymentMethod = this.checkoutForm.get('paymentMethod')?.value;
    if (paymentMethod === 'razorpay') {
      this.openRazorpayGateway();
      return;
    }

    this.isProcessingPayment = true;
    const paymentId = `pay_card_${Math.random().toString(36).substring(2, 10)}`;
    this.finalizeBookingWithPayment(paymentMethod, paymentId);
  }

  // Method: Create final confirmed booking object in BookingService
  private finalizeBookingWithPayment(method: any, paymentId: string, orderId?: string): void {
    if (!this.hotel) return;
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

    this.bookingService
      .createBooking(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isProcessingPayment = false))
      )
      .subscribe({
        next: (confirmation: BookingConfirmation) => {
          this.confirmedBooking = confirmation;
          this.checkoutStep = 'confirmed';
          console.debug('[HotelDetailsComponent] Booking confirmed via Razorpay/Payment:', confirmation.bookingId);
        },
        error: (err: unknown) => {
          if (err instanceof Error) {
            console.error('[HotelDetailsComponent] Booking confirmation failed:', err.message);
          }
        },
      });
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
