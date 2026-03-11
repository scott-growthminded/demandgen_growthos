"""
Day 0: Generate customers.json from Listen360 export.

Source: listen360_Customers.csv
Output: server/data/customers.json

Each customer record includes:
  - id, email, name, studio, location fields
  - npsRating, npsLabel, memberStatus
  - preferredProvider (Performed By)
  - clv (bucket string), spent (float), appointmentCount
  - latestResponseDate, daysSinceLastVisit, lapsed (bool)
  - propensityTier: "high" | "mid" | "low"
  - propensityScore: float 0–1

Propensity tier rules (mirrors JIT logic in tactics_config.json):
  High  — NPS ≥ 8 AND days since last visit < 60
  Mid   — NPS 6–7 OR days since last visit 60–90
  Low   — NPS ≤ 5 OR days since last visit > 90
  Conflict resolution: lapsed status pulls tier down.
  Member bonus: members with NPS 7 are treated as High.
"""

import csv
import json
import os
import sys
from datetime import date, datetime

REFERENCE_DATE = date(2026, 3, 9)   # current date per project context
LAPSED_MID_DAYS = 60                 # 60+ days → mid risk
LAPSED_LOW_DAYS = 90                 # 90+ days → low / high-risk lapsed

INPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../Contract work/Growth Minded/Data/Data sets/listen360_Customers.csv"
)
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "../server/data/customers.json"
)


def parse_clv_midpoint(clv_str: str) -> float:
    """Convert '$55 - $99' bucket string to numeric midpoint."""
    if not clv_str or clv_str.strip() == "":
        return 0.0
    clv_str = clv_str.replace("$", "").replace(",", "")
    if " - " in clv_str:
        parts = clv_str.split(" - ")
        try:
            return (float(parts[0]) + float(parts[1])) / 2
        except ValueError:
            return 0.0
    # Handle "$X,XXX+" style
    clv_str = clv_str.replace("+", "").strip()
    try:
        return float(clv_str)
    except ValueError:
        return 0.0


