import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  // Inject authentication service to retrieve credentials and tokens
  constructor(private authService: AuthService) {}

  // Intercept outgoing HTTP requests and incoming responses
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Generate unique correlation ID for end-to-end request tracing
    const correlationId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Generate ISO timestamp string
    const timestamp = new Date().toISOString();

    // Query active authenticated user profile snapshot
    const currentUser = this.authService.currentUserValue;

    // Determine authorization header value
    const authToken = currentUser?.id ? `Bearer token_usr_${currentUser.id}` : 'Bearer guest_token_anon';

    // Clone request to attach telemetry and authorization headers
    const clonedReq = req.clone({
      setHeaders: {
        'X-Correlation-Id': correlationId,
        'X-Timestamp': timestamp,
        'X-Client-App': 'StayEase-Angular-Client',
        Authorization: authToken,
      },
    });

    // Log intercepted outgoing HTTP request for debugging diagnostics
    console.debug(`[ApiInterceptor:DEBUG] 🌐 Intercepting HTTP Request: [${req.method}] ${req.urlWithParams}`);

    // Log outgoing HTTP request telemetry to console
    console.log(`[ApiInterceptor:LOG] 🚀 Transmitting HTTP Request: [${clonedReq.method}] ${clonedReq.url}`, {
      correlationId: correlationId,
      timestamp: timestamp,
      headers: clonedReq.headers.keys(),
    });

    // Forward cloned request through the HTTP handler pipeline
    return next.handle(clonedReq).pipe(
      // Tap into successful HTTP response lifecycle event
      tap((event: HttpEvent<any>) => {
        // Verify if event is an instance of HttpResponse
        if (event instanceof HttpResponse) {
          // Log successful response receipt to console
          console.log(`[ApiInterceptor:LOG] ✅ HTTP Response Received: [${event.status}] ${clonedReq.url}`, {
            status: event.status,
            statusText: event.statusText,
            correlationId: correlationId,
          });
        }
      }),
      // Catch and handle HTTP errors gracefully
      catchError((error: unknown) => {
        // Verify if error is an instance of HttpErrorResponse
        if (error instanceof HttpErrorResponse) {
          // Log warning message regarding intercepted HTTP error
          console.warn(`[ApiInterceptor:WARN] ⚠️ HTTP Request Failed: [${error.status}] ${clonedReq.url}`, {
            status: error.status,
            message: error.message,
            correlationId: correlationId,
          });
        } else {
          // Log general warning for unknown request anomalies
          console.warn('[ApiInterceptor:WARN] ⚠️ Non-HTTP error encountered during request interception:', error);
        }

        // Rethrow error to downstream observers
        return throwError(() => error);
      })
    );
  }
}
