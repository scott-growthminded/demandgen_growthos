/**
 * DAL Static Implementations (DATA_MODE=mock)
 *
 * Loads data from JSON files in server/data/ at startup.
 * Changes to tactics_config.json are written back to disk immediately.
 * All other files (customers, availability) are read-only at startup.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  CustomerRepository,
  AvailabilityRepository,
  TacticsRepository,
  DiscountCodeRepository,
} from "./base";
import type { CustomerProfile, LocationAvailability, TacticsConfig } from "@shared/schema";
import { tacticsConfigSchema } from "@shared/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../data");

// ── Customers ───────────────────────────────────────────────────────────────

function loadCustomers(): CustomerProfile[] {
  const filePath = path.join(DATA_DIR, "customers.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CustomerProfile[];
}

const customersData = loadCustomers();
const customerByEmail = new Map<string, CustomerProfile>(
  customersData.map((c) => [c.email.toLowerCase(), c])
);

export class StaticCustomerRepo implements CustomerRepository {
  async findByEmail(email: string): Promise<CustomerProfile | null> {
    return customerByEmail.get(email.toLowerCase()) ?? null;
  }

  async findAll(): Promise<CustomerProfile[]> {
    return customersData;
  }
}

// ── Availability ─────────────────────────────────────────────────────────────

interface AvailabilityFile {
  generatedAt: string;
  lowDemandThreshold: number;
  locations: LocationAvailability[];
}

function loadAvailability(): AvailabilityFile {
  const filePath = path.join(DATA_DIR, "availability.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as AvailabilityFile;
}

const availabilityData = loadAvailability();
const locationByName = new Map<string, LocationAvailability>(
  availabilityData.locations.map((l) => [l.name.toLowerCase(), l])
);

export class StaticAvailabilityRepo implements AvailabilityRepository {
  async getByLocation(locationName: string): Promise<LocationAvailability | null> {
    return locationByName.get(locationName.toLowerCase()) ?? null;
  }

  async getAllLocations(): Promise<string[]> {
    return availabilityData.locations.map((l) => l.name);
  }
}

// ── Tactics Config ───────────────────────────────────────────────────────────

export class StaticTacticsRepo implements TacticsRepository {
  private readonly configPath = path.join(DATA_DIR, "tactics_config.json");

  async getConfig(): Promise<TacticsConfig> {
    const raw = fs.readFileSync(this.configPath, "utf-8");
    const parsed = JSON.parse(raw);
    // Strip unknown keys (e.g. _comment) via Zod
    return tacticsConfigSchema.parse(parsed);
  }

  async updateConfig(config: TacticsConfig): Promise<void> {
    const updated = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: "dashboard",
    };
    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), "utf-8");
  }
}

// ── Discount Codes ───────────────────────────────────────────────────────────

function loadDiscountCodes(): Record<string, string[]> {
  const filePath = path.join(DATA_DIR, "discount_codes.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, string[]>;
}

const discountCodePools = loadDiscountCodes();
const codeIndexes: Record<string, number> = {};

export class StaticDiscountCodeRepo implements DiscountCodeRepository {
  getCode(prefix: string): string | null {
    const pool = discountCodePools[prefix];
    if (!pool || pool.length === 0) return null;
    const idx = codeIndexes[prefix] ?? 0;
    const code = pool[idx % pool.length];
    codeIndexes[prefix] = idx + 1;
    return code;
  }
}