def parse_date(date_str: str) -> date | None:
    """Parse YYYY-MM-DD date string."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def compute_propensity(nps: int, days_since: int, is_member: bool) -> tuple[str, float]:
    """
    Return (tier, score) based on NPS, recency, and membership.

    Score is a 0–1 float: higher = more likely to convert / return.
    Tier is one of 'high', 'mid', 'low'.
    """
    # Base score from NPS (0–10 → 0–1)
    nps_score = nps / 10.0

    # Recency penalty
    if days_since <= 30:
        recency_score = 1.0
    elif days_since <= 60:
        recency_score = 0.75
    elif days_since <= 90:
        recency_score = 0.5
    else:
        recency_score = 0.2

    # Member bonus
    member_bonus = 0.05 if is_member else 0.0

    raw_score = (nps_score * 0.6) + (recency_score * 0.4) + member_bonus
    score = round(min(raw_score, 1.0), 3)

    # Tier assignment: lapsed status pulls tier down
    if days_since > LAPSED_LOW_DAYS or nps <= 5:
        tier = "low"
    elif days_since > LAPSED_MID_DAYS or nps == 6:
        tier = "mid"
    elif nps == 7 and not is_member:
        tier = "mid"
    else:
        # NPS ≥ 8 (or member with NPS 7), recent
        tier = "high"

    # Edge case: member with NPS 7 and recent → promote to high
    if is_member and nps == 7 and days_since <= LAPSED_MID_DAYS:
        tier = "high"

    return tier, score


def main():
    input_path = os.path.abspath(INPUT_PATH)
    output_path = os.path.abspath(OUTPUT_PATH)

    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    customers = []
    skipped = 0

    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = row.get("Email", "").strip().lower()
            if not email:
                skipped += 1
                continue

            # Core identity
            customer_id = (row.get("Reference") or "").strip()
            full_name = (row.get("Full Name") or "").strip()
            studio = (row.get("Studio") or "").strip()
            studio_ref = (row.get("Studio Reference") or "").strip()

            # NPS
            try:
                nps_rating = int((row.get("Rating") or "0").strip())
            except ValueError:
                nps_rating = 0
            nps_label = (row.get("Net Promoter Label") or "").strip()

            # Membership
            member_status_raw = (row.get("Member Status") or "Non Member").strip()
            is_member = member_status_raw.lower() == "member"

            # Provider
            preferred_provider = (row.get("Performed By") or "").strip()

            # CLV
            clv_str = (row.get("Client Lifetime Value") or "").strip()
            clv_numeric = parse_clv_midpoint(clv_str)

            # Spending
            try:
                spent = round(float((row.get("Spent") or "0").strip()), 2)
            except ValueError:
                spent = 0.0

            # Appointment count
            appt_count_raw = (row.get("Appointment Count") or "1").strip()
            # Some values are ranges like "2 - 4"
            if " - " in appt_count_raw:
                parts = appt_count_raw.split(" - ")
                try:
                    appt_count = int(parts[0])
                except ValueError:
                    appt_count = 1
            else:
                try:
                    appt_count = int(appt_count_raw)
                except ValueError:
                    appt_count = 1

            # Recency — use Latest Response date as proxy for last appointment
            latest_date = parse_date(row.get("Latest Response", ""))
            if latest_date:
                days_since = (REFERENCE_DATE - latest_date).days
            else:
                days_since = 999  # treat as very lapsed if no date

            lapsed = days_since >= LAPSED_MID_DAYS

            # Propensity
            tier, score = compute_propensity(nps_rating, days_since, is_member)

            customers.append({
                "id": customer_id,
                "email": email,
                "name": full_name,
                "studio": studio,
                "studioRef": studio_ref,
                "npsRating": nps_rating,
                "npsLabel": nps_label,
                "memberStatus": member_status_raw,
                "isMember": is_member,
                "preferredProvider": preferred_provider,
                "clv": clv_str,
                "clvNumeric": clv_numeric,
                "spent": spent,
                "appointmentCount": appt_count,
                "latestResponseDate": str(latest_date) if latest_date else None,
                "daysSinceLastVisit": days_since,
                "lapsed": lapsed,
                "propensityTier": tier,
                "propensityScore": score,
            })

    # De-duplicate on email: keep the record with the most recent latestResponseDate.
    # The source data (Listen360) can have the same customer responding from multiple
    # studios; we keep the latest response so the propensity tier reflects current state.
    by_email: dict[str, dict] = {}
    for c in customers:
        email = c["email"]
        if email not in by_email:
            by_email[email] = c
        else:
            existing = by_email[email]
            # Prefer more recent response date
            existing_date = existing.get("latestResponseDate") or "0000-00-00"
            new_date = c.get("latestResponseDate") or "0000-00-00"
            if new_date > existing_date:
                by_email[email] = c

    pre_dedup = len(customers)
    customers = list(by_email.values())
    deduped = pre_dedup - len(customers)
    if deduped > 0:
        print(f"  De-duplicated: removed {deduped} older records for shared emails")

    # Sort by propensity score descending for readability
    customers.sort(key=lambda c: c["propensityScore"], reverse=True)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(customers, f, indent=2)

    print(f"✓ Generated {len(customers):,} customer records → {output_path}")
    print(f"  Skipped (no email): {skipped}")

    # Summary stats
    tiers = {"high": 0, "mid": 0, "low": 0}
    for c in customers:
        tiers[c["propensityTier"]] += 1
    print(f"\n  Propensity breakdown:")
    for t, n in tiers.items():
        print(f"    {t:4s}: {n:,}  ({n/len(customers)*100:.1f}%)")

    members = sum(1 for c in customers if c["isMember"])
    lapsed_count = sum(1 for c in customers if c["lapsed"])
    print(f"\n  Members:    {members:,}  ({members/len(customers)*100:.1f}%)")
    print(f"  Lapsed 60+: {lapsed_count:,}  ({lapsed_count/len(customers)*100:.1f}%)")


if __name__ == "__main__":
    main()
