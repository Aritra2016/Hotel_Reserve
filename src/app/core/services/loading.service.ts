import { Injectable } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  RouteConfigLoadStart,
  RouteConfigLoadEnd,
  Event as RouterEvent,
} from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  // BehaviorSubject tracking whether global loading is currently active
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.loadingSubject.asObservable();

  // BehaviorSubject tracking simulated or real progress percentage (0 - 100)
  private progressSubject = new BehaviorSubject<number>(0);
  public progress$: Observable<number> = this.progressSubject.asObservable();

  // BehaviorSubject tracking dynamic status message
  private messageSubject = new BehaviorSubject<string>('Loading StayEase...');
  public message$: Observable<string> = this.messageSubject.asObservable();

  // Counter to support reference counting across concurrent asynchronous requests
  private activeRequestsCount = 0;

  // Interval timer reference for simulated progress progression
  private progressTimerRef: any = null;

  // Timeout reference for fail-safe watchdog
  private safetyTimeoutRef: any = null;

  // Flag to avoid race conditions during route transitions
  private isRouteTransitioning = false;

  constructor(private router: Router) {
    this.initRouterListener();
  }

  // Method: Initialize subscription to Angular Router navigation events
  private initRouterListener(): void {
    this.router.events.subscribe((event: RouterEvent) => {
      if (event instanceof NavigationStart) {
        this.isRouteTransitioning = true;
        const targetUrl = event.url || '';
        const pageLabel = this.determinePageLabel(targetUrl);
        this.startLoading(`Loading ${pageLabel}...`);
      } else if (event instanceof RouteConfigLoadStart) {
        this.updateMessage('Loading module resources...');
      } else if (event instanceof RouteConfigLoadEnd) {
        this.incrementProgress(75);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isRouteTransitioning = false;
        this.completeLoading();
      }
    });
  }

  // Method: Helper to compute human-friendly page title for status message
  private determinePageLabel(url: string): string {
    if (!url || url === '/' || url === '') {
      return 'Home';
    }
    if (url.startsWith('/listings/') && url.length > 10) {
      return 'Stay Details';
    }
    if (url.startsWith('/listings')) {
      return 'Explore Stays';
    }
    return 'Page';
  }

  // Method: Trigger loading activation with progress animation
  public show(customMessage?: string): void {
    this.activeRequestsCount++;
    this.startLoading(customMessage || 'Loading StayEase...');
  }

  // Method: Trigger loading deactivation with ref-counting
  public hide(): void {
    this.activeRequestsCount = Math.max(0, this.activeRequestsCount - 1);
    // If no active HTTP requests and not in route transition, finalize
    if (this.activeRequestsCount === 0 && !this.isRouteTransitioning) {
      this.completeLoading();
    }
  }

  // Method: Explicitly force set loading state
  public setLoading(isLoading: boolean, message?: string): void {
    if (isLoading) {
      this.activeRequestsCount = Math.max(1, this.activeRequestsCount);
      this.startLoading(message);
    } else {
      this.activeRequestsCount = 0;
      this.isRouteTransitioning = false;
      this.completeLoading();
    }
  }

  // Method: Update current loading message
  public updateMessage(msg: string): void {
    this.messageSubject.next(msg);
  }

  // Internal: Start progress animation & activate loader
  private startLoading(message?: string): void {
    if (message) {
      this.messageSubject.next(message);
    }

    // Set active flag immediately
    this.loadingSubject.next(true);

    // Clear any existing progress timer
    if (this.progressTimerRef) {
      clearInterval(this.progressTimerRef);
      this.progressTimerRef = null;
    }

    // Start progress at initial baseline
    this.progressSubject.next(15);

    // Smoothly step progress forward up to 88% while waiting
    this.progressTimerRef = setInterval(() => {
      const current = this.progressSubject.value;
      if (current < 50) {
        this.progressSubject.next(current + 12);
      } else if (current < 75) {
        this.progressSubject.next(current + 6);
      } else if (current < 88) {
        this.progressSubject.next(current + 2);
      }
    }, 120);

    // Watchdog safety timeout: auto-hide after 10s if route or API hangs
    if (this.safetyTimeoutRef) {
      clearTimeout(this.safetyTimeoutRef);
    }
    this.safetyTimeoutRef = setTimeout(() => {
      if (this.loadingSubject.value) {
        console.warn('[LoadingService] Safety watchdog timed out. Auto-clearing loader.');
        this.forceReset();
      }
    }, 10000);
  }

  // Internal: Increment progress to a specific milestone
  private incrementProgress(milestone: number): void {
    if (this.progressSubject.value < milestone) {
      this.progressSubject.next(milestone);
    }
  }

  // Internal: Finish loading with smooth 100% transition and fade-out
  private completeLoading(): void {
    if (this.progressTimerRef) {
      clearInterval(this.progressTimerRef);
      this.progressTimerRef = null;
    }

    // Jump to 100%
    this.progressSubject.next(100);

    // Allow CSS transition to show completed bar before hiding
    setTimeout(() => {
      this.loadingSubject.next(false);
      this.progressSubject.next(0);
      this.messageSubject.next('Loading StayEase...');

      if (this.safetyTimeoutRef) {
        clearTimeout(this.safetyTimeoutRef);
        this.safetyTimeoutRef = null;
      }
    }, 320);
  }

  // Internal: Emergency reset
  private forceReset(): void {
    this.activeRequestsCount = 0;
    this.isRouteTransitioning = false;
    if (this.progressTimerRef) {
      clearInterval(this.progressTimerRef);
      this.progressTimerRef = null;
    }
    if (this.safetyTimeoutRef) {
      clearTimeout(this.safetyTimeoutRef);
      this.safetyTimeoutRef = null;
    }
    this.progressSubject.next(100);
    setTimeout(() => {
      this.loadingSubject.next(false);
      this.progressSubject.next(0);
    }, 150);
  }
}
