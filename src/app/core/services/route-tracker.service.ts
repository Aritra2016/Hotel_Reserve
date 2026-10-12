import { Injectable } from '@angular/core';
import { Router, NavigationEnd, Event as RouterEvent } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { RouteNavigationRecord, RouteVisitStats } from '../models/route-track.model';

@Injectable({
  providedIn: 'root',
})
export class RouteTrackerService {
  // Chronological array of all route navigation transition records
  private history: RouteNavigationRecord[] = [];

  // Timestamp of the start of the current route visit for calculating duration
  private lastNavigationTime: number = Date.now();

  // Map: Key-value lookup tracking visit count per distinct URL path
  private routeVisitsCountMap = new Map<string, number>();

  // Set: Deduplicated collection of unique URLs visited during this session
  private uniqueVisitedRoutesSet = new Set<string>();

  // BehaviorSubject holding the active current URL path
  private currentUrlSubject = new BehaviorSubject<string>('/');

  // Observable stream exposing the current active URL path
  public currentUrl$: Observable<string> = this.currentUrlSubject.asObservable();

  // BehaviorSubject holding the previous visited URL path
  private previousUrlSubject = new BehaviorSubject<string | null>(null);

  // Observable stream exposing the previous visited URL path
  public previousUrl$: Observable<string | null> = this.previousUrlSubject.asObservable();

  // BehaviorSubject emitting updated full navigation history
  private historySubject = new BehaviorSubject<RouteNavigationRecord[]>([]);

  // Observable stream exposing complete navigation history
  public history$: Observable<RouteNavigationRecord[]> = this.historySubject.asObservable();

  constructor(private router: Router) {
    // Initialize tracking on current active router URL snapshot
    this.initInitialRoute();

    // Subscribe to router navigation events pipeline
    this.listenToNavigationEvents();
  }

  // Method: Record initial baseline route when service initializes
  private initInitialRoute(): void {
    // Extract initial URL string from router
    const rawUrl = this.router?.url || '/';

    // Sanitize initial URL string using trim
    const trimmedUrl = rawUrl.trim();

    // Check if initial URL is non-empty
    if (trimmedUrl.length > 0) {
      // Record initial route navigation transition
      this.recordNavigation(trimmedUrl, trimmedUrl);
    }
  }

