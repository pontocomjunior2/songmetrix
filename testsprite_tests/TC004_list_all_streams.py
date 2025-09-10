import requests
import time

BASE_URL = "http://localhost:3001"
STREAMS_ENDPOINT = f"{BASE_URL}/api/streams"
TIMEOUT = 30

# Dummy function to get a valid bearer token for authentication
# For testing, returns a static dummy token which should be replaced with actual token logic

def get_bearer_token():
    return "dummy_valid_token"

def test_list_all_streams():
    try:
        token = get_bearer_token()
    except Exception as e:
        assert False, f"Failed to get bearer token: {e}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    start_time = time.perf_counter()
    try:
        response = requests.get(STREAMS_ENDPOINT, headers=headers, timeout=TIMEOUT)
    except requests.exceptions.RequestException as e:
        assert False, f"Request to list streams failed: {e}"
    end_time = time.perf_counter()
    duration = end_time - start_time

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    try:
        streams = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate streams is a list
    assert isinstance(streams, list), f"Expected response to be a list but got {type(streams)}"

    # Additional minimal structure check if streams list has at least one item
    if streams:
        first_stream = streams[0]
        assert isinstance(first_stream, dict), "Each stream should be a dict"
        assert "id" in first_stream or "name" in first_stream or "stream_url" in first_stream, "Stream object does not contain expected keys"

    # Performance check: Ensure response time is reasonable (e.g. under 3 seconds as per validation criteria)
    assert duration <= 3, f"API response took too long: {duration:.2f} seconds"


test_list_all_streams()
