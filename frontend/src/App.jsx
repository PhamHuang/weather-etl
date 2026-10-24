// Tên component viết hoa để React phân biệt với thẻ HTML như <main>.
export default function App() {
  const projectName = 'Mây';

  return (
    <main className="welcome-page">
      <header className="site-header">
        <a className="brand" href="#welcome" aria-label="Mây — Trang đầu tiên">
          <span className="brand-mark" aria-hidden="true">☁</span>
          <span>{projectName}<small>WEATHER ETL</small></span>
        </a>
        <span className="lesson-label">Thời tiết Việt Nam</span>
      </header>

      <section className="welcome-card" id="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">THEO DÕI THỜI TIẾT THEO GIỜ</p>
        <h1 id="welcome-title">Thời tiết,<br />trong tầm mắt<span>.</span></h1>
        <p className="welcome-description">
          Theo dõi nhiệt độ, độ ẩm, lượng mưa và gió cùng {projectName}.
          Khám phá thông tin thời tiết tại ba thành phố Việt Nam.
        </p>

        <div className="lesson-status">
          <span className="status-dot" aria-hidden="true" />
          Thông tin thời tiết theo giờ · UTC+7
        </div>

        <div className="city-preview">
          <h2>Các thành phố theo dõi</h2>
          <ul>
            <li>Hà Nội</li>
            <li>TP. Hồ Chí Minh</li>
            <li>Đà Nẵng</li>
          </ul>
          <p>Chưa có dữ liệu thời tiết để hiển thị.</p>
        </div>
      </section>

      <footer className="site-footer">
        <span>Mỗi giờ, một góc nhìn.</span>
        <span>Nguồn dữ liệu của dự án: Open-Meteo.</span>
      </footer>
    </main>
  );
}
