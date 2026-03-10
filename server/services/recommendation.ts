/**
 * Recommendation Service
 *
 * Given a customer, their studio's availability, the active tactic config,
 * and a discount code source — returns the personalized nudge to show
 * in the booking flow.
 *
 * Rules (mirrors JIT logic in tactics_config.json):
 *   High tier  → preferred provider nudge at low-demand times (no discount)
 *   Mid tier   → 10% off at low-demand time + preferred provider if available
 *   Low tier   → $10 off any time + recovery messaging
 *   All tiers  → membership CTA in confirmation (non-members only)
 */

import type {
  CustomerProfile,
  LocationAvailability,
  TacticsConfig,
  RecommendationResponse,
  NudgeSlot,
  PropensitySignals,
  IncentiveFactors,
  LowDemandDayFactor,
  LowDemandTimeWindow,
  DayTimeSlot,
  LowDemandTimeByDay,
  ProviderSignal,
} from "@shared/schema";
import type { DiscountCodeRepository } from "../dal/base";
import { getEffectiveTier, passesMemberFilter } from "./segmentation";

// Number of suggested low-demand slots to surface in the nudge
const MAX_SUGGESTED_SLOTS = 3;

/**
 * Select the best low-demand slots to suggest to the customer.
 * Prefer slots with some historical volume (not totally dead) so
 * they feel like real options, not throwaway times.
 */
function selectLowDemandSlots(
  availability: LocationAvailability | null
): NudgeSlot[] {
  if (!availability) return [];

  return availability.slots
    .filter((s) => s.isLowDemand && s.rawCount > 0)
    .sort((a, b) => {
      // Prefer weekday slots with moderate utilization (not nearly empty)
      const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      const aWeekday = weekdays.includes(a.dayOfWeek) ? 1 : 0;
      const bWeekday = weekdays.includes(b.dayOfWeek) ? 1 : 0;
      if (aWeekday !== bWeekday) return bWeekday - aWeekday;
      // Within weekdays, prefer higher utilization (more compelling time)
      return b.utilizationRate - a.utilizationRate;
    })
    .slice(0, MAX_SUGGESTED_SLOTS)
    .map((s) => ({
      dayOfWeek: s.dayOfWeek,
      displayTime: s.displayTime,
      isLowDemand: true,
    }));
}

/**
 * Check whether the customer's preferred provider is listed at their location.
 * Returns the provider name if available, null otherwise.
 */
function resolvePreferredProvider(
  customer: CustomerProfile,
  availability: LocationAvailability | null
): string | null {
  if (!customer.preferredProvider || !availability) return null;
  const providerName = customer.preferredProvider.trim().toLowerCase();
  const found = availability.providers.find(
    (p) => p.trim().toLowerCase() === providerName
  );
  return found ?? null;
}

/**
 * Derive the raw propensity signals (the inputs that produced the tier).
 * Returned in the recommendation response so the Incentive Logic bar can
 * explain WHY the tier was assigned.
 */
function buildPropensitySignals(
  customer: CustomerProfile,
  tier: string
): PropensitySignals {
  return {
    tier: tier as PropensitySignals["tier"],
    score: customer.propensityScore,
    npsRating: customer.npsRating,
    daysSinceLastVisit: customer.daysSinceLastVisit,
    isMember: customer.isMember,
    lapsed: customer.lapsed,
  };
}

/**
 * Compute supply-side incentive factors from location availability data.
 *
 * Uses the two configurable supply thresholds from tactics_config.json:
 *   lowDemandDayThreshold  — fraction of a day's slots that must be isLowDemand
 *                            for the day itself to be flagged as a low-demand day
 *   lowDemandTimeMinDays   — minimum number of distinct days an hour must be
 *                            low-demand to qualify as a persistent off-peak window
 *
 * This function is purely supply-driven — no customer data involved.
 */
