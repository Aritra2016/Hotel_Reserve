import { Hotel } from './hotel.model';

// Model: Interface for individual guest details
export interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

// Model: Interface for payment details supporting Card, Razorpay, UPI, PayPal, Apple Pay
export interface PaymentInfo {
  paymentMethod: 'razorpay' | 'credit_card' | 'upi' | 'paypal' | 'apple_pay';
  cardNumber?: string;
  cardHolder?: string;
  expiryDate?: string;
  cvv?: string;
  upiId?: string;
  mobileNumber?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  otpVerified?: boolean;
}

// Model: Interface for complete booking reservation request
export interface BookingRequest {
  hotelId: number;
  hotelName: string;
  hotelLocation: string;
  hotelImage: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  adultsCount: number;
  childrenCount: number;
  pricePerNight: number;
  baseTotal: number;
  cleaningFee: number;
  serviceFee: number;
  discountAmount: number;
  grandTotal: number;
  grandTotalInr: number;
  primaryGuest: GuestInfo;
  additionalGuests?: GuestInfo[];
  specialRequests?: string;
  payment: PaymentInfo;
}

// Model: Interface for confirmed booking record with reference ID
export interface BookingConfirmation {
  bookingId: string; // e.g. "SE-839201"
  status: 'confirmed' | 'pending' | 'cancelled';
  createdAt: string;
  request: BookingRequest;
  hotel?: Hotel;
}
