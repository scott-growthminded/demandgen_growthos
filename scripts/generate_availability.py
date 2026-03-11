"""
Day 0: Generate availability.json from Boulevard appointment history.

Source: boulevard_completed_appointment_data_*.csv
Supplement: server/data/customers.json (for provider lists per studio)
Output: server/data/availability.json

Approach:
  - Aggregate completed appointments by Location × Day-of-week × Hour bucket
  - Compute relative utilization index per slot (slot count / max slot count for location)
  - Flag low-demand slots: utilization < LOW_DEMAND_THRESHOLD (0.60)
  - Extract provider lists per location from customers.json (Performed By × studio)
  - For each provider, assign them to slots based on plausible schedule coverage

Output shape:
  {
    "generatedAt": "YYYY-MM-DD",
    "lowDemandThreshold": 0.60,
    "locations": [
      {
        "name": "Upper East Side",
        "providers": ["Shaliyah Luck", ...],
        "slots": [
          {
            "dayOfWeek": "Monday",
            "hour": 14,
            "displayTime": "2:00 PM",
            "utilizationRate": 0.75,
            "isLowDemand": false,
            "rawCount": 1234
          }
        ]
      }
    ]
  }
"""

import csv
import json
import os
import sys
import glob
from collections import defaultdict
from datetime import datetime, date

LOW_DEMAND_THRESHOLD = 0.60
MIN_LOCATION_APPOINTMENTS = 1000   # filter out tiny/noise locations
REFERENCE_DATE = "2026-03-09"

BLVD_GLOB = os.path.join(
    os.path.dirname(__file__),
    "../../../Contract work/Growth Minded/Data/Data sets/boulevard_completed_appointment_data_*.csv"
)
CUSTOMERS_PATH = os.path.join(
    os.path.dirname(__file__),
    "../server/data/customers.json"
)
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "../server/data/availability.json"
)

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Hours the business operates (8am–8pm)
BUSINESS_HOURS = list(range(8, 21))


def parse_time_to_hour(time_str: str) -> int | None:
    """Parse '2:00 PM' → 14, '8:40 AM' → 8 (bucket to hour)."""
    if not time_str:
        return None
    try:
        t = datetime.strptime(time_str.strip(), "%I:%M %p")
        return t.hour
    except ValueError:
        try:
            t = datetime.strptime(time_str.strip(), "%H:%M")
            return t.hour
        except ValueError:
            return None


def parse_appointment_date(date_str: str) -> date | None:
    """Parse 'Apr 9, 2024' → date."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), "%b %d, %Y").date()
    except ValueError:
        try:
            return datetime.strptime(date_str.strip(), "%B %d, %Y").date()
        except ValueError:
            return None


def hour_to_display_time(hour: int) -> str:
    """Convert 14 → '2:00 PM'."""
    return datetime.strptime(f"{hour}:00", "%H:%M").strftime("%-I:%M %p")


def main():
    # --- Locate Boulevard CSV ---
    blvd_files = sorted(glob.glob(os.path.abspath(BLVD_GLOB)))
    if not blvd_files:
        print(f"ERROR: No Boulevard CSV found matching: {BLVD_GLOB}", file=sys.stderr)
        sys.exit(1)
    blvd_file = blvd_files[-1]  # most recent
    print(f"Using Boulevard file: {os.path.basename(blvd_file)}")

    # --- Load customers.json for provider lists per studio ---
    customers_path = os.path.abspath(CUSTOMERS_PATH)
    providers_by_studio: dict[str, set[str]] = defaultdict(set)
    if os.path.exists(customers_path):
        with open(customers_path) as f:
            customers = json.load(f)
        for c in customers:
            studio = c.get("studio", "").strip()
            provider = c.get("preferredProvider", "").strip()
            if studio and provider:
                providers_by_studio[studio].add(provider)
        print(f"Loaded provider lists from customers.json: {len(providers_by_studio)} studios")
    else:
        print("WARNING: customers.json not found — provider lists will be empty")

    # --- Aggregate Boulevard appointments ---
    # slot_counts[location][day_of_week][hour] = count
    slot_counts: dict[str, dict[str, dict[int, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    location_totals: dict[str, int] = defaultdict(int)
    total_rows = 0
    skipped = 0

    with open(blvd_file, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Appointment State") != "Final":
                continue
            total_rows += 1

            location = (row.get("Location Name") or "").strip()
            time_str = (row.get("Appointment Start Time Loc") or "").strip()
            date_str = (row.get("Appointment Date Loc") or "").strip()

            if not location or not time_str or not date_str:
                skipped += 1
                continue

            hour = parse_time_to_hour(time_str)
            appt_date = parse_appointment_date(date_str)

            if hour is None or appt_date is None:
                skipped += 1
                continue

            if hour not in BUSINESS_HOURS:
                skipped += 1
                continue

            day_of_week = DAYS[appt_date.weekday()]

            slot_counts[location][day_of_week][hour] += 1
            location_totals[location] += 1

    print(f"Processed {total_rows:,} appointments across {len(location_totals)} locations")
    print(f"Skipped: {skipped:,}")

    # --- Filter and build output ---
    output_locations = []

    for location in sorted(location_totals.keys()):
        if location_totals[location] < MIN_LOCATION_APPOINTMENTS:
            continue

        # Find max slot count for this location (normalization baseline)
        all_counts = [
            slot_counts[location][day][hour]
            for day in DAYS
            for hour in BUSINESS_HOURS
        ]
        max_count = max(all_counts) if all_counts else 1

        slots = []
        for day in DAYS:
            for hour in BUSINESS_HOURS:
                count = slot_counts[location][day].get(hour, 0)
                util_rate = round(count / max_count, 3) if max_count > 0 else 0.0
                is_low_demand = util_rate < LOW_DEMAND_THRESHOLD

                slots.append({
                    "dayOfWeek": day,
                    "hour": hour,
                    "displayTime": hour_to_display_time(hour),
                    "utilizationRate": util_rate,
                    "isLowDemand": is_low_demand,
                    "rawCount": count,
                })

        # Provider list — use customers.json; fall back to empty list
        providers = sorted(providers_by_studio.get(location, []))

        output_locations.append({
            "name": location,
            "totalAppointments": location_totals[location],
            "providers": providers,
            "slots": slots,
        })

    output = {
        "generatedAt": REFERENCE_DATE,
        "lowDemandThreshold": LOW_DEMAND_THRESHOLD,
        "businessHours": {
            "open": BUSINESS_HOURS[0],
            "close": BUSINESS_HOURS[-1],
        },
        "locations": output_locations,
    }

    output_path = os.path.abspath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Generated availability.json → {output_path}")
    print(f"  Locations included: {len(output_locations)}")

    # Summary
    for loc in output_locations:
        low_demand = sum(1 for s in loc["slots"] if s["isLowDemand"])
        total_slots = len(loc["slots"])
        print(f"  {loc['name']:30s} {loc['totalAppointments']:6,} appts  "
              f"{low_demand}/{total_slots} low-demand slots  "
              f"{len(loc['providers'])} providers")


if __name__ == "__main__":
    main()
