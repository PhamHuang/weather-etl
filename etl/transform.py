import pandas as pd

COLUMN_MAP = {
    "time": "observed_at",
    "temperature_2m": "temperature_c",
    "relative_humidity_2m": "humidity_pct",
    "precipitation": "precipitation_mm",
    "wind_speed_10m": "wind_speed_kmh",
}

def categorize_temp(t):
    if t < 18: return "cold"
    if t < 26: return "mild"
    if t < 33: return "warm"
    return "hot"

def transform(city, payload):
    df = pd.DataFrame(payload["hourly"]).rename(columns=COLUMN_MAP)
    df["observed_at"] = pd.to_datetime(df["observed_at"])

    df = df.dropna(subset=["observed_at", "temperature_c"])        # bỏ null
    df = df.drop_duplicates(subset=["observed_at"])                # bỏ trùng
    df = df[df["temperature_c"].between(-10, 50)]                  # bỏ outlier
    df = df[df["humidity_pct"].between(0, 100) | df["humidity_pct"].isna()]

    df["city"] = city
    df["temp_category"] = df["temperature_c"].apply(categorize_temp)
    return df[["city", "observed_at", "temperature_c", "humidity_pct",
               "precipitation_mm", "wind_speed_kmh", "temp_category"]]