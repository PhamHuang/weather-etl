import logging, time
import requests

log = logging.getLogger(__name__)
API_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_city(city, lat, lon, retries=3):
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
        "timezone": "Asia/Bangkok",
        "past_days": 1, "forecast_days": 1,
    }
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(API_URL, params=params, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            log.warning("Attempt %d/%d failed for %s: %s", attempt, retries, city, exc)
            if attempt == retries:
                raise
            time.sleep(2 ** attempt)   # chờ 2s, 4s... (exponential backoff)