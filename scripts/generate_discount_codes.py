"""
Day 0: Generate discount_codes.json — pre-built mock discount codes per tactic.

In production, these would be generated programmatically via the Boulevard API.
For POC, we generate a pool of codes per tactic prefix and serve them in sequence.

Output: server/data/discount_codes.json
Shape:
  {
    "MID10": ["MID10-ABCD", "MID10-EFGH", ...],   // 10% off, low-demand
    "BACK10": ["BACK10-ABCD", "BACK10-EFGH", ...]  // $10 off, any time
  }
"""

import json
import os
import random
import string

OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "../server/data/discount_codes.json"
)

PREFIXES = {
    "MID10": 200,    # pool size for mid-tier offer
    "BACK10": 200,   # pool size for low-tier offer
}

SUFFIX_LENGTH = 6


def generate_code(prefix: str) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=SUFFIX_LENGTH))
    return f"{prefix}-{suffix}"


def main():
    random.seed(42)  # deterministic for reproducibility
    codes: dict[str, list[str]] = {}

    for prefix, pool_size in PREFIXES.items():
        pool = []
        seen = set()
        while len(pool) < pool_size:
            code = generate_code(prefix)
            if code not in seen:
                pool.append(code)
                seen.add(code)
        codes[prefix] = pool

    output_path = os.path.abspath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(codes, f, indent=2)

    print(f"✓ Generated discount_codes.json → {output_path}")
    for prefix, pool in codes.items():
        print(f"  {prefix}: {len(pool)} codes  (sample: {pool[0]}, {pool[1]})")


if __name__ == "__main__":
    main()
