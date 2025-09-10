import requests
import time
import tracemalloc

BASE_URL = "http://localhost:3001"
TOKEN = ""  # Set your valid bearer token here

def create_stream():
    url = f"{BASE_URL}/api/streams"
    headers = {
        "Content-Type": "application/json"
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    payload = {
        "name": "Test Stream",
        "description": "Stream created for testing get_stream_by_id",
        "url": "http://teststream.example.com"
    }
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json().get("id")

def delete_stream(stream_id):
    url = f"{BASE_URL}/api/streams/{stream_id}"
    headers = {}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    response = requests.delete(url, headers=headers, timeout=30)
    response.raise_for_status()

def test_get_stream_by_id():
    stream_id = None
    try:
        stream_id = create_stream()
        url = f"{BASE_URL}/api/streams/{stream_id}"
        headers = {}
        if TOKEN:
            headers["Authorization"] = f"Bearer {TOKEN}"
        
        tracemalloc.start()
        start_time = time.perf_counter()
        response = requests.get(url, headers=headers, timeout=30)
        end_time = time.perf_counter()
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # Assert HTTP status code
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

        data = response.json()
        # Basic assertions on returned data
        assert isinstance(data, dict), "Response JSON is not a dict"
        assert data.get("id") == stream_id, f"Stream ID in response does not match requested ID {stream_id}"

        # Performance assertions
        response_time_ms = (end_time - start_time) * 1000
        assert response_time_ms <= 3000, f"Response time too high: {response_time_ms:.2f} ms"

        # Memory usage: limit to 10MB (10*1024*1024 bytes)
        assert peak <= 10 * 1024 * 1024, f"Memory peak too high: {peak} bytes"

        # Log performance info (if needed, here just print)
        print(f"GET /api/streams/{stream_id} responded in {response_time_ms:.2f} ms with peak memory {peak} bytes")

    finally:
        if stream_id is not None:
            delete_stream(stream_id)

test_get_stream_by_id()
