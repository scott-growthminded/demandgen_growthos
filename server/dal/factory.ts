/**
 * DAL Factory
 *
 * Reads DATA_MODE from the environment and returns the correct
 * repository implementations. Switching from mock to live requires
 * only a config change — no business logic changes.
 *
 * DATA_MODE=mock  (default) — static JSON files from server/data/
 * DATA_MODE=live            — live Boulevard API (not yet implemented)
 */

import {
  StaticLocationRepo,
  StaticCustomerRepo,
  StaticAvailabilityRepo,
  StaticTacticsRepo,
  StaticDiscountCodeRepo,
} from "./static";
import type {
  LocationRepository,
  CustomerRepository,
  AvailabilityRepository,
  TacticsRepository,
  DiscountCodeRepository,
} from "./base";

const DATA_MODE = process.env.DATA_MODE ?? "mock";

if (DATA_MODE !== "mock" && DATA_MODE !== "live") {
  throw new Error(`Invalid DATA_MODE: "${DATA_MODE}". Must be "mock" or "live".`);
}

if (DATA_MODE === "live") {
  console.warn(
    "[DAL] DATA_MODE=live — Boulevard live repo is not yet implemented. Falling back to mock."
  );
}

export function createLocationRepo(): LocationRepository {
  return new StaticLocationRepo();
}

export function createCustomerRepo(): CustomerRepository {
  // TODO: when DATA_MODE=live, return new BoulevardCustomerRepo()
  return new StaticCustomerRepo();
}

export function createAvailabilityRepo(): AvailabilityRepository {
  // TODO: when DATA_MODE=live, return new BoulevardAvailabilityRepo()
  return new StaticAvailabilityRepo();
}

export function createTacticsRepo(): TacticsRepository {
  // Tactics config is always file-based — not mode-dependent
  return new StaticTacticsRepo();
}

export function createDiscountCodeRepo(): DiscountCodeRepository {
  // Discount codes are always file-based for POC
  return new StaticDiscountCodeRepo();
}

export const dataMode = DATA_MODE;
