// Interface representing an individual route navigation transition record
export interface RouteNavigationRecord {
  // Unique transition identifier string
  id: string;

  // Raw requested URL path
  url: string;

  // Normalized final URL path after any redirects
  urlAfterRedirects: string;

  // Timestamp when navigation completed
  timestamp: Date;

  // Approximate milliseconds spent on previous route before navigating
  durationMs?: number;

  // Snapshot of query parameters present during transition
  queryParams?: Record<string, string>;
}

// Interface representing aggregated visit statistics for a particular URL route
export interface RouteVisitStats {
  // Canonical route URL path
  url: string;

  // Total number of times this URL was navigated to in active session
  visitCount: number;

  // Date and time of the most recent visit
  lastVisited: Date;
}
