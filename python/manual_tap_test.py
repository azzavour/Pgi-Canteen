"""
Manual helper script to exercise the POST /tap endpoint without IDE tooling.
Usage:
    python manual_tap_test.py --card 1234567890 --tenant 1 --tap-ts 2025-01-01T08:00:00+07:00
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

import requests

DEFAULT_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


def build_payload(
    card_number: str, tenant_id: int, tap_ts: Optional[str], tap_id: Optional[str]
):
    payload = {
        "card_number": card_number,
        "tenant_id": tenant_id,
    }
    if tap_ts:
        payload["tap_ts"] = tap_ts
    if tap_id:
        payload["tap_id"] = tap_id
    return payload


def main():
    parser = argparse.ArgumentParser(description="Quick manual tester for POST /tap")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="FastAPI base URL")
    parser.add_argument("--card", required=True, help="Card number to send")
    parser.add_argument(
        "--tenant",
        required=True,
        type=int,
        help="Tenant ID that should receive the tap",
    )
    parser.add_argument(
        "--tap-ts",
        default=None,
        help="Optional ISO8601 timestamp (defaults to now, server-side)",
    )
    parser.add_argument(
        "--tap-id",
        default=None,
        help="Optional tap_id override (defaults to cardNumber-epochMs)",
    )
    args = parser.parse_args()

    endpoint = args.base_url.rstrip("/") + "/tap"
    tap_id = args.tap_id or f"{args.card}-{int(time.time() * 1000)}"
    payload = build_payload(args.card, args.tenant, args.tap_ts, tap_id)
    print(f"POST {endpoint} tap_id={tap_id}")
    print(json.dumps(payload, indent=2))

    try:
        t0 = int(time.time() * 1000)
        response = requests.post(endpoint, json=payload, timeout=10)
        t1 = int(time.time() * 1000)
    except requests.RequestException as exc:
        print(f"Request failed: {exc}")
        sys.exit(1)

    print(f"\nHTTP {response.status_code} (tap_id={tap_id})")
    print(f"RTT: {t1 - t0} ms")
    try:
        print(json.dumps(response.json(), indent=2))
    except ValueError:
        print(response.text)


if __name__ == "__main__":
    main()
