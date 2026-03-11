"""
Anonymize customers.json — replace customer PII with plausible synthetic values.

Fields replaced:
  - id            → new random UUID
  - name          → synthetic first + last name (unique per customer)
  - email         → synthetic email derived from synthetic name (unique)

Fields preserved as-is:
  - preferredProvider (provider/staff names — not customer PII)
  - studio, studioRef, npsRating, npsLabel, memberStatus, isMember,
    clv, clvNumeric, spent, appointmentCount, latestResponseDate,
    daysSinceLastVisit, lapsed, propensityTier, propensityScore

The mapping is deterministic for a given seed, so re-running produces
the same output. Set ANON_SEED env var to override the seed.
"""

import json
import os
import random
import uuid
import sys

SEED = int(os.environ.get("ANON_SEED", "1234"))

INPUT_PATH = os.path.join(os.path.dirname(__file__), "../server/data/customers.json")
OUTPUT_PATH = INPUT_PATH  # overwrite in-place

# ── Name lists ───────────────────────────────────────────────────────────────
# Plausible first and last names — diverse, common-ish distribution

FIRST_NAMES = [
    "Aisha", "Alex", "Alexis", "Alicia", "Alison", "Amber", "Amelia", "Andrea",
    "Angela", "Anita", "Anna", "Ashley", "Avery", "Bailey", "Bianca", "Brenda",
    "Brittany", "Brooklyn", "Camille", "Carmen", "Caroline", "Cassandra", "Chelsea",
    "Chloe", "Christina", "Claire", "Crystal", "Dana", "Danielle", "Daria",
    "Denise", "Diana", "Elena", "Elizabeth", "Emily", "Emma", "Erica", "Erin",
    "Eva", "Faith", "Gabrielle", "Grace", "Hailey", "Hannah", "Harper", "Heather",
    "Isabella", "Jade", "Jamie", "Janet", "Jasmine", "Jennifer", "Jessica",
    "Jordan", "Julia", "Juliana", "Kaitlyn", "Karen", "Katelyn", "Katherine",
    "Katrina", "Kayla", "Kelly", "Kimberly", "Kristen", "Kristina", "Laura",
    "Lauren", "Leah", "Leslie", "Linda", "Lisa", "Lori", "Madison", "Maria",
    "Mariana", "Maya", "Megan", "Melissa", "Michelle", "Miranda", "Monica",
    "Morgan", "Naomi", "Natalie", "Natasha", "Nicole", "Nina", "Olivia",
    "Paige", "Patricia", "Paula", "Rachel", "Rebecca", "Regina", "Renee",
    "Riley", "Robin", "Samantha", "Sandra", "Sara", "Sarah", "Savannah",
    "Shannon", "Shelby", "Sierra", "Simone", "Sophia", "Stephanie", "Summer",
    "Sydney", "Tamara", "Taylor", "Tiffany", "Tina", "Tracy", "Vanessa",
    "Veronica", "Victoria", "Whitney", "Yasmine", "Zoe",
]

LAST_NAMES = [
    "Adams", "Allen", "Anderson", "Bailey", "Baker", "Barnes", "Bell", "Bennett",
    "Brooks", "Brown", "Butler", "Campbell", "Carter", "Clark", "Coleman",
    "Collins", "Cook", "Cooper", "Cox", "Davis", "Diaz", "Edwards", "Evans",
    "Fisher", "Fleming", "Fletcher", "Foster", "Garcia", "Gonzalez", "Grant",
    "Gray", "Green", "Griffin", "Hall", "Harris", "Harrison", "Hayes", "Henderson",
    "Hill", "Howard", "Hughes", "Hunt", "Jackson", "James", "Jenkins", "Johnson",
    "Jones", "Jordan", "Kelly", "King", "Lee", "Lewis", "Long", "Lopez",
    "Martin", "Martinez", "Mason", "Mitchell", "Moore", "Morgan", "Morris",
    "Murphy", "Nelson", "Nguyen", "Parker", "Patel", "Patterson", "Perez",
    "Perry", "Peterson", "Phillips", "Porter", "Powell", "Price", "Ramirez",
    "Reed", "Richardson", "Rivera", "Roberts", "Robinson", "Rodriguez", "Rogers",
    "Ross", "Russell", "Sanchez", "Sanders", "Scott", "Simmons", "Smith",
    "Stewart", "Sullivan", "Taylor", "Thomas", "Thompson", "Torres", "Turner",
    "Walker", "Ward", "Washington", "Watson", "White", "Williams", "Wilson",
    "Wood", "Wright", "Young",
]

EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
    "me.com", "live.com", "msn.com", "aol.com", "protonmail.com",
]

EMAIL_SEPARATORS = [".", "_", ""]


def make_email(first: str, last: str, rng: random.Random, used: set[str]) -> str:
    """Generate a unique plausible email from a name."""
    first_l = first.lower()
    last_l = last.lower()
    domain = rng.choice(EMAIL_DOMAINS)
    sep = rng.choice(EMAIL_SEPARATORS)

    candidates = [
        f"{first_l}{sep}{last_l}@{domain}",
        f"{first_l[0]}{last_l}@{domain}",
        f"{first_l}{last_l[0]}@{domain}",
        f"{first_l}{sep}{last_l}{rng.randint(1, 99)}@{domain}",
        f"{first_l}{rng.randint(10, 999)}@{domain}",
    ]
    for candidate in candidates:
        if candidate not in used:
            return candidate

    # Ultimate fallback: uuid fragment
    fallback = f"{first_l}{last_l}.{uuid.uuid4().hex[:6]}@{domain}"
    return fallback


def main():
    input_path = os.path.abspath(INPUT_PATH)
    output_path = os.path.abspath(OUTPUT_PATH)

    if not os.path.exists(input_path):
        print(f"ERROR: customers.json not found at {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        customers = json.load(f)

    rng = random.Random(SEED)

    # ── Anonymize customers ────────────────────────────────────────────────────
    c_first = FIRST_NAMES.copy()
    c_last = LAST_NAMES.copy()
    rng.shuffle(c_first)
    rng.shuffle(c_last)

    # Build larger pools via repetition with shuffled variants
    first_pool = []
    last_pool = []
    needed = len(customers) + 100
    while len(first_pool) < needed:
        chunk = FIRST_NAMES.copy()
        rng.shuffle(chunk)
        first_pool.extend(chunk)
    while len(last_pool) < needed:
        chunk = LAST_NAMES.copy()
        rng.shuffle(chunk)
        last_pool.extend(chunk)

    used_names: set[str] = set()
    used_emails: set[str] = set()

    anonymized = []
    for i, customer in enumerate(customers):
        # Unique full name
        first = first_pool[i]
        last = last_pool[i]
        full_name = f"{first} {last}"
        # Handle name collision (rare but possible)
        offset = 0
        while full_name in used_names:
            offset += 1
            last = last_pool[(i + offset) % len(last_pool)]
            full_name = f"{first} {last}"
        used_names.add(full_name)

        email = make_email(first, last, rng, used_emails)
        used_emails.add(email)

        anon = {
            **customer,
            "id": str(uuid.uuid4()),
            "name": full_name,
            "email": email,
            # preferredProvider is staff/provider data — not customer PII, preserved as-is
        }
        anonymized.append(anon)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(anonymized, f, indent=2)

    print(f"✓ Anonymized {len(anonymized):,} customer records → {output_path}")
    print(f"  Unique names:  {len(used_names):,}")
    print(f"  Unique emails: {len(used_emails):,}")
    print()
    print("Sample records:")
    for c in anonymized[:3]:
        print(f"  {c['name']:25s}  {c['email']:35s}  provider: {c['preferredProvider']}")


if __name__ == "__main__":
    main()
