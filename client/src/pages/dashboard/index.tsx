import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Save,
  RefreshCw,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Star,
  UserX,
} from "lucide-react";

// ─── Local types (mirror shared/schema.ts) ─────────────────────────────────

interface TacticOffer {
  type: "percent_off" | "dollar_off";
  value: number;
  displayLabel: string;
  discountCodePrefix: string;
}

interface Tactic {
  enabled: boolean;
  label: string;
  description: string;
  targetTiers: string[];
  memberFilter: string;
  constraint: string;
  offer: TacticOffer | null;
}

interface TacticsConfig {
  updatedAt: string;
  updatedBy: string;
  thresholds: {
    lowDemandUtilization: number;
    lapsedMidDays: number;
    lapsedLowDays: number;
    highPropensityNps: number;
    midPropensityNps: number;
    lowDemandDayThreshold: number;
    lowDemandTimeMinDays: number;
  };
  tactics: {
    preferredProviderNudge: Tactic;
    incentiveMidTier: Tactic;
    incentiveLowTier: Tactic;
    membershipCta: Tactic;
  };
}

interface DayTimeSlot {
  hour: number;
  displayTime: string;
  avgUtilization: number;
}

interface LowDemandTimeByDay {
  dayOfWeek: string;
  lowDemandHours: DayTimeSlot[];
}

interface IncentiveFactors {
  lowDemandDays: { day: string; lowDemandSlotCount: number; totalSlots: number; avgUtilization: number }[];
  lowDemandTimeWindows: { hour: number; displayTime: string; daysWithLowDemand: number; avgUtilization: number }[];
  lowDemandTimesByDay: LowDemandTimeByDay[];
  providerSignal: { providerName: string | null; locationHasProvider: boolean; totalLowDemandSlots: number };
}

interface Customer {
  id: string;
  name: string;
  email: string;
  studio: string;
  npsRating: number;
  npsLabel: string;
  isMember: boolean;
  memberStatus: string;
  preferredProvider: string;
  daysSinceLastVisit: number;
  lapsed: boolean;
  propensityTier: "high" | "mid" | "low";
  propensityScore: number;
  clv: string;
  appointmentCount: number;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    high: "bg-green-100 text-green-800 border border-green-200",
    mid: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    low: "bg-red-100 text-red-800 border border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[tier] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {tier}
    </span>
  );
}

function NpsChip({ rating, label }: { rating: number; label: string }) {
  const color =
    rating >= 9
      ? "text-green-600"
      : rating >= 7
      ? "text-yellow-600"
      : "text-red-600";
  return (
    <span className={`text-sm font-semibold ${color}`}>
      {rating}
      <span className="text-xs font-normal text-gray-400 ml-1">· {label}</span>
    </span>
  );
}

const THRESHOLD_LABELS: Record<string, string> = {
  lowDemandUtilization: "Low-demand utilization threshold",
  lapsedMidDays: "Lapsed mid-tier (days)",
  lapsedLowDays: "Lapsed low-tier (days)",
  highPropensityNps: "High-propensity NPS minimum",
  midPropensityNps: "Mid-propensity NPS minimum",
};

const PROPENSITY_THRESHOLD_KEYS = [
  "lowDemandUtilization",
  "lapsedMidDays",
  "lapsedLowDays",
  "highPropensityNps",
  "midPropensityNps",
] as const;

const TACTIC_KEYS = [
  "preferredProviderNudge",
  "incentiveMidTier",
  "incentiveLowTier",
  "membershipCta",
] as const;
type TacticKey = (typeof TACTIC_KEYS)[number];

