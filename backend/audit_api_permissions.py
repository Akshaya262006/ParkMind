
import json
import getpass
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def request(method, path, payload=None, token=None):
    headers = {"Accept": "application/json"}
    body = None

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def login(email, password):
    status, body = request(
        "POST",
        "/api/auth/login",
        {"email": email, "password": password},
    )

    if status != 200:
        raise RuntimeError(f"Login failed: HTTP {status}")

    data = json.loads(body)
    return data["access_token"], data["user"]


def check(label, actual, expected):
    passed = actual == expected
    print(
        f"{'PASS' if passed else 'FAIL'} | "
        f"{label} | expected {expected}, received {actual}"
    )
    return passed


def main():
    failures = 0

    # Verify unauthenticated access is rejected.
    for path in (
        "/api/parking/slots",
        "/api/parking/events?limit=5",
        "/api/parking/analytics",
        "/api/bookings",
    ):
        status, _ = request("GET", path)
        if not check(f"No token: GET {path}", status, 401):
            failures += 1

    # The known demo driver account.
    driver_token, driver = login(
        "parksense.other.test@example.com",
        "OtherPass123!",
    )
    print(f"\nDriver account: {driver['role']}")

    driver_reads = [
        ("GET", "/api/parking/slots", None),
        ("GET", "/api/parking/events?limit=5", None),
        ("GET", "/api/parking/analytics", None),
        ("GET", "/api/parking/analytics/hourly-activity", None),
        ("GET", "/api/bookings", None),
        ("GET", "/api/auth/me", None),
        (
            "POST",
            "/api/ml/predict",
            {
                "hour": 14,
                "day_of_week": 4,
                "is_weekend": 0,
                "zone_id": 1,
                "current_occupancy": 0.5,
            },
        ),
        (
            "POST",
            "/api/ml/predict-slot",
            {
                "hour": 14,
                "day_of_week": 4,
                "is_weekend": 0,
                "slot_id": "A1",
                "current_occupied": 0,
            },
        ),
    ]

    for method, path, payload in driver_reads:
        status, _ = request(method, path, payload, driver_token)
        if not check(f"Driver access: {method} {path}", status, 200):
            failures += 1

    driver_writes = [
        (
            "PATCH",
            "/api/parking/slots/ZZ_TEST/status",
            {"status": "OCCUPIED"},
        ),
        (
            "POST",
            "/api/parking/demo/sensor-event",
            {"slot_id": "ZZ_TEST", "status": "OCCUPIED"},
        ),
    ]

    for method, path, payload in driver_writes:
        status, _ = request(method, path, payload, driver_token)
        if not check(f"Driver denied: {method} {path}", status, 403):
            failures += 1

    # Prompt securely for the administrator credentials.
    print("\nEnter your administrator credentials.")
    admin_email = input("Admin email: ").strip().lower()
    admin_password = getpass.getpass("Admin password: ")
    admin_token, admin = login(admin_email, admin_password)
    print(f"Admin account: {admin['role']}")

    if admin["role"].upper() != "ADMIN":
        raise RuntimeError("The supplied account is not an ADMIN.")

    # The test slot is deliberately nonexistent. A 404 here means
    # authorization passed and the endpoint reached slot lookup.
    admin_writes = [
        (
            "PATCH",
            "/api/parking/slots/ZZ_TEST/status",
            {"status": "OCCUPIED"},
        ),
        (
            "POST",
            "/api/parking/demo/sensor-event",
            {"slot_id": "ZZ_TEST", "status": "OCCUPIED"},
        ),
    ]

    for method, path, payload in admin_writes:
        status, body = request(method, path, payload, admin_token)
        passed = (
            status == 404
            and "Parking slot not found" in body
        )
        print(
            f"{'PASS' if passed else 'FAIL'} | "
            f"Admin authorization: {method} {path} | "
            f"HTTP {status}"
        )
        if not passed:
            failures += 1

    print(f"\nAudit result: {failures} failed test(s).")
    if failures:
        print("Investigate failed tests before considering the audit complete.")
    else:
        print("All tested permission checks passed.")


if __name__ == "__main__":
    main()
