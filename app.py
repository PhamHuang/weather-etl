"""Local dashboard for the weather ETL. Run with `python app.py`."""

import logging
import os

import psycopg2
from flask import Flask, jsonify, render_template, request

from settings import CITIES
from weather_data import build_payload

app = Flask(__name__)
app.json.ensure_ascii = False
log = logging.getLogger(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/weather")
def weather():
    city = request.args.get("city", "Hanoi")
    mode = request.args.get("mode", "live")
    try:
        hours = int(request.args.get("hours", "24"))
    except ValueError:
        return jsonify(error="Khoảng thời gian không hợp lệ."), 400
    if city not in CITIES or hours not in (24, 48, 168) or mode not in ("live", "demo"):
        return jsonify(error="Thành phố, khoảng thời gian hoặc chế độ không hợp lệ."), 400
    try:
        response = jsonify(build_payload(city, hours, mode))
        response.headers["Cache-Control"] = "no-store"
        return response
    except (psycopg2.Error, ValueError):
        # Database errors can contain host/user information; keep them server-side.
        log.exception("Could not read weather data")
        return jsonify(
            error="Chưa thể đọc dữ liệu thời tiết.",
            detail="Kiểm tra PostgreSQL và cấu hình .env, sau đó chạy python main.py để nạp dữ liệu.",
        ), 503


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")))
