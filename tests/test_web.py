from datetime import datetime, timedelta
from decimal import Decimal

import psycopg2
import pytest

import app as web
import weather_data
from weather_data import LOCAL_TZ


@pytest.fixture
def client():
    web.app.config.update(TESTING=True)
    return web.app.test_client()


def test_dashboard_and_assets_are_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert 'lang="vi"' in response.text
    assert "Thời tiết, trong tầm mắt" in response.text
    for path in ("/static/app.js", "/static/style.css", "/static/favicon.svg"):
        assert client.get(path).status_code == 200


@pytest.mark.parametrize("query", [
    "city=Unknown", "city=%27%3BDELETE%20FROM%20weather_hourly",
    "hours=nope", "hours=0", "hours=25", "hours=999999999", "mode=unknown",
])
def test_invalid_filters_never_query_the_database(client, monkeypatch, query):
    def unexpected_query(*args):
        pytest.fail("Invalid filters must be rejected before querying")
    monkeypatch.setattr(weather_data, "read_records", unexpected_query)
    assert client.get(f"/api/weather?{query}").status_code == 400


def test_demo_is_explicit_and_does_not_connect_to_database(client, monkeypatch):
    def unexpected_connection(*args, **kwargs):
        pytest.fail("Demo must not connect to PostgreSQL")
    monkeypatch.setattr(weather_data.psycopg2, "connect", unexpected_connection)
    response = client.get("/api/weather?mode=demo&city=Da+Nang&hours=168")
    assert response.status_code == 200
    payload = response.json
    assert payload["source"] == "demo"
    assert payload["city_name"] == "Đà Nẵng"
    assert len(payload["cities"]) == 3
    assert 168 <= len(payload["records"]) <= 169
    assert all(row["city"] == "Da Nang" for row in payload["records"])
    assert all(payload["start"] <= row["observed_at"] <= payload["end"] for row in payload["records"])
    assert payload["latest"] == payload["records"][-1]
    assert response.headers["Cache-Control"] == "no-store"


def test_live_database_failure_is_reported_without_demo_or_credentials(client, monkeypatch):
    def unavailable(*args):
        raise psycopg2.OperationalError("secret-password-at-private-host")
    monkeypatch.setattr(weather_data, "read_records", unavailable)
    response = client.get("/api/weather")
    assert response.status_code == 503
    assert "secret-password" not in response.text
    assert "records" not in response.json
    assert "python main.py" in response.json["detail"]


def test_empty_live_database_is_not_replaced_with_fake_values(client, monkeypatch):
    monkeypatch.setattr(weather_data, "read_records", lambda *args: [])
    payload = client.get("/api/weather").json
    assert payload["source"] == "live"
    assert payload["records"] == []
    assert payload["latest"] is None
    assert payload["summary"]["temperature_min"] is None
    assert payload["summary"]["precipitation_total"] is None
    assert all(city["latest"] is None for city in payload["cities"])


def test_live_values_nulls_timezones_and_selected_city(monkeypatch):
    now = datetime(2026, 10, 18, 12, 30, tzinfo=LOCAL_TZ)
    captured = {}

    def records(start, end):
        captured.update(start=start, end=end)
        base = {
            "city": "Hanoi", "observed_at": datetime(2026, 10, 18, 12),
            "temperature_c": Decimal("27.50"), "humidity_pct": None,
            "precipitation_mm": Decimal("0.00"), "wind_speed_kmh": Decimal("8.50"),
            "temp_category": "warm", "loaded_at": now,
        }
        return [base, {**base, "city": "Da Nang", "temperature_c": Decimal("30.00")}]

    monkeypatch.setattr(weather_data, "read_records", records)
    payload = weather_data.build_payload("Hanoi", 24, "live", now=now)
    assert captured["start"] == now - timedelta(hours=24)
    assert captured["end"] == now  # Never ask the database for future forecast rows.
    assert len(payload["records"]) == 1
    assert payload["latest"]["temperature_c"] == 27.5
    assert payload["latest"]["humidity_pct"] is None
    assert payload["latest"]["observed_at"] == "2026-10-18T12:00:00+07:00"
    assert payload["summary"]["precipitation_total"] == 0
    assert next(city for city in payload["cities"] if city["id"] == "Da Nang")["latest"]["temperature_c"] == 30


def test_demo_is_deterministic_and_handles_hour_boundary():
    now = datetime(2026, 10, 18, 12, tzinfo=LOCAL_TZ)
    first = weather_data.build_payload("Hanoi", 24, "demo", now=now)
    second = weather_data.build_payload("Hanoi", 24, "demo", now=now)
    assert first == second
    assert len(first["records"]) == 25
    assert first["records"][0]["observed_at"] == first["start"]
    assert first["records"][-1]["observed_at"] == first["end"]
