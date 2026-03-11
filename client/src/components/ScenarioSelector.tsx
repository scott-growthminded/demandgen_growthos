/**
 * ScenarioSelector
 *
 * Demo panel for quickly loading pre-scripted customer scenarios into the
 * booking widget. Fixed in the bottom-right corner, collapsed by default.
 *
 * Clicking a scenario navigates to /?e={email}&u={userType} — the booking
 * widget reads those URL params and jumps directly to the datetime step
 * with the demo customer pre-loaded.
 *
 * Scenarios:
 *   A – High-Tier Loyalist  → provider nudge (member, off-peak)
 *   B – Mid-Tier Time Shift → 10% off incentive (non-member, off-peak)
 *   C – Low-Tier Recovery   → $10 off any time (non-member, lapsed)
 *   D – New Customer        → frictionless direct-to-checkout
 */

import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";

// ── Scenario definitions ──────────────────────────────────────────────────────

interface Scenario {
  id: string;
  label: string;
  tier: "high" | "mid" | "low" | "new";
  description: string;
  email: string;
  userType: "member" | "non-member" | "new";
}

const SCENARIOS: Scenario[] = [
  {
    id: "high",
    label: "High-Tier Loyalist",
    tier: "high",
    description: "Member · Preferred provider nudge at off-peak times",
    email: "madisonbailey@live.com",
    userType: "member",
  },
  {
    id: "mid",
    label: "Mid-Tier Time Shift",
    tier: "mid",
    description: "Non-member · 10% off at low-demand slots",
    email: "kristen.mitchell@hotmail.com",
    userType: "non-member",
  },
  {
    id: "low",
    label: "Low-Tier Recovery",
    tier: "low",
    description: "Lapsed non-member · $10 off any time + membership CTA",
    email: "juliana.morris@aol.com",
    userType: "non-member",
  },
  {
    id: "new",
    label: "New Customer",
    tier: "new",
    description: "First visit · No nudge · Direct to checkout",
    email: "newguest.demo@glowbar.com",
    userType: "new",
  },
];

// ── Tier badge styles ─────────────────────────────────────────────────────────

const TIER_PILL: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  mid: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
  new: "bg-blue-100 text-blue-800",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ScenarioSelector() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [isOpen, setIsOpen] = useState(false);

  // Derive active scenario from current URL params
  const currentEmail = new URLSearchParams(search).get("e");
  const active = SCENARIOS.find((s) => s.email === currentEmail) ?? null;

  const handleScenario = (scenario: Scenario) => {
    navigate(
      `/?e=${encodeURIComponent(scenario.email)}&u=${scenario.userType}`
    );
    setIsOpen(false);
  };

  const handleReset = () => {
    navigate("/");
  };

  return (
    <Card
      className="fixed bottom-4 right-4 w-72 z-50 shadow-lg border border-gray-200"
      data-testid="scenario-selector"
    >
      {/* Header */}
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Play className="h-3.5 w-3.5 text-gray-400" />
            Demo Scenarios
          </span>
          <div className="flex items-center gap-2">
            {active && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIER_PILL[active.tier]}`}
              >
                {active.tier.toUpperCase()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400"
              onClick={() => setIsOpen(!isOpen)}
              data-testid="button-toggle-scenarios"
              aria-label={isOpen ? "Collapse scenarios" : "Expand scenarios"}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardTitle>
        {active && !isOpen && (
          <p className="text-xs text-gray-500 mt-0.5 ml-5">{active.label}</p>
        )}
      </CardHeader>

      {/* Scenario list */}
      {isOpen && (
        <CardContent className="px-4 pb-4 space-y-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => handleScenario(scenario)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-300 ${
                active?.id === scenario.id
                  ? "border-gray-400 bg-gray-50"
                  : "border-gray-200 bg-white"
              }`}
              data-testid={`scenario-${scenario.id}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIER_PILL[scenario.tier]}`}
                >
                  {scenario.tier.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {scenario.label}
                </span>
              </div>
              <p className="text-xs text-gray-500">{scenario.description}</p>
            </button>
          ))}

          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full text-xs text-gray-600"
              data-testid="button-reset-scenario"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Reset Flow
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
