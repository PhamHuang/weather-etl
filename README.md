# Mây — Weather ETL Dashboard

Dashboard tiếng Việt cho pipeline thu thập thời tiết Hà Nội, TP. Hồ Chí Minh và Đà Nẵng. Python lấy dữ liệu theo giờ từ Open-Meteo, pandas làm sạch, PostgreSQL lưu trữ và Flask cung cấp API cùng giao diện web.

## Chạy trên máy

Cần Python 3.10+ và Docker Desktop (hoặc PostgreSQL có sẵn). Mở terminal tại thư mục dự án:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Nếu máy dùng Python Launcher, có thể thay `python` ở lệnh đầu bằng `py -3`. Nếu đã có `.venv`, bỏ qua bước tạo môi trường.

Tạo `.env` từ `.env.example` nếu chưa có file; giữ cấu hình hiện tại nếu đã có:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Đợi PostgreSQL sẵn sàng, nạp dữ liệu và khởi động website:

```powershell
.venv\Scripts\python main.py
.venv\Scripts\python app.py
```

Mở **http://127.0.0.1:5000**. Có thể đổi cổng bằng biến `PORT` trong `.env`. Website mặc định chỉ lắng nghe trên máy của bạn.

**Xem giao diện khi chưa có database:** chỉ cần cài thư viện, chạy `app.py`, rồi chọn **Dữ liệu mẫu** ở góc trên hoặc mở **http://127.0.0.1:5000/?mode=demo**. Các con số mẫu được sinh để minh họa, có nhãn riêng và không ghi vào PostgreSQL. Website không tự chuyển sang dữ liệu mẫu khi database lỗi.

## Chức năng

- Lọc thành phố và khoảng 24 giờ, 48 giờ hoặc 7 ngày vừa qua.
- Xem bản ghi gần nhất, nhiệt độ thấp/cao, độ ẩm, tổng mưa và tốc độ gió.
- So sánh ba thành phố; bấm một thành phố để chuyển bộ lọc.
- Biểu đồ nhiệt độ, độ ẩm, mưa và gió; rê chuột hoặc dùng phím mũi tên khi biểu đồ được focus để xem từng điểm.
- Bảng dữ liệu có sắp xếp thời gian và phân trang 8 dòng.
- Xuất toàn bộ bản ghi của bộ lọc hiện tại thành CSV UTF-8, có BOM để đọc tiếng Việt trong Excel. Tên file phân biệt `live` và `demo`.
- Trạng thái tải, mất kết nối, dữ liệu rỗng và bản ghi cũ được hiển thị rõ ràng.
- Giao diện đáp ứng máy tính và điện thoại; không cần Node.js, build frontend hay CDN.

**Làm mới** chỉ đọc lại PostgreSQL, không gọi Open-Meteo hoặc chạy ETL. Chạy `main.py` để cập nhật nguồn dữ liệu. Chưa có lịch ETL tự động. Bộ lọc 7 ngày chỉ hiển thị dữ liệu đã tích lũy; mỗi lần ETL hiện tại chỉ yêu cầu `past_days=1` và `forecast_days=1`.

## Cấu trúc

```text
app.py                 Flask: trang chủ và API chỉ đọc
weather_data.py        Truy vấn PostgreSQL, tổng hợp và sinh dữ liệu mẫu
settings.py            Thành phố dùng chung cho ETL và website
templates/index.html   Giao diện dashboard
static/                CSS, JavaScript, favicon SVG
main.py                Điểm chạy pipeline
etl/extract.py         Gọi Open-Meteo, thử lại khi request lỗi
etl/transform.py       Làm sạch và phân loại nhiệt độ
etl/load.py            UPSERT theo (city, observed_at)
sql/schema.sql         Bảng weather_hourly
docker-compose.yml     PostgreSQL 16 và volume dữ liệu
tests/                 Kiểm thử transform và API
```

## API

```http
GET /api/weather?city=Hanoi&hours=24&mode=live
```

| Tham số | Giá trị |
| --- | --- |
| `city` | `Hanoi` (mặc định), `Ho Chi Minh City`, `Da Nang` |
| `hours` | `24` (mặc định), `48`, `168` |
| `mode` | `live` (mặc định), `demo` |

Response gồm `source`, `city`, `city_name`, `start`, `end`, `cities`, `latest`, `summary` và `records`. `cities` chứa bản ghi gần nhất của từng thành phố trong khoảng; `records` chỉ chứa thành phố đã chọn, theo thời gian tăng dần. Số đo thiếu giữ `null`, không đổi thành 0. `summary.precipitation_total` cộng những bản ghi có lượng mưa; dữ liệu thiếu không được nội suy. Tham số sai trả HTTP 400; lỗi database trả HTTP 503 với hướng dẫn khắc phục, không trả thông tin kết nối.

`observed_at` trong database hiện là `TIMESTAMP` theo giờ địa phương UTC+7. API trả ISO 8601 có offset `+07:00`. `loaded_at` được diễn giải theo múi giờ session PostgreSQL đã lưu `NOW()`; nên giữ cấu hình múi giờ database nhất quán giữa lúc nạp và lúc đọc. Website chỉ truy vấn từ đầu khoảng đến thời điểm hiện tại, loại các bản ghi dự báo trong tương lai. Nguồn forecast Open-Meteo không phải phép đo trực tiếp từ trạm thời tiết.

## Kiểm thử

```powershell
.venv\Scripts\python -m pytest -q
```

Test API dùng dữ liệu giả lập và lỗi kết nối được mô phỏng; không yêu cầu PostgreSQL hay mạng. Kiểm thử kết nối thật: khởi động PostgreSQL, chạy `main.py`, chọn **Dữ liệu PostgreSQL** và kiểm tra dashboard.

Kiểm tra tương tác giao diện tùy chọn (cần Node.js, chỉ dùng khi phát triển):

```powershell
npm install --prefix .preview --no-audit --no-fund jsdom
node tests/dashboard-smoke.cjs
```

Kiểm tra DOM mô phỏng bộ lọc, biểu đồ, phân trang, xuất CSV và trạng thái lỗi/rỗng; không thay thế kiểm tra bố cục trực quan trên trình duyệt.

Script SQL trong Docker chỉ tự chạy khi khởi tạo volume PostgreSQL mới. Với database có sẵn nhưng chưa có bảng, áp dụng schema thủ công:

```powershell
Get-Content sql/schema.sql | docker compose exec -T postgres psql -U etl -d weather
```

File `.env.example` khớp cấu hình database dùng cho phát triển trong Docker Compose. Không đưa thông tin kết nối riêng lên Git. Flask ở `app.py` phục vụ phát triển cục bộ; khi triển khai thực tế cần máy chủ WSGI phù hợp và cấu hình database riêng.
