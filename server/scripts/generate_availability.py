#!/usr/bin/env python3
"""
generate_availability.py
------------------------
Generates server/data/availability.json from Boulevard completed appointment CSV.

Utilization approach: RELATIVE, WITHIN-DAY
  - For each location × day-of-week × start-time slot, count completed appointments
  - Normalize each count against that day-of-week's own peak count at that location
  - utilizationRate = 0.0 (never booked) → 1.0 (busiest slot on that day at that location)
  - isLowDemand = utilizationRate < LOW_DEMAND_THRESHOLD

Why within-day relative (not absolute, not location-wide):
  - No provider/staff schedule data in CSV → can't compute absolute capacity
  - Location-wide normalization is misleading: Saturday's peak (~976 at Union Square)
    makes every weekday slot look low-demand even when it's genuinely busy
  - Within-day normalization answers the real question: "is this slot underutilized
    relative to the busiest slot on this same day of the week?"
  - This correctly identifies "Tuesday 10am is underbooked vs Tuesday peak" without
    comparing it to Saturday's unrelated volume

Slot granularity: exact start times from data (not forced to a fixed cadence).
  Some locations run a single 40-min chain (8:00, 8:40, 9:20...),
  others run staggered chains (Union Square has two interleaved 40-min sequences).

Usage:
  python3 server/scripts/generate_availability.py \
    --csv "/path/to/boulevard_completed_appointment_data_*.csv" \
    --out server/data/availability.json
"""

import argparse
import collections
import csv
import json
import math
import os
import sys
from datetime import datetime

# ── Constants ─────────────────────────────────────────────────────────────────

LOW_DEMAND_THRESHOLD = 0.6   # slots with utilizationRate < this → isLowDemand
                             # utilizationRate is within-day-relative: slot_count / peak_for_that_day
                             # 0.6 = "less than 60% as busy as the peak slot on this day of week"
MIN_SLOT_COUNT = 5           # hard floor: ignore slots with fewer total historical bookings
MIN_PCT_OF_PEAK = 0.03       # relative floor: ignore slots with < 3% of location's peak count
                             # this removes off-cadence noise (e.g. Sat 2:10pm with 5 bookings
                             # vs Sat 2:00pm with 976) while scaling correctly for small locations
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_start_time(time_str: str) -> tuple[int, int, str]:
    """
    Parse a time string like "8:00 AM" or "4:10 PM" into (hour_24, minute, displayTime).
    Returns (hour, minute, original_display_string).
    """
    try:
        t = datetime.strptime(time_str.strip(), "%I:%M %p")
        return t.hour, t.minute, time_str.strip()
    except ValueError:
        # Try without space: "8:00AM"
        try:
            t = datetime.strptime(time_str.strip(), "%I:%M%p")
            return t.hour, t.minute, time_str.strip()
        except ValueError:
            return None, None, time_str.strip()


def parse_date_to_dow(date_str: str) -> str | None:
    """
    Parse a date string like "Apr 9, 2024" into a day-of-week name ("Monday").
    """
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%A")
        except ValueError:
            continue
    return None


def format_display_time(hour: int, minute: int) -> str:
    """Convert 24h hour+minute to display string: "8:00 AM", "12:40 PM", "4:10 PM"."""
    dt = datetime(2000, 1, 1, hour, minute)
    return dt.strftime("%-I:%M %p")   # e.g. "8:00 AM" (no leading zero)


# ── Main processing ───────────────────────────────────────────────────────────

