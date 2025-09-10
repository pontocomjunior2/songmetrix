import requests
import time
import tracemalloc
import psycopg2
from contextlib import closing

BASE_URL = "http://localhost:3001"
TOKEN = "your_valid_bearer_token_here"
TIMEOUT = 30
DB_CONFIG = {
    "dbname": "your_db_name",
    "user": "your_db_user",
    "password": "your_db_password",
    "host": "localhost",
    "port": 5432,
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def test_list_users_performance_and_functionality():
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json"
    }
    
    # Start measuring time and memory usage
    tracemalloc.start()
    start_time = time.perf_counter()

    with closing(get_db_connection()) as conn, conn.cursor() as cursor:
        # Check current open DB connections before request
        cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname = %s;", (DB_CONFIG["dbname"],))
        connections_before = cursor.fetchone()[0]

        try:
            response = requests.get(f"{BASE_URL}/api/users", headers=headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            tracemalloc.stop()
            raise AssertionError(f"Request failed: {e}")

        # Response time
        elapsed_time = time.perf_counter() - start_time
        # Memory usage in KB
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # Check open DB connections count after request
        cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname = %s;", (DB_CONFIG["dbname"],))
        connections_after = cursor.fetchone()[0]

    # Assertions on response
    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        users_list = response.json()
    except ValueError:
        raise AssertionError("Response is not valid JSON")

    assert isinstance(users_list, list), "Response JSON is not a list of users"

    # Performance checks
    assert elapsed_time <= 3.0, f"Response time too high: {elapsed_time} seconds"
    assert peak / 1024 < 50000, f"High peak memory usage: {peak/1024:.2f} KB"
    # Check DB connections didn't increase unexpectedly indicating leaked connections
    assert connections_after <= connections_before + 5, "Database connections increased unexpectedly indicating possible leak"

    # Further bottleneck detection can be done via logs/profilers, outside test scope

test_list_users_performance_and_functionality()