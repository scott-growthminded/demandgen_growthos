/**
 * Segmentation Service
 *
 * Resolves the effective propensity tier for a customer, applying
 * any runtime overrides from the tactics config thresholds.
 *
 * For the POC, propensity tier and score are pre-computed in
 * customers.json and used directly. This service is the extension
 * point for real-time re-scoring when live data is available.
 */

import type { CustomerProfile, PropensityTier, TacticsConfig } from "@shared/schema";

/**
 * Return the customer's propensity tier, optionally re-evaluated
 * against the current threshold config (in case thresholds have
 * been edited in the dashboard since the data was generated).
 */
export function getEffectiveTier(
  customer: CustomerProfile,
  config: TacticsConfig
): PropensityTier {
  const { highPropensityNps, midPropensityNps, lapsedMidDays, lapsedLowDays } =
    config.thresholds;

  const nps = customer.npsRating;
  const days = customer.daysSinceLastVisit;
  const isMember = customer.isMember;

  // Lapsed status overrides NPS — a lapsed high-NPS customer still needs
  // re-engagement treatment
  if (days > lapsedLowDays || nps < midPropensityNps) {
    return "low";
  }

  if (days > lapsedMidDays || nps < highPropensityNps) {
    return "mid";
  }

  // Member bonus: NPS one point below high threshold still gets high tier
  if (isMember && nps === highPropensityNps - 1 && days <= lapsedMidDays) {
    return "high";
  }

  return "high";
}

/**
 * Determine whether a member filter constraint applies to this customer.
 * Used to decide if a tactic is eligible before firing.
 */
export function passesMemberFilter(
  customer: CustomerProfile,
  filter: "all" | "member" | "non_member"
): boolean {
  if (filter === "all") return true;
  if (filter === "member") return customer.isMember;
  if (filter === "non_member") return !customer.isMember;
  return true;
}