  // Method: Listen to Angular Router events pipeline and capture NavigationEnd
  private listenToNavigationEvents(): void {
    // Pipe router events stream to capture completed navigations
    this.router.events
      .pipe(
        // Filter: Listen only for NavigationEnd event types
        filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe({
        next: (event: NavigationEnd) => {
          // Extract requested URL using optional chaining
          const rawUrl = event?.url || '/';

          // Extract redirected URL using optional chaining
          const rawUrlAfterRedirects = event?.urlAfterRedirects || rawUrl;

          // Sanitize raw requested URL using trim
          const cleanUrl = rawUrl.trim();

          // Sanitize redirected URL using trim
          const cleanUrlAfterRedirects = rawUrlAfterRedirects.trim();

          // Record navigation transition into history and analytics
          this.recordNavigation(cleanUrl, cleanUrlAfterRedirects);
        },
      });
  }

  // Method: Process and record a validated route transition
  private recordNavigation(url: string, urlAfterRedirects: string): void {
    // Calculate current timestamp in milliseconds
    const now = Date.now();

    // Calculate time duration spent on previous route
    const durationSpent = Math.max(0, now - this.lastNavigationTime);

    // Update last navigation timestamp
    this.lastNavigationTime = now;

    // Cache current active URL before updating to assign as previous
    const previous = this.currentUrlSubject.value;

    // Check if previous URL exists and is different from new URL
    if (previous && previous !== urlAfterRedirects) {
      // Update previous URL Subject value
      this.previousUrlSubject.next(previous);
    }

    // Update current URL Subject value
    this.currentUrlSubject.next(urlAfterRedirects);

    // Construct unique navigation record ID
    const recordId = `nav_${now}_${Math.floor(Math.random() * 1000)}`;

    // Create structured navigation record object
    const record: RouteNavigationRecord = {
      id: recordId,
      url: url,
      urlAfterRedirects: urlAfterRedirects,
      timestamp: new Date(now),
      durationMs: durationSpent,
    };

    // Append record to local history array
    this.history.push(record);

    // Add clean URL path to unique visited routes Set
    this.uniqueVisitedRoutesSet.add(urlAfterRedirects);

    // Check if URL path exists in visit count Map
    const currentCount = this.routeVisitsCountMap.get(urlAfterRedirects) || 0;

    // Increment visit count for this route in Map
    this.routeVisitsCountMap.set(urlAfterRedirects, currentCount + 1);

    // Emit updated immutable clone of history array
    this.historySubject.next([...this.history]);

    // Output formatted route navigation telemetry log to DevTools Console
    console.log(
      `[RouteTracker] 🧭 Navigation route changed: "${urlAfterRedirects}" (Visits: ${currentCount + 1}, Total Transitions: ${this.history.length})`
    );
  }

  // Method: Explicitly log element click interactions and route telemetry to the browser console
  logClickAction(component: string, action: string, details?: any): void {
    // Extract current URL snapshot from BehaviorSubject or router url
    const currentUrl = this.getCurrentUrl() || this.router?.url || (typeof window !== 'undefined' ? window.location.pathname : '/');

    // Generate local time string
    const timeStr = new Date().toLocaleTimeString();

    // Check if optional details object was supplied
    if (details !== undefined) {
      // Log formatted click action with details object
      console.log(`[${component}:onClick @ ${currentUrl} | ${timeStr}] 👆 Action: ${action}`, details);
    } else {
      // Log formatted click action
      console.log(`[${component}:onClick @ ${currentUrl} | ${timeStr}] 👆 Action: ${action}`);
    }
  }

  // Method: Retrieve current active URL string snapshot
  getCurrentUrl(): string {
    // Return value of currentUrlSubject
    return this.currentUrlSubject.value;
  }

  // Method: Retrieve previous visited URL string snapshot
  getPreviousUrl(): string | null {
    // Return value of previousUrlSubject
    return this.previousUrlSubject.value;
  }

  // Method: Retrieve complete history of route navigation transitions
  getHistory(): RouteNavigationRecord[] {
    // Return copy of history array
    return [...this.history];
  }

  // Method: Retrieve count of distinct unique URLs visited in active session
  getUniqueRoutesCount(): number {
    // Return size of uniqueVisitedRoutesSet
    return this.uniqueVisitedRoutesSet.size;
  }

  // Method: Check if a specific URL path was visited in this session
  hasVisitedRoute(url: string): boolean {
    // Sanitize target URL using trim
    const trimmed = url?.trim();

    // Check presence in uniqueVisitedRoutesSet using Set.has()
    return this.uniqueVisitedRoutesSet.has(trimmed);
  }

  // Method: Retrieve total number of times a specific URL was visited
  getVisitCountForRoute(url: string): number {
    // Sanitize target URL using trim
    const trimmed = url?.trim();

    // Lookup count in routeVisitsCountMap or fallback to 0
    return this.routeVisitsCountMap.get(trimmed) || 0;
  }

  // Method: Filter route navigation history matching a specific URL prefix
  filterHistoryByPrefix(prefix: string): RouteNavigationRecord[] {
    // Sanitize prefix string using trim
    const cleanPrefix = prefix?.trim().toLowerCase() || '';

    // Filter: Return only history records whose URL begins with prefix
    return this.history.filter((rec: RouteNavigationRecord) =>
      rec?.urlAfterRedirects?.toLowerCase().startsWith(cleanPrefix)
    );
  }

  // Method: Calculate cumulative navigation transitions count using reduce
  calculateTotalTransitions(): number {
    // Reduce: Sum up count of transitions in history
    return this.history.reduce(
      (total: number, _record: RouteNavigationRecord) => total + 1,
      0
    );
  }

  // Method: Calculate cumulative milliseconds spent across all tracked navigation transitions
  calculateTotalDurationMs(): number {
    // Reduce: Sum up durationMs values across history records
    return this.history.reduce(
      (total: number, record: RouteNavigationRecord) =>
        total + (record?.durationMs || 0),
      0
    );
  }

  // Method: Retrieve the most frequently visited route in the active session
  getMostVisitedRoute(): RouteVisitStats | null {
    // Check if any route visits have been recorded in Map
    if (this.routeVisitsCountMap.size === 0) {
      // Return null if no routes tracked
      return null;
    }

    // Array.from: Convert Map entries to standard array
    const entries = Array.from(this.routeVisitsCountMap.entries());

    // Reduce: Find entry with maximum visit count
    const topEntry = entries.reduce((max, current) =>
      current[1] > max[1] ? current : max
    );

    // Return structured RouteVisitStats object
    return {
      url: topEntry[0],
      visitCount: topEntry[1],
      lastVisited: new Date(),
    };
  }

  // Method: Check if back navigation is possible within application history
  canGoBack(): boolean {
    // Check if previousUrlSubject has a valid URL
    return !!this.previousUrlSubject.value && this.history.length > 1;
  }

  // Method: Navigate user to previous route or fallback to default destination
  goBack(fallbackUrl: string = '/'): void {
    // Extract previous URL
    const targetUrl = this.previousUrlSubject.value;

    // Check if valid previous URL exists
    if (targetUrl && targetUrl !== this.currentUrlSubject.value) {
      // Navigate router to previous URL
      this.router.navigateByUrl(targetUrl);
    } else {
      // Navigate router to fallback destination
      this.router.navigateByUrl(fallbackUrl);
    }
  }

  // Method: Reset navigation history and cached tracking metrics
  clearHistory(): void {
    // Clear history array
    this.history = [];

    // Clear route visits count Map
    this.routeVisitsCountMap.clear();

    // Clear unique routes Set
    this.uniqueVisitedRoutesSet.clear();

    // Reset previous URL subject to null
    this.previousUrlSubject.next(null);

    // Emit empty history array
    this.historySubject.next([]);
  }
}
