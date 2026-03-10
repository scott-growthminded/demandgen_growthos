import { z } from "zod";

// BLVD API Configuration
export const blvdConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
  businessId: z.string().min(1),
});

export type BlvdConfig = z.infer<typeof blvdConfigSchema>;

// GraphQL Response Types
export const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
  timeZone: z.string(),
});

export const businessSchema = z.object({
  id: z.string(),
  name: z.string(),
  locations: z.object({
    edges: z.array(z.object({
      node: locationSchema,
    })),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().nullable(),
    }),
  }),
});

export const graphqlResponseSchema = z.object({
  data: z.object({
    business: businessSchema,
  }).nullable(),
  errors: z.array(z.object({
    message: z.string(),
    path: z.array(z.string()).optional(),
  })).optional(),
});

// Test Result Types
export const testResultSchema = z.object({
  name: z.string(),
  status: z.enum(['passed', 'failed', 'testing']),
  message: z.string(),
  metadata: z.record(z.string()).optional(),
});

export const connectionTestResultSchema = z.object({
  connected: z.boolean(),
  tests: z.array(testResultSchema),
  responseTime: z.number().optional(),
  error: z.string().optional(),
});

export type Location = z.infer<typeof locationSchema>;
export type Business = z.infer<typeof businessSchema>;
export type GraphqlResponse = z.infer<typeof graphqlResponseSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;

// Booking Widget Types
export const bookingLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.object({
    street: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string().optional(),
  }).optional(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  timeZone: z.string().default('America/New_York'),
});

export const estheticianSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  avatar: z.string().optional(),
});

export const timeSlotSchema = z.object({
  id: z.string(),
  startTime: z.string(), // ISO string
  endTime: z.string().optional(),
  available: z.boolean(),
  staffId: z.string().optional(),
});

export const bookingStateSchema = z.object({
  locationId: z.string(),
  date: z.string(), // YYYY-MM-DD format
  timeSlot: timeSlotSchema.optional(),
  estheticianId: z.string().optional(),
  serviceId: z.string().optional(),
});

export const availabilityResponseSchema = z.object({
  location: bookingLocationSchema,
  date: z.string(),
  timeSlots: z.array(timeSlotSchema),
  estheticians: z.array(estheticianSchema),
  alternativeLocations: z.array(bookingLocationSchema).optional(),
});

export type BookingLocation = z.infer<typeof bookingLocationSchema>;
export type Esthetician = z.infer<typeof estheticianSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type BookingState = z.infer<typeof bookingStateSchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

// Booking Cart Schema (for Client API flow)
export const bookingCartSchema = z.object({
  id: z.string(),
  cartId: z.string(),
  productType: z.enum(['Treatment', 'Product', 'GiftCard']).default('Treatment'),
  plan: z.enum(['Member', 'NonMember']).optional(),
  locationId: z.string().optional(),
  locationName: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  bookableTimeId: z.string().optional(),
  selectedDate: z.string().optional(),
  selectedTime: z.string().optional(),
  clientInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phoneNumber: z.string(),
  }).optional(),
  paymentMethodId: z.string().optional(),
  status: z.enum(['creating', 'items_added', 'time_reserved', 'info_collected', 'payment_added', 'completed']).default('creating'),
  createdAt: z.string(),
});

export const insertBookingCartSchema = bookingCartSchema.omit({ id: true, createdAt: true });

export type BookingCart = z.infer<typeof bookingCartSchema>;
export type InsertBookingCart = z.infer<typeof insertBookingCartSchema>;

// Waitlist Request Schema
export const waitlistRequestSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phoneNumber: z.string(),
  locationId: z.string(),
  locationName: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'contacted', 'booked', 'cancelled']).default('pending'),
  createdAt: z.string(),
});

export const insertWaitlistRequestSchema = waitlistRequestSchema.omit({ id: true, createdAt: true });

export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;
export type InsertWaitlistRequest = z.infer<typeof insertWaitlistRequestSchema>;

// ─── UtilizationOS: Customer Profile ────────────────────────────────────────

export const propensityTierSchema = z.enum(['high', 'mid', 'low']);

export const customerProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  studio: z.string(),
  studioRef: z.string(),
  npsRating: z.number().int().min(0).max(10),
  npsLabel: z.string(),
  memberStatus: z.string(),
  isMember: z.boolean(),
  preferredProvider: z.string(),
  clv: z.string(),
  clvNumeric: z.number(),
  spent: z.number(),
  appointmentCount: z.number(),
  latestResponseDate: z.string().nullable(),
  daysSinceLastVisit: z.number(),
  lapsed: z.boolean(),
  propensityTier: propensityTierSchema,
  propensityScore: z.number(),
});

export type PropensityTier = z.infer<typeof propensityTierSchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;

// ─── UtilizationOS: Availability ─────────────────────────────────────────────

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.string(),
  hour: z.number(),
  minute: z.number().default(0),
  displayTime: z.string(),
  utilizationRate: z.number(),
  isLowDemand: z.boolean(),
  rawCount: z.number(),
});

export const locationAvailabilitySchema = z.object({
  name: z.string(),
  totalAppointments: z.number(),
  /** Per-day-of-week peak slot counts used for within-day normalization. */
  dayPeaks: z.record(z.string(), z.number()).optional(),
  /** Business hours derived from earliest/latest slot start times. */
  businessHours: z.object({ open: z.number(), close: z.number() }).optional(),
  /** Provider roster — available when loaded from mock data; absent from real CSV data. */
  providers: z.array(z.string()).optional().default([]),
  slots: z.array(availabilitySlotSchema),
});

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
export type LocationAvailability = z.infer<typeof locationAvailabilitySchema>;

// ─── UtilizationOS: Tactics Config ───────────────────────────────────────────

