import requests
import time
import tracemalloc

BASE_URL = "http://localhost:3001"
STREAMS_ENDPOINT = f"{BASE_URL}/api/streams"
TIMEOUT = 30
# Replace 'your_actual_bearer_token' with a valid token before running the test
BEARER_TOKEN = "your_actual_bearer_token"

def test_create_new_stream():
    headers = {
        "Authorization": f"Bearer {BEARER_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "name": "Test Stream",
        "description": "Stream created for TC005 testing",
        "genre": "Pop",
        "region": "Brazil",
        "station": "Test Station"
    }
    stream_id = None

    tracemalloc.start()
    start_time = time.perf_counter()

    try:
        response = requests.post(STREAMS_ENDPOINT, json=payload, headers=headers, timeout=TIMEOUT)
        elapsed_time = time.perf_counter() - start_time
        current_mem, peak_mem = tracemalloc.get_traced_memory()

        # Validate response status code
        assert response.status_code == 201, f"Expected status code 201, got {response.status_code}"

        # Validate response body contains created stream ID (assuming JSON response with 'id')
        resp_json = response.json()
        assert "id" in resp_json, "Response JSON does not contain 'id'"
        stream_id = resp_json["id"]

        # Performance assertions (example thresholds, adjust as needed)
        assert elapsed_time <= 3, f"Response time too high: {elapsed_time:.2f}s"
        # Memory usage threshold: allowing up to 50MB for example
        assert peak_mem <= 50*1024*1024, f"Memory usage too high: {peak_mem / (1024*1024):.2f} MB"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    finally:
        tracemalloc.stop()
        if stream_id:
            # Cleanup: delete the created stream
            try:
                del_resp = requests.delete(f"{STREAMS_ENDPOINT}/{stream_id}", headers=headers, timeout=TIMEOUT)
                assert del_resp.status_code == 204, f"Cleanup failed, expected status 204, got {del_resp.status_code}"
            except Exception as e:
                print(f"Cleanup DELETE request failed: {e}")

test_create_new_stream()