def process(csv_path: str, out_path: str, threshold: float, min_count: int, min_pct_of_peak: float):
    print(f"Reading: {csv_path}")

    # counts[location][day_of_week][(hour, minute)] = appointment_count
    counts: dict[str, dict[str, dict[tuple[int, int], int]]] = collections.defaultdict(
        lambda: collections.defaultdict(lambda: collections.defaultdict(int))
    )

    total_rows = 0
    skipped_cancelled = 0
    skipped_parse = 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Filter: keep only completed, non-cancelled appointments
            if row.get("Is Cancelled", "false").lower() == "true":
                skipped_cancelled += 1
                continue
            if row.get("Appointment State", "").strip() != "Final":
                skipped_cancelled += 1
                continue

            location = row.get("Location Name", "").strip()
            date_str = row.get("Appointment Date Loc", "").strip()
            time_str = row.get("Appointment Start Time Loc", "").strip()

            if not location or not date_str or not time_str:
                skipped_parse += 1
                continue

            dow = parse_date_to_dow(date_str)
            if not dow:
                skipped_parse += 1
                continue

            hour, minute, _ = parse_start_time(time_str)
            if hour is None:
                skipped_parse += 1
                continue

            counts[location][dow][(hour, minute)] += 1
            total_rows += 1

    print(f"  Loaded {total_rows:,} completed appointments")
    print(f"  Skipped {skipped_cancelled:,} cancelled/non-final")
    print(f"  Skipped {skipped_parse:,} unparseable rows")
    print(f"  Locations: {sorted(counts.keys())}")

    # ── Build location records ─────────────────────────────────────────────────
    locations = []

    for location_name in sorted(counts.keys()):
        dow_data = counts[location_name]

        # Flatten all (dow, hour, minute) → count for this location
        all_slot_counts: list[tuple[str, int, int, int]] = []   # (dow, hour, minute, count)
        for dow, slot_map in dow_data.items():
            for (hour, minute), cnt in slot_map.items():
                all_slot_counts.append((dow, hour, minute, cnt))

        # Two-stage noise filter:
        # 1. Hard floor: absolute minimum bookings ever
        all_slot_counts = [(d, h, m, c) for (d, h, m, c) in all_slot_counts if c >= min_count]
        # 2. Relative floor: must be at least min_pct_of_peak of the provisional peak
        #    This removes off-cadence noise (e.g. "Sat 2:10 PM" with 5 bookings next to
        #    "Sat 2:00 PM" with 976) without hurting legitimate low-utilization slots
        if all_slot_counts:
            provisional_peak = max(c for (_, _, _, c) in all_slot_counts)
            pct_floor = provisional_peak * min_pct_of_peak
            all_slot_counts = [(d, h, m, c) for (d, h, m, c) in all_slot_counts if c >= pct_floor]

        if not all_slot_counts:
            print(f"  WARNING: {location_name} has no slots after noise filter — skipping")
            continue

        total_appts = sum(c for (_, _, _, c) in all_slot_counts)

        # Within-day peaks: for each day-of-week, the max slot count on that day.
        # Used for normalization so Saturday volume doesn't make weekdays look low-demand.
        day_peaks: dict[str, int] = {}
        for (dow, _, _, cnt) in all_slot_counts:
            if cnt > day_peaks.get(dow, 0):
                day_peaks[dow] = cnt

        # Build slots
        slots = []
        for (dow, hour, minute, cnt) in sorted(
            all_slot_counts,
            key=lambda x: (DAY_ORDER.index(x[0]) if x[0] in DAY_ORDER else 7, x[1], x[2])
        ):
            utilization_rate = round(cnt / day_peaks[dow], 3)
            is_low_demand = utilization_rate < threshold
            display_time = format_display_time(hour, minute)

            slots.append({
                "dayOfWeek": dow,
                "hour": hour,
                "minute": minute,
                "displayTime": display_time,
                "utilizationRate": utilization_rate,
                "isLowDemand": is_low_demand,
                "rawCount": cnt,
            })

        # Derive business hours: earliest and latest start times across all slots
        all_times = [(h, m) for (_, h, m, _) in all_slot_counts]
        open_hour = min(h for h, m in all_times)
        close_hour = max(h for h, m in all_times)

        # dayPeaks: per-day-of-week peak slot counts (used for normalization)
        day_peaks_sorted = {
            d: day_peaks[d]
            for d in DAY_ORDER
            if d in day_peaks
        }

        locations.append({
            "name": location_name,
            "totalAppointments": total_appts,
            "dayPeaks": day_peaks_sorted,
            "businessHours": {"open": open_hour, "close": close_hour},
            "slots": slots,
        })

        low_demand_pct = sum(1 for s in slots if s["isLowDemand"]) / len(slots) * 100
        peak_summary = ", ".join(f"{d[:3]}={day_peaks[d]}" for d in DAY_ORDER if d in day_peaks)
        print(f"  {location_name}: {len(slots)} slots, {low_demand_pct:.0f}% low-demand "
              f"[day peaks: {peak_summary}]")

    # ── Write output ────────────────────────────────────────────────────────────
    output = {
        "generatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generatedFrom": os.path.basename(csv_path),
        "utilizationMethod": "relative-within-day",
        "lowDemandThreshold": threshold,
        "noiseFilter": {"minCount": min_count, "minPctOfPeak": min_pct_of_peak},
        "totalLocations": len(locations),
        "locations": locations,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    total_slots = sum(len(loc["slots"]) for loc in locations)
    print(f"\nWrote {out_path}")
    print(f"  {len(locations)} locations, {total_slots:,} total slots")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate availability.json from Boulevard CSV")
    parser.add_argument(
        "--csv",
        required=True,
        help="Path to boulevard completed appointment CSV",
    )
    parser.add_argument(
        "--out",
        default=os.path.join(
            os.path.dirname(__file__), "..", "data", "availability.json"
        ),
        help="Output path for availability.json (default: server/data/availability.json)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=LOW_DEMAND_THRESHOLD,
        help=f"Low-demand utilization threshold 0–1 (default: {LOW_DEMAND_THRESHOLD})",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=MIN_SLOT_COUNT,
        help=f"Hard minimum bookings for a slot to be included (default: {MIN_SLOT_COUNT})",
    )
    parser.add_argument(
        "--min-pct-of-peak",
        type=float,
        default=MIN_PCT_OF_PEAK,
        help=f"Relative noise filter: min fraction of location peak (default: {MIN_PCT_OF_PEAK})",
    )
    args = parser.parse_args()
    process(args.csv, args.out, args.threshold, args.min_count, args.min_pct_of_peak)
