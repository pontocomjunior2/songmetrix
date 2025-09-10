import requests
from requests.auth import HTTPBasicAuth
import time
import tracemalloc

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/radios/status"
TIMEOUT = 30

# Insert valid credentials here
USERNAME = "your_basic_auth_username"
PASSWORD = "your_basic_auth_password"

def test_get_radio_status_performance():
    tracemalloc.start()
    start_time = time.time()

    try:
        response = requests.get(
            BASE_URL + ENDPOINT,
            auth=HTTPBasicAuth(USERNAME, PASSWORD),
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        tracemalloc.stop()
        assert False, f"Request failed: {e}"

    duration = time.time() - start_time
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    # Assert status code 200
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Assert response is JSON and parseable
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Performance assertions
    # Response time should be under 3 seconds according to validation criteria
    assert duration <= 3, f"Response time too high: {duration:.2f}s"

    # Memory usage: check that memory did not increase drastically (threshold 10MB)
    assert peak < 10 * 1024 * 1024, f"Memory increased too much during request: {peak} bytes"

    # Additional validations on data structure can be inserted here if schema is known


test_get_radio_status_performance()
