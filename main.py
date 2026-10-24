import logging
import pandas as pd
from etl.extract import fetch_city
from etl.transform import transform
from etl.load import load
from settings import CITIES

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
log = logging.getLogger("pipeline")

def run():
    frames = []
    for city, (lat, lon) in CITIES.items():
        try:
            frames.append(transform(city, fetch_city(city, lat, lon)))
        except Exception:
            log.exception("Skip %s", city)     # 1 thành phố lỗi không làm hỏng cả pipeline
    if not frames:
        raise SystemExit("No data extracted")
    log.info("Loaded %d rows", load(pd.concat(frames, ignore_index=True)))

if __name__ == "__main__":
    run()
