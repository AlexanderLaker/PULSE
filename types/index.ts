/**
 * Domain types of the dashboard. They mirror the JSON of the PRISM API
 * (prism/api): object keys are strings, so years arrive as "2026" ... "2035",
 * categories as their display names ("Hair: Color", "LHC: FCN") and regions
 * as "Europe", "North America", "Asia", "High Growth". Shares and shifts are
 * fractions: 0.051 is 5.1 percent.
 */
export type * from './drivers';
export type * from './simulation';
export type * from './config';

/** The six forces a driver belongs to. */
export type ForceName =
  | 'Consumer'
  | 'Customer'
  | 'Technology'
  | 'Government'
  | 'Environmental'
  | 'Competitive';

/** Whether a driver grows (Expansion) or shrinks (Contraction) the profit pool. */
export type Direction = 'Expansion' | 'Contraction';

/** How well a driver's evidence holds up. Shown with the driver; not a model input. */
export type Confidence = 'High' | 'Medium' | 'Low';

/** A signed-in user's role: admins edit drivers and journey content and manage users. */
export type Role = 'admin' | 'viewer';

/** What a signed-in user may do: a role, or pending until an admin gives them one. */
export type Access = Role | 'pending';