export function computeIncentiveFactors(
  availability: LocationAvailability | null,
  preferredProvider: string | null,
  config: TacticsConfig
): IncentiveFactors {
  const emptyProviderSignal: ProviderSignal = {
    providerName: preferredProvider,
    locationHasProvider: false,
    totalLowDemandSlots: 0,
  };

  if (!availability) {
    return { lowDemandDays: [], lowDemandTimeWindows: [], providerSignal: emptyProviderSignal };
  }

  const slots = availability.slots;
  const { lowDemandDayThreshold, lowDemandTimeMinDays } = config.thresholds;

  // ── Low-demand days ──────────────────────────────────────────────────────
  // Group by dayOfWeek; flag days where ≥ lowDemandDayThreshold of slots are isLowDemand
  const dayMap = new Map<string, { low: number; total: number; utilSum: number }>();
  for (const s of slots) {
    const d = dayMap.get(s.dayOfWeek) ?? { low: 0, total: 0, utilSum: 0 };
    d.total++;
    if (s.isLowDemand) d.low++;
    d.utilSum += s.utilizationRate;
    dayMap.set(s.dayOfWeek, d);
  }
  const lowDemandDays: LowDemandDayFactor[] = [];
  dayMap.forEach((v, day) => {
    if (v.low / v.total >= lowDemandDayThreshold) {
      lowDemandDays.push({
        day,
        lowDemandSlotCount: v.low,
        totalSlots: v.total,
        avgUtilization: Math.round((v.utilSum / v.total) * 100) / 100,
      });
    }
  });

  // ── Low-demand time windows ──────────────────────────────────────────────
  // Hours that are isLowDemand in ≥ lowDemandTimeMinDays distinct days
  const hourMap = new Map<number, { displayTime: string; daysCount: number; utilSum: number }>();
  for (const s of slots) {
    if (!s.isLowDemand) continue;
    const h = hourMap.get(s.hour) ?? { displayTime: s.displayTime, daysCount: 0, utilSum: 0 };
    h.daysCount++;
    h.utilSum += s.utilizationRate;
    hourMap.set(s.hour, h);
  }
  const lowDemandTimeWindows: LowDemandTimeWindow[] = [];
  hourMap.forEach((v, hour) => {
    if (v.daysCount >= lowDemandTimeMinDays) {
      lowDemandTimeWindows.push({
        hour,
        displayTime: v.displayTime,
        daysWithLowDemand: v.daysCount,
        avgUtilization: Math.round((v.utilSum / v.daysCount) * 100) / 100,
      });
    }
  });
  lowDemandTimeWindows.sort((a, b) => a.hour - b.hour);

  // ── Low-demand times by day ──────────────────────────────────────────────
  // For each day, collect the unique hours that are isLowDemand
  const dayHourMap = new Map<string, Map<number, { displayTime: string; utilSum: number; count: number }>>();
  for (const s of slots) {
    if (!s.isLowDemand) continue;
    if (!dayHourMap.has(s.dayOfWeek)) dayHourMap.set(s.dayOfWeek, new Map());
    const hMap = dayHourMap.get(s.dayOfWeek)!;
    const h = hMap.get(s.hour) ?? { displayTime: s.displayTime, utilSum: 0, count: 0 };
    h.utilSum += s.utilizationRate;
    h.count++;
    hMap.set(s.hour, h);
  }
  const lowDemandTimesByDay: LowDemandTimeByDay[] = [];
  dayHourMap.forEach((hMap, day) => {
    const lowDemandHours: DayTimeSlot[] = [];
    hMap.forEach((v, hour) => {
      lowDemandHours.push({
        hour,
        displayTime: v.displayTime,
        avgUtilization: Math.round((v.utilSum / v.count) * 100) / 100,
      });
    });
    lowDemandHours.sort((a, b) => a.hour - b.hour);
    lowDemandTimesByDay.push({ dayOfWeek: day, lowDemandHours });
  });
  const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  lowDemandTimesByDay.sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

  // ── Provider signal ──────────────────────────────────────────────────────
  // Does the preferred provider work at this location, and are there low-demand slots?
  const totalLowDemandSlots = slots.filter((s) => s.isLowDemand).length;
  const locationHasProvider =
    !!preferredProvider &&
    availability.providers.some(
      (p) => p.trim().toLowerCase() === preferredProvider.trim().toLowerCase()
    );
  const providerSignal: ProviderSignal = {
    providerName: preferredProvider,
    locationHasProvider,
    totalLowDemandSlots,
  };

  return { lowDemandDays, lowDemandTimeWindows, lowDemandTimesByDay, providerSignal };
}

