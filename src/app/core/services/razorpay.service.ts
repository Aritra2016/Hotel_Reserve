import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';

// Service: Handles Razorpay Free Sandbox API integration and Mobile OTP payment verification
@Injectable({ providedIn: 'root' })
export class RazorpayService {
  // Concept: Free Razorpay Sandbox Test Key ID
  readonly RAZORPAY_TEST_KEY = 'rzp_test_1DP5mmOlF5G5ag';

  // Concept: USD to INR conversion multiplier for Indian Razorpay processing
  readonly USD_TO_INR_RATE = 83;

  // Method: Calculate INR equivalent from USD
  convertToInr(usdAmount: number): number {
    return Math.round(usdAmount * this.USD_TO_INR_RATE);
  }

  // Method: Generate a simulated Razorpay Order ID
  generateOrderId(amountInr: number): string {
    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
    const orderId = `order_rzp_${randomStr}`;
    console.debug(`[RazorpayService] Created order ${orderId} for ₹${amountInr}`);
    return orderId;
  }

  // Method: Send simulated 6-digit Mobile OTP to user's phone number
  sendMobileOtp(phone: string): Observable<{ success: boolean; testOtp: string; message: string }> {
    const testOtp = '123456';
    console.debug(`[RazorpayService] Sent OTP ${testOtp} to mobile: ${phone}`);
    return of({
      success: true,
      testOtp,
      message: `OTP sent successfully to ${phone}`,
    }).pipe(delay(400));
  }

  // Method: Verify OTP and complete Razorpay transaction
  verifyOtpAndPay(orderId: string, inputOtp: string, expectedOtp: string = '123456'): Observable<{ success: boolean; paymentId: string }> {
    const isValid = inputOtp.trim() === expectedOtp || inputOtp.trim() === '123456';
    if (!isValid) {
      throw new Error('Invalid OTP. Please enter the correct 6-digit OTP code (e.g. 123456).');
    }

    const randomPay = Math.random().toString(36).substring(2, 12).toLowerCase();
    const paymentId = `pay_rzp_${randomPay}`;

    return of({
      success: true,
      paymentId,
    }).pipe(
      delay(800),
      tap(res => console.debug(`[RazorpayService] Payment verified! Payment ID: ${res.paymentId}`))
    );
  }
}
