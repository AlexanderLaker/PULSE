/**
 * A driver's names as the dashboard shows them (docs/DRIVERS.md, Names): the
 * short name people quote, the long name under it, the descriptor that opens
 * the driver and its technical scope, plus the boundary sentence of a driver
 * readers confuse with a neighbour. The API serves all of them with the
 * driver (`name` is the technical scope); the codes come from the generated
 * code map, which carries no name. Where only a code is at hand, the names
 * come from the drivers the dashboard has loaded (namesForCode).
 */
import { DRIVER_CODE_MAP, codeForDriverId } from '@/data/driverCodeMap';
import type { Driver } from '@/types';

/** The fields of a driver its names are read from. */
export type NamedDriver = Pick<Driver, 'id' | 'name' | 'short_name' | 'long_name' | 'descriptor' | 'boundary'>;

export interface DriverNames {
  /** The display code (C-01), or '' for a driver the code map does not hold. */
  code: string;
  shortName: string;
  longName: string;
  descriptor: string;
  /** '' for a driver without one. */
  boundary: string;
  /** The precise title the driver was reviewed under: the API's `name`. */
  technicalScope: string;
}

/**
 * The names of a driver. A driver without names (one the driver base of this
 * build does not know) is named by its technical scope, with no long name,
 * descriptor or boundary sentence.
 */
export function driverNames(driver: NamedDriver): DriverNames {
  return {
    code: codeForDriverId(driver.id) ?? '',
    shortName: driver.short_name || driver.name,
    longName: driver.long_name,
    descriptor: driver.descriptor,
    boundary: driver.boundary,
    technicalScope: driver.name,
  };
}

/**
 * The names behind a code, read from the loaded drivers; null for a code the
 * map does not hold or while the drivers have not loaded, when a view shows
 * the code alone.
 */
export function namesForCode(code: string, drivers: readonly NamedDriver[]): DriverNames | null {
  const id = DRIVER_CODE_MAP[code]?.driverId;
  const driver = id ? drivers.find((d) => d.id === id) : undefined;
  return driver ? driverNames(driver) : null;
}

/** A query that is exactly the code of a driver, in either case ('c-01' gives 'C-01'); null otherwise. */
export function exactDriverCode(query: string): string | null {
  const q = query.trim().toUpperCase();
  return /^[CKTGEX]-\d{2}$/.test(q) && DRIVER_CODE_MAP[q] ? q : null;
}

/** The driver id behind a code, or undefined for a code the map does not hold. */
export const driverIdForCode = (code: string): string | undefined => DRIVER_CODE_MAP[code]?.driverId;

/**
 * The Drivers page's address for a drill-through from another view: the
 * query as the search and, for a query that is exactly a driver's code, that
 * driver as the open one, so the page shows it alone and opened.
 */
export function drillThroughParams(query: string): { q: string; driver: string | null } {
  const code = exactDriverCode(query);
  return { q: query, driver: code ? driverIdForCode(code) ?? null : null };
}

/**
 * Whether a driver matches the Drivers page's search. A query that is exactly
 * a driver code matches that driver alone, since several descriptions cite
 * other drivers by code; any other query matches when the code, one of the
 * four names, the description or the force contains it.
 */
export function matchesDriverSearch(driver: Driver, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const names = driverNames(driver);
  const code = exactDriverCode(query);
  if (code) return names.code === code;
  return [names.code, names.shortName, names.longName, names.descriptor, names.technicalScope,
    driver.description, driver.force].some((text) => text.toLowerCase().includes(q));
}

/** One piece of a boundary sentence: plain text, or a code it cites. */
export type BoundaryPart = { kind: 'text'; text: string } | { kind: 'code'; code: string };

/** A boundary sentence cut into its text and the codes it cites, so each code can show as a link. */
export function boundaryParts(sentence: string): BoundaryPart[] {
  const parts: BoundaryPart[] = [];
  let last = 0;
  for (const m of sentence.matchAll(/\b[CKTGEX]-\d{2}\b/g)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: sentence.slice(last, at) });
    parts.push({ kind: 'code', code: m[0] });
    last = at + m[0].length;
  }
  if (last < sentence.length) parts.push({ kind: 'text', text: sentence.slice(last) });
  return parts;
}