/**
 * Build the full personalization recommendation for a customer.
 */
export function buildRecommendation(
  customer: CustomerProfile,
  availability: LocationAvailability | null,
  config: TacticsConfig,
  discountCodes: DiscountCodeRepository
): RecommendationResponse {
  const tier = getEffectiveTier(customer, config);
  const { tactics } = config;
  const lowDemandSlots = selectLowDemandSlots(availability);
  const resolvedProvider = resolvePreferredProvider(customer, availability);

  // Compute both signal sets — included in every response for the Incentive Logic bar
  const propensitySignals = buildPropensitySignals(customer, tier);
  const incentiveFactors = computeIncentiveFactors(availability, resolvedProvider, config);

  // Shared base fields for all response paths
  const base = {
    customerId: customer.id,
    propensityTier: tier as RecommendationResponse["propensityTier"],
    propensityScore: customer.propensityScore,
    preferredProvider: resolvedProvider,
    membershipCta: !customer.isMember && tactics.membershipCta.enabled,
    propensitySignals,
    incentiveFactors,
  } as const;

  // ── High tier: preferred provider nudge ──────────────────────────────────
  if (
    tier === "high" &&
    tactics.preferredProviderNudge.enabled &&
    passesMemberFilter(customer, tactics.preferredProviderNudge.memberFilter)
  ) {
    if (resolvedProvider && lowDemandSlots.length > 0) {
      return {
        ...base,
        nudge: {
          type: "provider",
          message: `${resolvedProvider} has availability at off-peak times — book now and skip the rush.`,
          suggestedSlots: lowDemandSlots,
        },
      };
    }
    // High tier but no provider data — frictionless path, no nudge
    return { ...base, nudge: { type: "none" } };
  }

  // ── Mid tier: 10% off at low-demand time ─────────────────────────────────
  if (
    tier === "mid" &&
    tactics.incentiveMidTier.enabled &&
    passesMemberFilter(customer, tactics.incentiveMidTier.memberFilter)
  ) {
    const offer = tactics.incentiveMidTier.offer;
    if (!offer) return { ...base, nudge: { type: "none" } };

    const discountCode =
      discountCodes.getCode(offer.discountCodePrefix) ?? `${offer.discountCodePrefix}-DEMO`;

    return {
      ...base,
      nudge: {
        type: "incentive",
        message: `Book at an off-peak time and save ${offer.displayLabel}.`,
        offer: {
          type: offer.type,
          value: offer.value,
          displayLabel: offer.displayLabel,
          discountCode,
          constraint: tactics.incentiveMidTier.constraint,
        },
        suggestedSlots: lowDemandSlots,
      },
    };
  }

  // ── Low tier: $10 off any time ───────────────────────────────────────────
  if (
    tier === "low" &&
    tactics.incentiveLowTier.enabled &&
    passesMemberFilter(customer, tactics.incentiveLowTier.memberFilter)
  ) {
    const offer = tactics.incentiveLowTier.offer;
    if (!offer) return { ...base, nudge: { type: "none" } };

    const discountCode =
      discountCodes.getCode(offer.discountCodePrefix) ?? `${offer.discountCodePrefix}-DEMO`;

    return {
      ...base,
      nudge: {
        type: "incentive",
        message: `Welcome back — enjoy ${offer.displayLabel} on your next visit.`,
        offer: {
          type: offer.type,
          value: offer.value,
          displayLabel: offer.displayLabel,
          discountCode,
          constraint: tactics.incentiveLowTier.constraint,
        },
      },
    };
  }

  // ── Fallback: no active tactic applies ───────────────────────────────────
  return { ...base, nudge: { type: "none" } };
}
