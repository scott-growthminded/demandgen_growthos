/**
 * DAL Base Interfaces
 *
 * All data access goes through these interfaces. Implementations
 * (static file vs. live API) are swapped via the factory without
 * changing any business logic.
 */

import type {
  CustomerProfile,
  LocationAvailability,
  TacticsConfig,
} from "@shared/schema";

export interface LocationNode {
  id: string;
  name: string;
  isRemote: boolean;
  address: { city: string; state: string; line1: string; line2: string | null };
  coordinates: { latitude: number; longitude: number } | null;
  subtext?: string;
}

export interface LocationsGraphqlResponse {
  data: {
    locations: {
      edges: { node: LocationNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

export interface LocationRepository {
  getAll(): Promise<LocationsGraphqlResponse>;
}

export interface CustomerRepository {
  /** Look up a single customer by email address (case-insensitive). */
  findByEmail(email: string): Promise<CustomerProfile | null>;
  /** Return all customers (used by dashboard monitoring view). */
  findAll(): Promise<CustomerProfile[]>;
}

export interface AvailabilityRepository {
  /** Return utilization slot data for a specific location by name. */
  getByLocation(locationName: string): Promise<LocationAvailability | null>;
  /** Return a list of all known location names. */
  getAllLocations(): Promise<string[]>;
}

export interface TacticsRepository {
  /** Read the current tactics configuration. */
  getConfig(): Promise<TacticsConfig>;
  /** Persist an updated tactics configuration (called by dashboard). */
  updateConfig(config: TacticsConfig): Promise<void>;
}

export interface DiscountCodeRepository {
  /** Pop a code from the pool for the given prefix. Returns null if pool is exhausted. */
  getCode(prefix: string): string | null;
}
