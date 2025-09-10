import requests
from requests.auth import HTTPBasicAuth
import time

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/dashboard"
TIMEOUT = 30

# Replace with valid basic auth credentials for the test environment
BASIC_AUTH_USERNAME = "testuser"
BASIC_AUTH_PASSWORD = "testpassword"

def test_get_dashboard_main_data():
    url = BASE_URL + ENDPOINT
    auth = HTTPBasicAuth(BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD)
    try:
        start_time = time.perf_counter()
        response = requests.get(url, auth=auth, timeout=TIMEOUT)
        elapsed_time = time.perf_counter() - start_time
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    # Validate status code
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Validate content type header presence and JSON parseability
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type.lower(), f"Expected JSON response but got Content-Type: {content_type}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response body is not valid JSON"

    # Validate response data is not empty (basic check)
    assert data, "Dashboard data is empty"

    # Performance validation: response within 3 seconds as per PRD validation criteria
    assert elapsed_time <= 3, f"Response time exceeded 3 seconds: {elapsed_time:.2f}s"

    # Additional performance hints (would require advanced setup, here just logging time)
    print(f"Dashboard main data fetched in {elapsed_time:.2f} seconds")

test_get_dashboard_main_data()