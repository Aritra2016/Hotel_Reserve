import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
  Optional,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { AppComponent } from '../../../app.component';

@Component({
  selector: 'app-auth-modal',
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.css'],
})
export class AuthModalComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // Input: Controls the visibility overlay of the authentication modal dialog
  @Input() isOpen = false;

  // Input: Determines initial tab view ('login' or 'signup')
  @Input() initialTab: 'login' | 'signup' = 'login';

  // Output: Emits when user closes the modal dialog backdrop or button
  @Output() close = new EventEmitter<void>();

  // Output: Emits authenticated user instance upon successful login or registration
  @Output() loginSuccess = new EventEmitter<User>();

  // Output: Emits active tab changes to notifying parent components
  @Output() tabChange = new EventEmitter<'login' | 'signup'>();

  // Active tab state tracker
  activeTab: 'login' | 'signup' = 'login';

  // Active authentication channel method
  authMethod: 'email' | 'phone' = 'email';

  // Reactive form groups for distinct authentication strategies
  loginForm!: FormGroup;
  signupForm!: FormGroup;
  phoneForm!: FormGroup;

  // Password visibility toggle states
  showPassword = false;
  showSignupPassword = false;

  // Async processing and notification message state indicators
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Phone OTP flow state parameters
  otpSent = false;
  otpCountdown = 0;
  private timerInterval: any;

  // Map: Key-value lookup mapping demo user roles to descriptive labels
  demoRolesMap = new Map<string, string>([
    ['guest', 'Standard Guest Traveler Account'],
    ['host', 'Verified Property Superhost Account'],
    ['vip', 'Diamond VIP Luxury Traveler Account'],
  ]);

  // Map: Key-value lookup mapping social SSO providers to provider details
  socialProvidersMap = new Map<string, string>([
    ['google', 'Google Workspace Single Sign-On'],
    ['apple', 'Apple ID Biometric Authentication'],
    ['facebook', 'Meta Platform Single Sign-On'],
  ]);

  // Set: Whitelist of valid demo login roles for defensive verification
  validDemoRolesSet = new Set<string>(['guest', 'host', 'vip']);

  // Set: Whitelist of supported external OAuth identity providers
  supportedSocialProvidersSet = new Set<string>(['google', 'apple', 'facebook']);

  // Map: Data structure mapping authentication channels to human-readable descriptors
  authChannelsMap = new Map<string, string>([
    ['email', 'Email & Password Authentication'],
    ['phone', 'Mobile SMS OTP Verification'],
    ['social', 'Federated OAuth (Google / Apple)']
  ]);

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
    // Component Dependency: Injected host AppComponent
    @Optional() private appComponent?: AppComponent
  ) {}

  // LifeCycle Hook: ngOnInit initializes forms and active tab state
  ngOnInit(): void {
    // Set initial active tab from input property
    this.activeTab = this.initialTab;

    // Expose authChannelsMap globally on window for console inspection
    (window as any).authChannelsMap = this.authChannelsMap;
    // Log with console.debug for Verbose level
    console.debug('Map data (authChannelsMap):', this.authChannelsMap);
    console.debug(this.authChannelsMap);
    // Log authentication channels map data to console for Info level
    console.log('Map data (authChannelsMap):', this.authChannelsMap);
    // Log raw Map object for console tree inspection
    console.log(this.authChannelsMap);

    // Initialize reactive form structures and validators
    this.initForms();
  }

  // LifeCycle Hook: ngOnChanges responds to parent state property updates
  ngOnChanges(changes: SimpleChanges): void {
    // Check if initialTab input was modified by parent
    if (changes?.['initialTab'] && this.initialTab) {
      // Synchronize active tab with new parent input value
      this.activeTab = this.initialTab;
    }

    // Check if modal dialog was opened by parent
    if (changes?.['isOpen'] && this.isOpen) {
      // Reset active tab to initial desired view
      this.activeTab = this.initialTab;

      // Clear previous error messages
      this.errorMessage = null;

      // Clear previous success notices
      this.successMessage = null;

      // Reset loading flag
      this.isLoading = false;

      // Request change detection update
      this.cdr.markForCheck();
    }
  }

  // LifeCycle Hook: ngAfterViewInit runs after view elements are rendered
  ngAfterViewInit(): void {
    // Output diagnostics for attached modal view
    console.debug('[AuthModalComponent] Auth modal dialog rendered into DOM');
  }

  // Method: Initialize reactive form groups with field validation rules
  private initForms(): void {
    // Construct email login reactive form group
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      rememberMe: [true],
    });

    // Construct account registration reactive form group
    this.signupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['+91 98765 43210'],
      agreeTerms: [true, Validators.requiredTrue],
    });

    // Construct phone number OTP verification reactive form group
    this.phoneForm = this.fb.group({
      phone: ['+91 98765 43210', [Validators.required, Validators.minLength(10)]],
      otp: ['', [Validators.minLength(6), Validators.maxLength(6)]],
    });
  }

  // Method: Calculate cumulative character length across active login form fields
  get loginFormCharCount(): number {
    // Extract array of current raw form control values
    const formValues: (string | null)[] = [
      this.loginForm.get('email')?.value,
      this.loginForm.get('password')?.value,
    ];

    // Reduce: Accumulate trimmed string lengths into a single total integer
    return formValues.reduce(
      (accum: number, currentVal: string | null) =>
        accum + (currentVal ? currentVal.trim().length : 0),
      0
    );
  }

  // Method: Return filtered list of available demo roles from set
  get availableDemoRoles(): string[] {
    // Array.from: Convert valid demo roles Set into standard array
    const rolesArray = Array.from(this.validDemoRolesSet);

    // Filter: Filter roles that exist in the descriptions Map
    return rolesArray.filter((role: string) => this.demoRolesMap.has(role));
  }

  // Method: Switch modal between login and signup tabs
  switchTab(tab: 'login' | 'signup'): void {
    // Log user click action to browser DevTools console
    console.log(`[AuthModalComponent:onClick] 👆 Switch Auth Tab to: "${tab}"`);

    // Update active tab property
    this.activeTab = tab;

    // Clear existing error messages
    this.errorMessage = null;

    // Clear existing success messages
    this.successMessage = null;

    // Output: Emit tab switch event
    this.tabChange.emit(tab);

    // Trigger view change detection
    this.cdr.markForCheck();
  }

  // Method: Switch primary authentication channel between email and mobile OTP
  setAuthMethod(method: 'email' | 'phone'): void {
    // Assign chosen authentication strategy
    this.authMethod = method;

    // Clear previous error messages
    this.errorMessage = null;
  }

  // Method: Handle email & password login form submission
  onSubmitLogin(): void {
    // Check if reactive form validation constraints are satisfied
    if (this.loginForm.valid) {
      // Set asynchronous loading indicator
      this.isLoading = true;

      // Reset alert feedback
      this.errorMessage = null;

      // Extract and sanitize email credential value using trim
      const email = this.loginForm.get('email')?.value?.trim();

      // Extract password credential value using form.get
      const password = this.loginForm.get('password')?.value;

      // Extract rememberMe choice using form.get
      const rememberMe = this.loginForm.get('rememberMe')?.value ?? true;

      // setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Call AuthService login method passing sanitized credentials
        this.authService
          .login({ email, password, rememberMe })
          .subscribe({
            next: (user: User) => {
              // Check if valid user object was returned with an identifier
              if (user && user?.id) {
                // Clear loading spinner
                this.isLoading = false;

                // Set friendly confirmation banner
                this.successMessage = `Welcome back, ${user.name}!`;

                // setTimeout for delayed modal dismissal to show greeting
                setTimeout(() => {
                  // Output: Emit successful authentication event
                  this.loginSuccess.emit(user);

                  // Close modal dialog
                  this.onClose();
                }, 500);
              } else {
                // Deactivate loading state
                this.isLoading = false;

                // Display profile verification failure message
                this.errorMessage = 'User profile could not be verified.';
              }

              // Trigger view change detection
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              // Deactivate loading state
              this.isLoading = false;

              // Check if error is a JavaScript Error instance
              if (err instanceof Error) {
                // Assign error message from caught exception
                this.errorMessage = err.message;
              } else {
                // Display fallback generic error message
                this.errorMessage = 'Login failed. Please check your credentials.';
              }

              // Trigger view change detection
              this.cdr.markForCheck();
            },
          });
      }, 350);
    } else {
      // Mark all form controls as touched to display validation errors
      this.loginForm.markAllAsTouched();

      // Display validation warning message
      this.errorMessage = 'Please provide a valid email address and password.';
    }
  }

  // Method: Handle new user registration form submission
  onSubmitSignup(): void {
    // Check if signup reactive form passes all validation rules
    if (this.signupForm.valid) {
      // Set asynchronous loading indicator
      this.isLoading = true;

      // Reset alert feedback
      this.errorMessage = null;

      // Extract and sanitize name field using trim
      const name = this.signupForm.get('name')?.value?.trim();

      // Extract and sanitize email field using trim
      const email = this.signupForm.get('email')?.value?.trim();

      // Extract password field value
      const password = this.signupForm.get('password')?.value;

      // Extract and sanitize phone field using trim
      const phone = this.signupForm.get('phone')?.value?.trim();

      // Extract terms acceptance flag
      const agreeTerms = this.signupForm.get('agreeTerms')?.value;

      // setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Call AuthService signup method passing sanitized parameters
        this.authService
          .signup({ name, email, password, phone })
          .subscribe({
            next: (user: User) => {
              // Check if user registered successfully
              if (user && user?.id) {
                // Deactivate loading state
                this.isLoading = false;

                // Set welcome confirmation notice
                this.successMessage = `Account created! Welcome, ${user.name}!`;

                // setTimeout for delayed dialog close
                setTimeout(() => {
                  // Output: Emit successful login event with new user
                  this.loginSuccess.emit(user);

                  // Close modal dialog
                  this.onClose();
                }, 500);
              } else {
                // Deactivate loading state
                this.isLoading = false;

                // Display failure message
                this.errorMessage = 'Unable to complete user registration.';
              }

              // Trigger change detection
              this.cdr.markForCheck();
            },
            error: (err: unknown) => {
              // Deactivate loading state
              this.isLoading = false;

              // Check if error is instance of Error
              if (err instanceof Error) {
                // Assign caught error message
                this.errorMessage = err.message;
              } else {
                // Assign generic fallback message
                this.errorMessage = 'Registration failed. Please try again.';
              }

              // Trigger change detection
              this.cdr.markForCheck();
            },
          });
      }, 350);
    } else {
      // Mark all controls as touched to show validation errors in template
      this.signupForm.markAllAsTouched();

      // Display warning message
      this.errorMessage = 'Please complete all required fields and accept the terms.';
    }
  }

  // Method: Request SMS One-Time-Password for phone authentication
  sendOtp(): void {
    // Extract and trim mobile phone number value from phoneForm
    const phone = this.phoneForm.get('phone')?.value?.trim();

    // Check if phone number meets minimum length constraints
    if (phone && phone.length >= 8) {
      // Enable loading state
      this.isLoading = true;

      // Reset error message
      this.errorMessage = null;

      // setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Call AuthService sendPhoneOtp method passing sanitized number
        this.authService.sendPhoneOtp(phone).subscribe({
          next: (res: { success: boolean; message?: string }) => {
            // Check if OTP transmission was acknowledged
            if (res && res?.success) {
              // Disable loading state
              this.isLoading = false;

              // Mark OTP sent flag as true
              this.otpSent = true;

              // Pre-fill demo OTP code for evaluator convenience
              this.phoneForm.patchValue({ otp: '123456' });

              // Start 30-second countdown timer
              this.startOtpTimer();
            } else {
              // Disable loading state
              this.isLoading = false;

              // Display failure notice
              this.errorMessage = 'Failed to generate OTP code.';
            }

            // Trigger change detection
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Disable loading state
            this.isLoading = false;

            // Check if error is an Error instance
            if (err instanceof Error) {
              // Assign error description
              this.errorMessage = err.message;
            } else {
              // Fallback error description
              this.errorMessage = 'Failed to transmit OTP.';
            }

            // Trigger change detection
            this.cdr.markForCheck();
          },
        });
      }, 300);
    } else {
      // Display mobile number validation error
      this.errorMessage = 'Please enter a valid mobile number.';
    }
  }

  // Method: Verify entered SMS One-Time-Password code and authenticate
  verifyPhoneOtp(): void {
    // Extract and trim phone number value
    const phone = this.phoneForm.get('phone')?.value?.trim();

    // Extract and trim 6-digit OTP code value
    const otp = this.phoneForm.get('otp')?.value?.trim();

    // Check if OTP code is complete 6 characters
    if (otp && otp.length === 6) {
      // Enable loading state
      this.isLoading = true;

      // Clear previous error messages
      this.errorMessage = null;

      // setTimeout for asynchronous calling simulation
      setTimeout(() => {
        // Call AuthService loginWithPhone method
        this.authService.loginWithPhone(phone, otp).subscribe({
          next: (user: User) => {
            // Check if returned user is valid
            if (user && user?.id) {
              // Disable loading state
              this.isLoading = false;

              // Display authentication success notice
              this.successMessage = `Authenticated as ${user.name}!`;

              // setTimeout for delayed dialog close
              setTimeout(() => {
                // Output: Emit successful authentication event
                this.loginSuccess.emit(user);

                // Close modal dialog
                this.onClose();
              }, 500);
            } else {
              // Disable loading state
              this.isLoading = false;

              // Display failure error message
              this.errorMessage = 'Authentication could not be completed.';
            }

            // Trigger change detection
            this.cdr.markForCheck();
          },
          error: (err: unknown) => {
            // Disable loading state
            this.isLoading = false;

            // Check if error is Error instance
            if (err instanceof Error) {
              // Assign error message
              this.errorMessage = err.message;
            } else {
              // Fallback error message
              this.errorMessage = 'OTP verification failed.';
            }

            // Trigger change detection
            this.cdr.markForCheck();
          },
        });
      }, 350);
    } else {
      // Display incomplete OTP code notice
      this.errorMessage = 'Please enter the complete 6-digit OTP code.';
    }
  }

  // Method: Launch 30-second countdown for SMS resend button
  private startOtpTimer(): void {
    // Initialize countdown timer to 30 seconds
    this.otpCountdown = 30;

    // Clear any existing active timer interval
    clearInterval(this.timerInterval);

    // Start interval ticking every 1000 milliseconds
    this.timerInterval = setInterval(() => {
      // Check if timer countdown is still positive
      if (this.otpCountdown > 0) {
        // Decrement remaining countdown seconds
        this.otpCountdown--;
      } else {
        // Clear interval when countdown finishes
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  // Method: Instant 1-click preview login with pre-configured demo profiles
  onDemoLogin(role: 'guest' | 'host' | 'vip'): void {
    // Log user click action to browser DevTools console
    console.log('[AuthModalComponent:onClick] 👆 1-Click Demo Login clicked for role:', role);

    // Validate role using Set.has() check
    if (!this.validDemoRolesSet.has(role)) {
      // Log warning if unsupported role requested
      console.warn('[AuthModalComponent] Unsupported demo role attempted:', role);
      return;
    }

    // Set loading indicator
    this.isLoading = true;

    // Clear error message
    this.errorMessage = null;

    // setTimeout for asynchronous calling simulation
    setTimeout(() => {
      // Call AuthService loginAsDemo method
      this.authService.loginAsDemo(role).subscribe({
        next: (user: User) => {
          // Check if demo user returned successfully
          if (user && user?.id) {
            // Disable loading indicator
            this.isLoading = false;

            // Lookup role label from Map or fallback to uppercase role string
            const roleLabel = this.demoRolesMap.get(role) || role.toUpperCase();

            // Set greeting banner with uppercase role
            this.successMessage = `Logged in as ${user.name} (${user.role.toUpperCase()})!`;

            // setTimeout for delayed dialog close
            setTimeout(() => {
              // Output: Emit successful authentication event
              this.loginSuccess.emit(user);

              // Close modal dialog
              this.onClose();
            }, 400);
          } else {
            // Disable loading indicator
            this.isLoading = false;

            // Display failure notice
            this.errorMessage = 'Failed to load demo profile.';
          }

          // Trigger change detection
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          // Disable loading indicator
          this.isLoading = false;

          // Check if error is Error instance
          if (err instanceof Error) {
            // Assign error message
            this.errorMessage = err.message;
          } else {
            // Fallback error message
            this.errorMessage = 'Demo login failed.';
          }

          // Trigger change detection
          this.cdr.markForCheck();
        },
      });
    }, 250);
  }

  // Method: Single sign-on authentication through social providers
  onSocialLogin(provider: 'google' | 'apple' | 'facebook'): void {
    // Validate provider using Set.has() check
    if (!this.supportedSocialProvidersSet.has(provider)) {
      // Log warning for unsupported provider
      console.warn('[AuthModalComponent] Unsupported provider attempted:', provider);
      return;
    }

    // Set loading indicator
    this.isLoading = true;

    // Clear error message
    this.errorMessage = null;

    // setTimeout for asynchronous calling simulation
    setTimeout(() => {
      // Call AuthService loginWithSocial method
      this.authService.loginWithSocial(provider).subscribe({
        next: (user: User) => {
          // Check if returned user is valid
          if (user && user?.id) {
            // Disable loading indicator
            this.isLoading = false;

            // Output: Emit login success event
            this.loginSuccess.emit(user);

            // Close modal dialog
            this.onClose();
          } else {
            // Disable loading indicator
            this.isLoading = false;

            // Display provider error message
            this.errorMessage = 'Social sign-in was not completed.';
          }

          // Trigger change detection
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          // Disable loading indicator
          this.isLoading = false;

          // Check if error is Error instance
          if (err instanceof Error) {
            // Assign error message
            this.errorMessage = err.message;
          } else {
            // Fallback error message
            this.errorMessage = 'Social sign-in encountered an error.';
          }

          // Trigger change detection
          this.cdr.markForCheck();
        },
      });
    }, 250);
  }

  // Method: Toggle password mask on login form
  togglePasswordVisibility(): void {
    // Invert boolean visibility flag
    this.showPassword = !this.showPassword;
  }

  // Method: Toggle password mask on signup form
  toggleSignupPasswordVisibility(): void {
    // Invert boolean visibility flag
    this.showSignupPassword = !this.showSignupPassword;
  }

  // Method: Prevent modal backdrop dismissal when clicking inside dialog
  onDialogClick(event: MouseEvent): void {
    // Stop event propagation to modal backdrop
    event.stopPropagation();
  }

  // Method: Re-trigger phone OTP code transmission
  onResendOtp(): void {
    // Invoke sendOtp method
    this.sendOtp();
  }

  // Method: Close modal dialog and reset feedback states
  onClose(): void {
    // Log user click action to browser DevTools console
    console.log('[AuthModalComponent:onClick] 👆 Close Auth Modal');

    // Verify dependent host component
    if (this.appComponent) {
      // Log interaction with dependent parent
      console.debug('[AuthModalComponent] 🔗 Dependent AppComponent notified on auth modal dismissal');
    }

    // Clear error message
    this.errorMessage = null;

    // Clear success message
    this.successMessage = null;

    // Clear loading state
    this.isLoading = false;

    // Output: Emit close event to parent container
    this.close.emit();
  }


  // LifeCycle Hook: ngOnDestroy clears active countdown timers on component destruction
  ngOnDestroy(): void {
    // Check if interval handle exists
    if (this.timerInterval) {
      // Cancel active timer interval
      clearInterval(this.timerInterval);

      // Release timer reference
      this.timerInterval = null;
    }
  }
}
