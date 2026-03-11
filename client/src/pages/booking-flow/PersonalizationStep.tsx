/**
 * Personalization Step
 *
 * Fires immediately after customer identification (login or personal-info).
 * Calls POST /api/personalization/recommendation with email + selected location.
 *
 * Routing outcomes:
 *   - nudge.type === 'provider'   → show ProviderNudge, then checkout
 *   - nudge.type === 'incentive'  → show IncentiveOffer, then checkout
 *   - nudge.type === 'none'       → auto-advance to checkout (frictionless path)
 *   - 404 (new customer, no profile) → auto-advance to checkout
 *   - Error                       → show "Continue" fallback
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useBookingFlow, type Recommendation, type AppliedOffer } from "@/contexts/BookingFlowContext";
import { ProviderNudge } from "@/components/booking/ProviderNudge";
import { IncentiveOffer } from "@/components/booking/IncentiveOffer";

export function PersonalizationStep() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const fetchRecommendation = async () => {
      const email = state.email;

      // No email means a brand-new guest — skip personalization
      if (!email) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/personalization/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            location: state.selectedLocation?.name ?? null,
          }),
        });

        if (res.ok) {
          const data: Recommendation = await res.json();
          setRecommendation(data);
          // Persist recommendation to context for downstream use (checkout, confirmation)
          updateUserData({ recommendation: data });

          // If member status is reflected in the profile but wasn't set from login,
          // update isMember in context so checkout renders correctly
          if (data.membershipCta === false && state.userType === null) {
            // customer is a member — membershipCta is false only for members
            // (handled via setUserType in LoginPage; this is a safety net)
          }
        } else if (res.status === 404) {
          // No customer profile — new guest, no nudge
          setRecommendation(null);
        } else {
          setFetchError(true);
        }
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance when there's no actionable nudge
  useEffect(() => {
    if (loading) return;

    const hasNudge =
      recommendation &&
      (recommendation.nudge.type === "provider" ||
        recommendation.nudge.type === "incentive");

    if (!hasNudge && !fetchError) {
      // Brief deliberate pause so the screen doesn't flash
      const timer = setTimeout(() => setCurrentStep("checkout"), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, recommendation, fetchError, setCurrentStep]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAccept = (offer?: AppliedOffer) => {
    if (offer) {
      updateUserData({ appliedOffer: offer });
    }
    setCurrentStep("checkout");
  };

  const handleSkip = () => {
    setCurrentStep("checkout");
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
          <p className="text-gray-500 text-sm">Personalizing your experience…</p>
        </div>
      </div>
    );
  }

  // ── Error fallback ─────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-gray-500 text-sm">
            Couldn't load your personalized offer right now.
          </p>
          <Button
            onClick={handleSkip}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-skip-error"
          >
            Continue to Checkout
          </Button>
        </div>
      </div>
    );
  }

  // ── Auto-advancing (no nudge) ──────────────────────────────────────────────
  // Shown briefly while the 400ms timer fires

  if (!recommendation || recommendation.nudge.type === "none") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  // ── Render nudge ───────────────────────────────────────────────────────────

  const { nudge } = recommendation;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto pt-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h1
            className="text-xl font-semibold text-gray-800"
            data-testid="text-page-title"
          >
            A note before you book
          </h1>
        </div>

        {/* Tier indicator — visible in development for demo scripting */}
        {import.meta.env.DEV && (
          <div className="text-xs text-gray-400 bg-gray-100 rounded px-3 py-1.5 font-mono">
            tier: {recommendation.propensityTier} · score:{" "}
            {recommendation.propensityScore.toFixed(2)} · nudge: {nudge.type}
          </div>
        )}

        <Card className="p-6">
          {nudge.type === "provider" &&
            nudge.message &&
            recommendation.preferredProvider && (
              <ProviderNudge
                provider={recommendation.preferredProvider}
                message={nudge.message}
                suggestedSlots={nudge.suggestedSlots ?? []}
                onAccept={() => handleAccept()}
                onSkip={handleSkip}
              />
            )}

          {nudge.type === "incentive" && nudge.offer && nudge.message && (
            <IncentiveOffer
              offer={nudge.offer}
              message={nudge.message}
              suggestedSlots={nudge.suggestedSlots ?? []}
              onAccept={() =>
                handleAccept({
                  displayLabel: nudge.offer!.displayLabel,
                  discountCode: nudge.offer!.discountCode,
                })
              }
              onSkip={handleSkip}
            />
          )}
        </Card>

        {/* Membership CTA — shown below nudge for non-members */}
        {recommendation.membershipCta && (
          <div
            className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-center space-y-2"
            data-testid="section-membership-cta"
          >
            <p className="font-medium text-purple-800">
              Become a Glowbar member and save on every visit
            </p>
            <p className="text-purple-600">
              Members get priority booking, voucher redemption, and exclusive perks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
