import os
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

UPSERT_SQL = """
INSERT INTO weather_hourly
    (city, observed_at, temperature_c, humidity_pct,
     precipitation_mm, wind_speed_kmh, temp_category)
VALUES %s
ON CONFLICT (city, observed_at) DO UPDATE SET
    temperature_c    = EXCLUDED.temperature_c,
    humidity_pct     = EXCLUDED.humidity_pct,
    precipitation_mm = EXCLUDED.precipitation_mm,
    wind_speed_kmh   = EXCLUDED.wind_speed_kmh,
    temp_category    = EXCLUDED.temp_category,
    loaded_at        = NOW();
"""

def load(df):
    if df.empty:
        return 0
    rows = list(df.astype(object).where(df.notna(), None).itertuples(index=False, name=None))
    with psycopg2.connect(
        host=os.getenv("POSTGRES_HOST"), port=os.getenv("POSTGRES_PORT"),
        dbname=os.getenv("POSTGRES_DB"), user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    ) as conn, conn.cursor() as cur:
        execute_values(cur, UPSERT_SQL, rows)
    return len(rows)