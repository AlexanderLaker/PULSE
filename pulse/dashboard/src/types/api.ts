/**
 * PRISM — API response wrapper types.
 */

/** Generic API error response. */
export interface APIError {
  detail: string;
  status?: number;
}

/** Paginated list response wrapper. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

/** Generic success response. */
export interface SuccessResponse {
  status: 'ok';
  message?: string;
}
