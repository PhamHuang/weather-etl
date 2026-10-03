from etl.transform import transform

def test_transform_cleans_data():
    payload = {"hourly": {
        "time": ["2026-10-03T00:00", "2026-10-03T01:00", "2026-10-03T01:00",
                 "2026-10-03T02:00", "2026-10-03T03:00"],
        "temperature_2m": [24.5, 35.0, 35.0, None, 99.0],
        "relative_humidity_2m": [80, 60, 60, 70, 70],
        "precipitation": [0.0, 1.2, 1.2, 0.0, 0.0],
        "wind_speed_10m": [5, 7, 7, 3, 2],
    }}
    df = transform("Hanoi", payload)
    assert len(df) == 2                 # đã bỏ trùng, null, outlier