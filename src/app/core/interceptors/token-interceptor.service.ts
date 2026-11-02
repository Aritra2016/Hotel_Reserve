import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LoadingService } from '../services/loading.service';

@Injectable()
export class TokenInterceptorService implements HttpInterceptor {
  // Inject authentication and loading services
  constructor(
    private authService: AuthService,
    private loadingService: LoadingService
  ) {}

  // Intercept outgoing HTTP requests and incoming responses
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Full request URL
    const url = req.url.startsWith('http') ? req.url : 'https://services-ede-dev.sero.wh.rnd.internal.ericsson.com' + req.url;
    // Log intercepted outgoing request URL
    console.log('Interceptor called for URL:\n' + url);
    // Create correlation ID
    const correlationId = 'req_' + Date.now();
    // Display activity loader via LoadingService
    console.log('Loader shown');
    this.loadingService.show();

    // Query current user token
    const user = this.authService.currentUserValue;
    // Token variable
    const token = user?.id ? 'Bearer token_usr_' + user.id : 'Bearer guest_token_anon';
    // Clone request with token
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: token,
        'X-Correlation-Id': correlationId,
      },
    });

    // Handler stream
    return next.handle(clonedReq).pipe(
      // Tap for handling request with token
      tap(() => console.log('Handling request with token')),
      // Finalize when completed or errored
      finalize(() => {
        // Hide loader on token path
        console.log('Hiding loader (token path)');
        this.loadingService.hide();
      })
    );
  }
}
