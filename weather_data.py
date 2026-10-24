"""Read-only weather queries and explicitly requested demonstration data."""

import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

from etl.transform import categorize_temp
from settings import CITIES, CITY_LABELS

load_dotenv(Path(__file__).resolve().parent / ".env")
LOCAL_TZ = timezone(timedelta(hours=7))


def read_records(start, end):
    """The ETL stores observed_at as local UTC+7, without a timezone."""
    with psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.getenv("POSTGRES_DB", "weather"),
        user=os.getenv("POSTGRES_USER", "etl"),
        password=os.getenv("POSTGRES_PASSWORD"),
        connect_timeout=4,
        options="-c statement_timeout=5000 -c default_transaction_read_only=on",
    ) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT city, observed_at, temperature_c, humidity_pct,
                       precipitation_mm, wind_speed_kmh, temp_category,
                       loaded_at AT TIME ZONE current_setting('TimeZone') AS loaded_at
                FROM weather_hourly
                WHERE observed_at >= %s AND observed_at <= %s
                  AND city = ANY(%s)
                ORDER BY city, observed_at
                """,
                (start.replace(tzinfo=None), end.replace(tzinfo=None), list(CITIES)),
            )
            return [dict(row) for row in cur.fetchall()]


def demo_records(start, end):
    """Synthetic hourly values; never saved to or mixed with the real database."""
    records = []
    last_hour = end.replace(minute=0, second=0, microsecond=0)
    first_hour = start.replace(minute=0, second=0, microsecond=0)
    if first_hour < start:
        first_hour += timedelta(hours=1)
    for index, city in enumerate(CITIES):
        observed = first_hour
        while observed <= last_hour:
            phase = (observed.hour - 8) * math.pi / 12
            temperature = round(26 + index * 2 + 4 * math.sin(phase), 1)
            humidity = round(76 - 12 * math.sin(phase) + index * 2, 1)
            rain = 0.6 + index * 0.4 if observed.hour in (16, 17, 18) else 0
            records.append({
                "city": city,
                "observed_at": observed,
                "temperature_c": temperature,
                "humidity_pct": humidity,
                "precipitation_mm": round(rain, 1),
                "wind_speed_kmh": round(8 + index * 2 + 3 * math.cos(phase), 1),
                "temp_category": categorize_temp(temperature),
                "loaded_at": last_hour,
            })
            observed += timedelta(hours=1)
    return records


def serialize_record(row):
    result = dict(row)
    for key in ("observed_at", "loaded_at"):
        value = row[key]
        if value.tzinfo is None:
            value = value.replace(tzinfo=LOCAL_TZ)
        result[key] = value.astimezone(LOCAL_TZ).isoformat()
    for key in ("temperature_c", "humidity_pct", "precipitation_mm", "wind_speed_kmh"):
        result[key] = float(row[key]) if row[key] is not None else None
    return result


def build_payload(city, hours, mode, now=None):
    now = (now or datetime.now(LOCAL_TZ)).astimezone(LOCAL_TZ)
    start = now - timedelta(hours=hours)
    raw = demo_records(start, now) if mode == "demo" else read_records(start, now)
    records = [serialize_record(row) for row in raw]
    series = sorted(
        (row for row in records if row["city"] == city),
        key=lambda row: row["observed_at"],
    )
    cities = []
    for key, coordinates in CITIES.items():
        city_rows = [row for row in records if row["city"] == key]
        cities.append({
            "id": key,
            "name": CITY_LABELS[key],
            "latitude": coordinates[0],
            "longitude": coordinates[1],
            "latest": max(city_rows, key=lambda row: row["observed_at"], default=None),
        })
    temperatures = [row["temperature_c"] for row in series if row["temperature_c"] is not None]
    rainfall = [row["precipitation_mm"] for row in series if row["precipitation_mm"] is not None]
    return {
        "source": mode,
        "timezone": "Asia/Ho_Chi_Minh",
        "city": city,
        "city_name": CITY_LABELS[city],
        "hours": hours,
        "start": start.isoformat(),
        "end": now.isoformat(),
        "generated_at": now.isoformat(),
        "last_loaded_at": max((row["loaded_at"] for row in records), default=None),
        "cities": cities,
        "records": series,
        "latest": series[-1] if series else None,
        "summary": {
            "count": len(series),
            "temperature_min": min(temperatures, default=None),
            "temperature_max": max(temperatures, default=None),
            "precipitation_total": round(sum(rainfall), 2) if rainfall else None,
        },
    }
