import requests
import time
import tracemalloc

BASE_URL = "http://localhost:3001"
API_STREAMS = f"{BASE_URL}/api/streams"

# Placeholder for the bearer token, adjust as needed for actual authentication
BEARER_TOKEN = "YOUR_BEARER_TOKEN_HERE"

HEADERS = {
    "Authorization": f"Bearer {BEARER_TOKEN}",
    "Content-Type": "application/json"
}

def test_update_stream_by_id():
    # Sample stream data for creation and update
    stream_create_data = {
        "name": "Test Stream for Update",
        "description": "Initial description",
        "genre": "Pop",
        "region": "SP",
        "active": True
    }
    stream_update_data = {
        "name": "Updated Test Stream",
        "description": "Updated description",
        "genre": "Rock",
        "region": "RJ",
        "active": False
    }
    
    created_stream_id = None
    
    # Start memory tracking and time measurement
    tracemalloc.start()
    start_time = time.time()
    
    try:
        # Create a new stream to update
        create_resp = requests.post(
            API_STREAMS,
            json=stream_create_data,
            headers=HEADERS,
            timeout=30
        )
        assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}"
        created_stream = create_resp.json()
        created_stream_id = created_stream.get("id")
        assert isinstance(created_stream_id, int), "Created stream ID is invalid"
        
        # Update the created stream
        update_resp = requests.put(
            f"{API_STREAMS}/{created_stream_id}",
            json=stream_update_data,
            headers=HEADERS,
            timeout=30
        )
        elapsed_time = time.time() - start_time
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        # Assertions on update response
        assert update_resp.status_code == 200, f"Expected 200, got {update_resp.status_code}"
        updated_stream = update_resp.json()
        # Validate that the update fields match what was sent
        for key, value in stream_update_data.items():
            assert updated_stream.get(key) == value, f"Mismatch in field '{key}'"
        
        # Performance assertions (example thresholds, adjust as needed)
        assert elapsed_time <= 3, f"Response time exceeded 3 seconds: {elapsed_time:.2f}s"
        # Memory peak under 10MB (example)
        assert peak < 10 * 1024 * 1024, f"High memory usage: {peak/1024/1024:.2f} MB"
        
    finally:
        # Clean up by deleting the created stream
        if created_stream_id:
            try:
                del_resp = requests.delete(
                    f"{API_STREAMS}/{created_stream_id}",
                    headers=HEADERS,
                    timeout=30
                )
                assert del_resp.status_code == 204, f"Failed to delete stream id {created_stream_id}"
            except Exception:
                pass

test_update_stream_by_id()