// ─── Main Dashboard ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [config, setConfig] = useState<TacticsConfig | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [supplySignals, setSupplySignals] = useState<IncentiveFactors | null>(null);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");

  useEffect(() => {
    fetchConfig();
    fetchCustomers();
    fetchAvailableLocations();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/tactics/config");
      if (res.ok) setConfig(await res.json());
    } catch {
      /* ignore */
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await fetch("/api/personalization/customers");
      if (res.ok) setCustomers(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchSupplySignals = async (location: string) => {
    if (!location) return;
    setSupplySignals(null);
    try {
      const res = await fetch(`/api/supply-signals?location=${encodeURIComponent(location)}`);
      if (res.ok) setSupplySignals((await res.json()).signals);
    } catch {
      /* ignore */
    }
  };

  const fetchAvailableLocations = async () => {
    try {
      const res = await fetch("/api/availability");
      if (res.ok) {
        const locs: string[] = (await res.json()).locations;
        setAvailableLocations(locs);
        if (locs.length > 0) {
          setSelectedLocation(locs[0]);
          fetchSupplySignals(locs[0]);
        }
      }
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload: TacticsConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: "dashboard",
      };
      const res = await fetch("/api/tactics/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated: TacticsConfig = await res.json();
        setConfig(updated);
        setSaveStatus("saved");
        if (selectedLocation) fetchSupplySignals(selectedLocation);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const setTacticEnabled = (key: TacticKey, enabled: boolean) => {
    if (!config) return;
    setConfig({
      ...config,
      tactics: {
        ...config.tactics,
        [key]: { ...config.tactics[key], enabled },
      },
    });
  };

  const setOfferValue = (key: TacticKey, raw: string) => {
    if (!config) return;
    const value = parseFloat(raw);
    if (isNaN(value)) return;
    const tactic = config.tactics[key];
    if (!tactic.offer) return;
    const displayLabel =
      tactic.offer.type === "percent_off"
        ? `${value}% off`
        : `$${value} off`;
    setConfig({
      ...config,
      tactics: {
        ...config.tactics,
        [key]: {
          ...tactic,
          offer: { ...tactic.offer, value, displayLabel },
        },
      },
    });
  };

  const setThreshold = (
    key: keyof TacticsConfig["thresholds"],
    raw: string
  ) => {
    if (!config) return;
    const value = parseFloat(raw);
    if (isNaN(value)) return;
    setConfig({
      ...config,
      thresholds: { ...config.thresholds, [key]: value },
    });
  };

  // ── Monitoring derived stats ─────────────────────────────────────────────
  const byTier = {
    high: customers.filter((c) => c.propensityTier === "high"),
    mid: customers.filter((c) => c.propensityTier === "mid"),
    low: customers.filter((c) => c.propensityTier === "low"),
  };
  const members = customers.filter((c) => c.isMember).length;
  const lapsedCount = customers.filter((c) => c.lapsed).length;
  const providerNudgeEligible = byTier.high.filter(
    (c) => c.preferredProvider
  ).length;
  const filteredCustomers =
    tierFilter === "all"
      ? customers
      : customers.filter((c) => c.propensityTier === tierFilter);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        <RefreshCw className="animate-spin mr-2 h-5 w-5" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-5 h-12 flex items-center gap-5 shadow-sm sticky top-0 z-40">
        <span className="font-bold text-gray-900 tracking-tight text-base">
          Glowbar
        </span>
        <span className="text-gray-200">|</span>
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Booking Flow
        </a>
        <a
          href="/dashboard"
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          Operator Dashboard
        </a>
        {/* right side — save controls */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden md:block">
            Saved {new Date(config.updatedAt).toLocaleString()}
          </span>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-save-config"
          >
            {saving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save Changes
          </Button>
          {saveStatus === "saved" && (
            <span className="text-green-600 text-sm flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600 text-sm flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Error saving
            </span>
          )}
        </div>
      </div>

      {/* ── Dashboard subtitle ───────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-base font-semibold text-gray-900">
            UtilizationOS — Optimize Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            JIT Booking Personalization · Phase 0 POC
          </p>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="controls">
          <TabsList className="mb-6">
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════════════════════════
              CONTROLS TAB
          ════════════════════════════════════════════════════════════ */}
          <TabsContent value="controls">
            <div className="grid gap-6">
              {/* Tactics list */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Active Tactics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {TACTIC_KEYS.map((key) => {
                    const tactic = config.tactics[key];
                    const isDisabled = !tactic.enabled;
                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                          isDisabled
                            ? "bg-gray-50 border-gray-200 opacity-60"
                            : "bg-white border-gray-200"
                        }`}
                        data-testid={`tactic-row-${key}`}
                      >
                        {/* Toggle */}
                        <div className="flex-shrink-0 pt-0.5">
                          <Switch
                            checked={tactic.enabled}
                            onCheckedChange={(v) => setTacticEnabled(key, v)}
                            data-testid={`toggle-${key}`}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {tactic.label}
                            </span>
                            {tactic.targetTiers.map((t) => (
                              <TierBadge key={t} tier={t} />
                            ))}
                            <span className="text-xs text-gray-400">
                              · {tactic.memberFilter} · {tactic.constraint}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {tactic.description}
                          </p>

                          {/* Offer value editor */}
                          {tactic.offer && (
                            <div className="flex items-center gap-2 mt-3">
                              <Label className="text-xs text-gray-600 shrink-0">
                                {tactic.offer.type === "percent_off"
                                  ? "Discount %"
                                  : "Discount $"}
                              </Label>
                              <Input
                                type="number"
                                value={tactic.offer.value}
                                onChange={(e) =>
                                  setOfferValue(key, e.target.value)
                                }
                                className="h-7 w-20 text-sm px-2"
                                min={1}
                                max={
                                  tactic.offer.type === "percent_off"
                                    ? 100
                                    : 500
                                }
                                step={1}
                                disabled={isDisabled}
                                data-testid={`offer-value-${key}`}
                              />
                              <span className="text-xs text-gray-400">
                                → displays as &ldquo;
                                {tactic.offer.displayLabel}&rdquo; · code prefix{" "}
                                <code className="bg-gray-100 px-1 rounded">
                                  {tactic.offer.discountCodePrefix}
                                </code>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Propensity Thresholds */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Propensity Thresholds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PROPENSITY_THRESHOLD_KEYS.map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs text-gray-600">
                          {THRESHOLD_LABELS[key]}
                        </Label>
                        <Input
                          type="number"
                          value={config.thresholds[key]}
                          onChange={(e) => setThreshold(key, e.target.value)}
                          className="h-8 text-sm"
                          step={key === "lowDemandUtilization" ? 0.05 : 1}
                          min={0}
                          max={key === "lowDemandUtilization" ? 1 : 365}
                          data-testid={`threshold-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Supply Signal Parameters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Supply Signal Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">
                        Low-demand day threshold
                      </Label>
                      <Input
                        type="number"
                        value={config.thresholds.lowDemandDayThreshold}
                        onChange={(e) => setThreshold("lowDemandDayThreshold", e.target.value)}
                        className="h-8 text-sm"
                        step={0.05}
                        min={0}
                        max={1}
                        data-testid="threshold-lowDemandDayThreshold"
                      />
                      <p className="text-xs text-gray-400">
                        Fraction of a day's slots that must be low-demand for the day to qualify
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">
                        Off-peak window min days
                      </Label>
                      <Input
                        type="number"
                        value={config.thresholds.lowDemandTimeMinDays}
                        onChange={(e) => setThreshold("lowDemandTimeMinDays", e.target.value)}
                        className="h-8 text-sm"
                        step={1}
                        min={1}
                        max={7}
                        data-testid="threshold-lowDemandTimeMinDays"
                      />
                      <p className="text-xs text-gray-400">
                        Distinct days an hour must be low-demand to qualify as an off-peak window
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Signal Output */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Signal Output
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">reflects last saved thresholds</p>
                    </div>
                    <select
                      value={selectedLocation}
                      onChange={(e) => {
                        setSelectedLocation(e.target.value);
                        fetchSupplySignals(e.target.value);
                      }}
                      className="border border-gray-200 rounded text-sm px-2 py-1 text-gray-700 bg-white"
                      data-testid="supply-location-select"
                    >
                      {availableLocations.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  {!supplySignals ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="animate-pulse bg-gray-100 rounded h-4 w-2/3" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      {/* Low-demand days */}
                      <div>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Low-demand days</span>
                        <p className="text-gray-700 mt-1">
                          {supplySignals.lowDemandDays.length > 0
                            ? supplySignals.lowDemandDays
                                .map((d) => `${d.day} (${Math.round(d.avgUtilization * 100)}% avg, ${d.lowDemandSlotCount}/${d.totalSlots} slots)`)
                                .join(" · ")
                            : <span className="text-gray-400">—</span>}
                        </p>
                      </div>

                      {/* Off-peak windows (cross-day aggregate) */}
                      <div>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Off-peak windows (all days)</span>
                        <p className="text-gray-700 mt-1">
                          {supplySignals.lowDemandTimeWindows.length > 0 ? (() => {
                            const tw = supplySignals.lowDemandTimeWindows;
                            const first = tw[0].displayTime;
                            const last = tw[tw.length - 1].displayTime;
                            const maxDays = Math.max(...tw.map((w) => w.daysWithLowDemand));
                            return `${first}–${last} · ${tw.length} qualifying hours · ${maxDays} days max`;
                          })() : <span className="text-gray-400">—</span>}
                        </p>
                      </div>

                      {/* Off-peak by day */}
                      <div>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Off-peak by day</span>
                        {supplySignals.lowDemandTimesByDay.length > 0 ? (
                          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 mt-1">
                            {supplySignals.lowDemandTimesByDay.map((d) => {
                              const hours = d.lowDemandHours;
                              const timeRange = hours.length > 0
                                ? `${hours[0].displayTime}–${hours[hours.length - 1].displayTime}`
                                : "—";
                              return (
                                <div key={d.dayOfWeek} className="flex gap-2 text-xs">
                                  <span className="text-gray-400 w-24 shrink-0">{d.dayOfWeek}</span>
                                  <span className="text-gray-700">{timeRange} · {hours.length} hrs</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-400 mt-1">—</p>
                        )}
                      </div>

                      {/* Total low-demand slots */}
                      <div>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total low-demand slots</span>
                        <p className="text-gray-700 mt-1">
                          {supplySignals.providerSignal.totalLowDemandSlots} slots
                        </p>
                      </div>

                      <p className="text-xs text-gray-400 italic pt-1 border-t border-gray-100">
                        Provider signal requires customer context — see booking flow Incentive Logic bar
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════
              MONITORING TAB
          ════════════════════════════════════════════════════════════ */}
          <TabsContent value="monitoring">
            <div className="grid gap-6">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  {
                    label: "Total",
                    value: customers.length,
                    icon: Users,
                    color: "text-gray-700",
                    bg: "bg-white",
                  },
                  {
                    label: "High tier",
                    value: byTier.high.length,
                    icon: TrendingUp,
                    color: "text-green-700",
                    bg: "bg-green-50",
                  },
                  {
                    label: "Mid tier",
                    value: byTier.mid.length,
                    icon: TrendingUp,
                    color: "text-yellow-700",
                    bg: "bg-yellow-50",
                  },
                  {
                    label: "Low tier",
                    value: byTier.low.length,
                    icon: AlertCircle,
                    color: "text-red-700",
                    bg: "bg-red-50",
                  },
                  {
                    label: "Members",
                    value: members,
                    icon: Star,
                    color: "text-blue-700",
                    bg: "bg-blue-50",
                  },
                  {
                    label: "Lapsed",
                    value: lapsedCount,
                    icon: UserX,
                    color: "text-orange-700",
                    bg: "bg-orange-50",
                  },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <Card key={label} className={`${bg} border`}>
                    <CardContent className="px-4 pt-3 pb-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                      <div className={`text-2xl font-bold ${color}`}>
                        {value}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Opportunity cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="px-4 pt-3 pb-3">
                    <div className="text-xs font-semibold text-green-800 mb-1">
                      Provider Nudge Eligible
                    </div>
                    <div className="text-3xl font-bold text-green-700">
                      {providerNudgeEligible}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      High-tier with known preferred provider
                    </div>
                    <div className="mt-2 text-xs text-green-700 font-medium">
                      Tactic:{" "}
                      {config.tactics.preferredProviderNudge.enabled ? (
                        <span className="text-green-700">✓ On</span>
                      ) : (
                        <span className="text-gray-400">Off</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="px-4 pt-3 pb-3">
                    <div className="text-xs font-semibold text-yellow-800 mb-1">
                      Mid-Tier Incentive Eligible
                    </div>
                    <div className="text-3xl font-bold text-yellow-700">
                      {byTier.mid.length}
                    </div>
                    <div className="text-xs text-yellow-600 mt-1">
                      Eligible for{" "}
                      {config.tactics.incentiveMidTier.offer?.displayLabel ??
                        "mid offer"}{" "}
                      at off-peak times
                    </div>
                    <div className="mt-2 text-xs text-yellow-700 font-medium">
                      Tactic:{" "}
                      {config.tactics.incentiveMidTier.enabled ? (
                        <span className="text-yellow-700">✓ On</span>
                      ) : (
                        <span className="text-gray-400">Off</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                  <CardContent className="px-4 pt-3 pb-3">
                    <div className="text-xs font-semibold text-red-800 mb-1">
                      Recovery Offer Eligible
                    </div>
                    <div className="text-3xl font-bold text-red-700">
                      {byTier.low.length}
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      Low-tier targeted for{" "}
                      {config.tactics.incentiveLowTier.offer?.displayLabel ??
                        "recovery offer"}{" "}
                      winback
                    </div>
                    <div className="mt-2 text-xs text-red-700 font-medium">
                      Tactic:{" "}
                      {config.tactics.incentiveLowTier.enabled ? (
                        <span className="text-red-700">✓ On</span>
                      ) : (
                        <span className="text-gray-400">Off</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="px-4 pt-3 pb-3">
                    <div className="text-xs font-semibold text-blue-800 mb-1">
                      Membership CTA Eligible
                    </div>
                    <div className="text-3xl font-bold text-blue-700">
                      {customers.length - members}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Non-members who'll see the membership CTA at confirmation
                    </div>
                    <div className="mt-2 text-xs text-blue-700 font-medium">
                      Tactic:{" "}
                      {config.tactics.membershipCta.enabled ? (
                        <span className="text-blue-700">✓ On</span>
                      ) : (
                        <span className="text-gray-400">Off</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Customer table */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Customer Segments ({filteredCustomers.length})
                    </CardTitle>
                    {/* Tier filter */}
                    <div className="flex gap-1">
                      {(["all", "high", "mid", "low"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTierFilter(t)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            tierFilter === t
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          data-testid={`filter-tier-${t}`}
                        >
                          {t === "all"
                            ? "All"
                            : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingCustomers ? (
                    <div className="flex items-center justify-center h-32 text-gray-400">
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Loading customers…
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[520px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Studio</TableHead>
                            <TableHead className="text-xs">Tier</TableHead>
                            <TableHead className="text-xs">NPS</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Provider</TableHead>
                            <TableHead className="text-xs">CLV</TableHead>
                            <TableHead className="text-xs">
                              Days Since Visit
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCustomers.map((customer) => (
                            <TableRow
                              key={customer.id}
                              className={
                                customer.lapsed ? "bg-red-50/30" : ""
                              }
                              data-testid={`customer-row-${customer.id}`}
                            >
                              <TableCell>
                                <div className="font-medium text-sm text-gray-900">
                                  {customer.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {customer.email}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {customer.studio}
                              </TableCell>
                              <TableCell>
                                <TierBadge tier={customer.propensityTier} />
                              </TableCell>
                              <TableCell>
                                <NpsChip
                                  rating={customer.npsRating}
                                  label={customer.npsLabel}
                                />
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`text-xs font-medium ${
                                    customer.isMember
                                      ? "text-blue-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {customer.memberStatus}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {customer.preferredProvider || (
                                  <span className="text-gray-300">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {customer.clv}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`text-sm ${
                                    customer.lapsed
                                      ? "text-red-600 font-semibold"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {customer.daysSinceLastVisit}d
                                </span>
                                {customer.lapsed && (
                                  <span className="ml-1 text-xs text-red-400">
                                    lapsed
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
