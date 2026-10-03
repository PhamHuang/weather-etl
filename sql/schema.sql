CREATE TABLE IF NOT EXISTS weather_hourly (
    city             TEXT      NOT NULL,
    observed_at      TIMESTAMP NOT NULL,
    temperature_c    NUMERIC(5,2),
    humidity_pct     NUMERIC(5,2),
    precipitation_mm NUMERIC(6,2),
    wind_speed_kmh   NUMERIC(6,2),
    temp_category    TEXT,
    loaded_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (city, observed_at)
);