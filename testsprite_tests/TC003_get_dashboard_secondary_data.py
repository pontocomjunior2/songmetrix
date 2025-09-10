import requests
from requests.auth import HTTPBasicAuth
import time
import tracemalloc
import os

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/dashboard/secondary"
USERNAME = "admin"  # Replace with valid basic auth username
PASSWORD = "password"  # Replace with valid basic auth password

def test_get_dashboard_secondary_data():
    timeout_seconds = 30

    tracemalloc.start()
    time_before = time.time()

    try:
        response = requests.get(
            f"{BASE_URL}{ENDPOINT}",
            auth=HTTPBasicAuth(USERNAME, PASSWORD),
            timeout=timeout_seconds
        )
    except requests.RequestException as e:
        tracemalloc.stop()
        assert False, f"Request failed due to exception: {e}"

    time_after = time.time()
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    duration = time_after - time_before

    # Assert status code 200
    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    # Assert response content-type JSON (typical for API)
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type.lower(), f"Expected JSON response, got Content-Type: {content_type}"

    # Basic JSON structure check
    try:
        data = response.json()
    except Exception as e:
        assert False, f"Response is not valid JSON: {e}"

    # Performance checks
    assert duration <= 3, f"API response time {duration:.2f}s exceeded 3 seconds limit"

    # Check peak memory tracked by tracemalloc (in bytes)
    peak_mb = peak / (1024 * 1024)
    assert peak_mb < 100, f"Peak memory usage {peak_mb:.2f}MB is too high"

    # Additional diagnostic info: print time and memory usage for manual analysis (optional, can be removed)
    print(f"Request duration: {duration:.3f}s")
    print(f"Peak memory during request: {peak_mb:.2f}MB")

test_get_dashboard_secondary_data()
