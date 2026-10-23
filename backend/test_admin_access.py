
import json
import getpass
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"


def request_json(path, method="GET", payload=None, token=None):
    headers = {"Accept": "application/json"}

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(
        BASE_URL + path,
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            content = response.read().decode("utf-8")
            return response.status, content

    except urllib.error.HTTPError as exc:
        content = exc.read().decode("utf-8")
        return exc.code, content


def main():
    email = input("Admin email: ").strip().lower()
    password = getpass.getpass("Admin password: ")

    status, content = request_json(
        "/api/auth/login",
        method="POST",
        payload={"email": email, "password": password},
    )

    if status != 200:
        print(f"Admin login failed: HTTP {status}")
        print(content)
        return

    try:
        result = json.loads(content)
        token = result["access_token"]
        user = result["user"]
    except (json.JSONDecodeError, KeyError):
        print("Login response did not contain the expected fields.")
        return

    print(f"Logged in as: {user.get('full_name')}")
    print(f"Role: {user.get('role')}")

    if user.get("role", "").upper() != "ADMIN":
        print("FAIL: this account does not have the ADMIN role.")
        return

    tests = [
        (
            "Simulated sensor event",
            "/api/parking/demo/sensor-event",
            "POST",
            {"slot_id": "ZZ_TEST", "status": "OCCUPIED"},
        ),
        (
            "Manual slot status",
            "/api/parking/slots/ZZ_TEST/status",
            "PATCH",
            {"status": "OCCUPIED"},
        ),
    ]

    for label, path, method, payload in tests:
        status, content = request_json(
            path,
            method=method,
            payload=payload,
            token=token,
        )

        print(f"\n{label}: HTTP {status}")
        print(content)

        if status == 404 and "Parking slot not found" in content:
            print("PASS: ADMIN authorization succeeded; test slot is absent.")
        elif status == 403:
            print("FAIL: ADMIN role was denied.")
        else:
            print("Review this response before proceeding.")


if __name__ == "__main__":
    main()