export const tacticOfferSchema = z.object({
  type: z.enum(['percent_off', 'dollar_off']),
  value: z.number(),
  displayLabel: z.string(),
  discountCodePrefix: z.string(),
});

export const tacticSchema = z.object({
  enabled: z.boolean(),
  label: z.string(),
  description: z.string(),
  targetTiers: z.array(propensityTierSchema),
  memberFilter: z.enum(['all', 'member', 'non_member']),
  constraint: z.enum(['low_demand_only', 'any_time', 'none']),
  offer: tacticOfferSchema.nullable(),
});

export const tacticsConfigSchema = z.object({
  updatedAt: z.string(),
  updatedBy: z.string(),
  thresholds: z.object({
    // Propensity thresholds
    lowDemandUtilization: z.number(),
    lapsedMidDays: z.number(),
    lapsedLowDays: z.number(),
    highPropensityNps: z.number(),
    midPropensityNps: z.number(),
    // Supply signal thresholds (adjustable by business)
    lowDemandDayThreshold: z.number().default(0.7), // fraction of a day's slots that must be isLowDemand for the day to qualify
    lowDemandTimeMinDays: z.number().int().default(2), // min distinct days an hour must be low-demand to qualify as an off-peak window
  }),
  tactics: z.object({
    preferredProviderNudge: tacticSchema,
    incentiveMidTier: tacticSchema,
    incentiveLowTier: tacticSchema,
    membershipCta: tacticSchema,
  }),
});

export type TacticOffer = z.infer<typeof tacticOfferSchema>;
export type Tactic = z.infer<typeof tacticSchema>;
export type TacticsConfig = z.infer<typeof tacticsConfigSchema>;

// ─── UtilizationOS: Recommendation Response ──────────────────────────────────

// ─── Propensity signals (raw drivers behind the tier) ────────────────────────

export const propensitySignalsSchema = z.object({
  tier: propensityTierSchema,
  score: z.number(),
  npsRating: z.number(),
  daysSinceLastVisit: z.number(),
  isMember: z.boolean(),
  lapsed: z.boolean(),
});

// ─── Supply signals (location-level demand factors) ───────────────────────────

export const lowDemandDayFactorSchema = z.object({
  day: z.string(),                  // e.g. "Friday"
  lowDemandSlotCount: z.number(),   // slots on this day with isLowDemand: true
  totalSlots: z.number(),           // total slots on this day in the dataset
  avgUtilization: z.number(),       // mean utilizationRate across all of this day's slots
});

export const lowDemandTimeWindowSchema = z.object({
  hour: z.number(),
  displayTime: z.string(),          // e.g. "4:00 PM"
  daysWithLowDemand: z.number(),    // how many distinct days this hour is low-demand
  avgUtilization: z.number(),       // mean utilizationRate for this hour across low-demand days
});

export const providerSignalSchema = z.object({
  providerName: z.string().nullable(),    // customer's preferredProvider (or null)
  locationHasProvider: z.boolean(),       // is preferredProvider in location.providers[]?
  totalLowDemandSlots: z.number(),        // total low-demand slots at location (availability proxy)
});

export const dayTimeSlotSchema = z.object({
  hour: z.number(),
  displayTime: z.string(),
  avgUtilization: z.number(),
});

export const lowDemandTimeByDaySchema = z.object({
  dayOfWeek: z.string(),
  lowDemandHours: z.array(dayTimeSlotSchema),
});

export const incentiveFactorsSchema = z.object({
  lowDemandDays: z.array(lowDemandDayFactorSchema),
  lowDemandTimeWindows: z.array(lowDemandTimeWindowSchema),
  lowDemandTimesByDay: z.array(lowDemandTimeByDaySchema),
  providerSignal: providerSignalSchema,
});

export type PropensitySignals = z.infer<typeof propensitySignalsSchema>;
export type LowDemandDayFactor = z.infer<typeof lowDemandDayFactorSchema>;
export type LowDemandTimeWindow = z.infer<typeof lowDemandTimeWindowSchema>;
export type DayTimeSlot = z.infer<typeof dayTimeSlotSchema>;
export type LowDemandTimeByDay = z.infer<typeof lowDemandTimeByDaySchema>;
export type ProviderSignal = z.infer<typeof providerSignalSchema>;
export type IncentiveFactors = z.infer<typeof incentiveFactorsSchema>;

// ─── Nudge ────────────────────────────────────────────────────────────────────

export const nudgeSlotSchema = z.object({
  dayOfWeek: z.string(),
  displayTime: z.string(),
  isLowDemand: z.boolean(),
});

export const incentiveOfferResultSchema = z.object({
  type: z.enum(['percent_off', 'dollar_off']),
  value: z.number(),
  displayLabel: z.string(),
  discountCode: z.string(),
  constraint: z.string(),
});

export const nudgeSchema = z.object({
  type: z.enum(['provider', 'incentive', 'none']),
  message: z.string().optional(),
  offer: incentiveOfferResultSchema.optional(),
  suggestedSlots: z.array(nudgeSlotSchema).optional(),
});

export const recommendationResponseSchema = z.object({
  customerId: z.string(),
  propensityTier: propensityTierSchema,
  propensityScore: z.number(),
  preferredProvider: z.string().nullable(),
  nudge: nudgeSchema,
  membershipCta: z.boolean(),
  propensitySignals: propensitySignalsSchema,   // raw drivers behind the tier (for Incentive Logic bar)
  incentiveFactors: incentiveFactorsSchema,      // supply-side signals (for Incentive Logic bar)
});

export type NudgeSlot = z.infer<typeof nudgeSlotSchema>;
export type IncentiveOfferResult = z.infer<typeof incentiveOfferResultSchema>;
export type Nudge = z.infer<typeof nudgeSchema>;
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
