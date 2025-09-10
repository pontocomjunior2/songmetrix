import requests
import time

BASE_URL = "http://localhost:3001"
TOKEN = "YOUR_BEARER_TOKEN_HERE"  # Replace with a valid bearer token
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}
TIMEOUT = 30


def create_stream():
    payload = {
        "name": "Test Stream for Deletion",
        "description": "Stream created for delete_stream_by_id test",
        "genre": "Pop",
        "region": "BR",
        "url": "http://teststream.example.com/stream"
    }
    response = requests.post(f"{BASE_URL}/api/streams", json=payload, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json().get("id")


def delete_stream(stream_id):
    response = requests.delete(f"{BASE_URL}/api/streams/{stream_id}", headers=HEADERS, timeout=TIMEOUT)
    return response.status_code


def test_delete_stream_by_id():
    stream_id = None
    start_time = time.perf_counter()
    try:
        stream_id = create_stream()
        assert stream_id is not None, "Failed to create a stream for deletion test"

        del_start_time = time.perf_counter()
        del_response = requests.delete(f"{BASE_URL}/api/streams/{stream_id}", headers=HEADERS, timeout=TIMEOUT)
        del_elapsed = time.perf_counter() - del_start_time

        assert del_response.status_code == 204, f"Expected status code 204 but got {del_response.status_code}"
        assert del_elapsed < 3, f"DELETE request took too long: {del_elapsed:.2f}s (should be under 3s)"

    finally:
        # Cleanup if deletion failed or stream still exists
        if stream_id is not None:
            try:
                status_code = delete_stream(stream_id)
                if status_code != 204:
                    pass  # Possibly already deleted, no action needed
            except Exception:
                pass


test_delete_stream_by_id()
