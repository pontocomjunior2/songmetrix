import requests
from requests.auth import HTTPBasicAuth
import time
import tracemalloc
import os

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/dashboard/essential"
TIMEOUT = 30

# Replace with valid basic auth credentials
USERNAME = "admin"
PASSWORD = "password"

def test_get_dashboard_essential_data_performance():
    auth = HTTPBasicAuth(USERNAME, PASSWORD)
    url = f"{BASE_URL}{ENDPOINT}"

    # Start measuring memory
    tracemalloc.start()

    start_time = time.time()
    try:
        response = requests.get(url, auth=auth, timeout=TIMEOUT)
        elapsed_time = time.time() - start_time

        # Stop measuring memory snapshot
        current, peak = tracemalloc.get_traced_memory()
        mem_usage_bytes = peak
        tracemalloc.stop()

        # Assertions
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        assert elapsed_time <= 3, f"Response time too high: {elapsed_time:.2f}s"
        assert mem_usage_bytes < 50 * 1024 * 1024, f"High memory usage detected: {mem_usage_bytes / (1024*1024):.2f} MB"

        # Performance data printout (could be logged)
        print(f"Response time: {elapsed_time:.3f} seconds")
        print(f"Peak memory usage during request: {mem_usage_bytes / (1024*1024):.2f} MB")
    except requests.exceptions.RequestException as e:
        tracemalloc.stop()
        assert False, f"Request failed: {e}"

test_get_dashboard_essential_data_performance()