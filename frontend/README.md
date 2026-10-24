# Bước 01 — Component React đầu tiên

Mục tiêu: chạy được giao diện React và hiểu đường đi từ HTML đến component `App`. Nội dung ở bài này là tĩnh; chưa gọi API và chưa có state hoặc hook.

Sản phẩm cần xây là dashboard lấy dữ liệu thời tiết, làm sạch và chuẩn hóa bằng pipeline Python, lưu vào PostgreSQL rồi hiển thị qua React. Hướng dẫn học được lưu trong README; giao diện chỉ dùng nội dung phục vụ việc xem thời tiết. Phần xử lý dữ liệu tự động đã có trong `etl/`; giao diện React hiện chưa kết nối API Flask.

## Chạy thử

Trong terminal ở thư mục gốc `weather-etl`:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Mở **http://127.0.0.1:5173**. Giữ terminal đang chạy; nhấn `Ctrl+C` để dừng. Dùng `npm.cmd` trên Windows giúp tránh lỗi PowerShell chặn file `npm.ps1`; không cần thay đổi Execution Policy.

Nếu thư viện đã được cài, lần sau chỉ cần `npm.cmd run dev`. Bài này không cần chạy Flask hay PostgreSQL. Cần Node.js 20.19+ trong nhánh 20, hoặc 22.12+; máy hiện tại đang dùng Node.js 24.

Kết quả mong đợi: trang có thương hiệu **Mây**, tiêu đề **Thời tiết, trong tầm mắt.**, mô tả chức năng theo dõi thời tiết và tên ba thành phố. Chưa hiển thị số đo cho tới khi kết nối API; trang hiện thông báo chưa có dữ liệu.

## Vai trò từng file

| File | Vai trò |
| --- | --- |
| `package.json` | Khai báo React, các công cụ và lệnh `dev`, `build`, `preview` |
| `package-lock.json` | npm tự tạo để ghi lại phiên bản thư viện cụ thể; đưa vào Git |
| `index.html` | Có `<div id="root">` làm nơi đặt ứng dụng |
| `vite.config.js` | Bật hỗ trợ React, cấu hình địa chỉ và cổng chạy |
| `src/main.jsx` | Tạo React root và hiển thị `<App />` |
| `src/App.jsx` | Component đầu tiên, mô tả nội dung giao diện |
| `src/App.css` | Màu sắc, khoảng cách, bố cục cho component |

`node_modules/` chứa thư viện đã cài. `dist/` chứa bản được đóng gói. Hai thư mục này có thể tạo lại bằng npm và được bỏ qua trong Git.

## Đọc code theo thứ tự

```text
index.html → src/main.jsx → src/App.jsx
                  └──────→ src/App.css
```

1. Trình duyệt mở `index.html` và tải `main.jsx` thông qua Vite.
2. `main.jsx` dùng `createRoot` để gắn React vào phần tử có `id="root"`.
3. `root.render(<App />)` yêu cầu React hiển thị component `App`.
4. Hàm `App` trả về JSX mô tả nội dung trang; React cập nhật DOM tương ứng.

### Component là gì?

Trong bài này, component là một hàm JavaScript trả về giao diện viết bằng JSX:

```jsx
export default function App() {
  const projectName = 'Mây';

  return (
    <main>
      <h1>Chào mừng đến với {projectName}</h1>
    </main>
  );
}
```

Đây là ví dụ rút gọn để đọc hiểu, không cần thay thế file hiện tại.

- `function App()` định nghĩa một hàm tên `App`. Tên component bắt đầu bằng chữ hoa, nên React hiểu `<App />` là component, còn `<main>` là thẻ HTML.
- `export default` cho phép file khác lấy component này bằng `import App from './App.jsx'`.
- `const projectName = 'Mây'` khai báo biến chứa tên dự án. `const` nghĩa là không thể gán lại biến này trong cùng phạm vi.
- `return (...)` trả về phần giao diện. Dấu ngoặc tròn giúp viết JSX trên nhiều dòng.
- `{projectName}` chèn giá trị biến JavaScript vào JSX.

### JSX là gì?

JSX là cú pháp mở rộng của JavaScript, giúp mô tả giao diện bằng các thẻ gần giống HTML. Vite cùng công cụ React xử lý JSX thành JavaScript mà trình duyệt chạy được.

Chú ý trong `App.jsx`:

- Viết `className="welcome-card"` để gắn CSS class.
- Đóng các thẻ, ví dụ `<br />`.
- Các phần giao diện nằm trong một thẻ cha `<main>`.

## Bài tập nhỏ

1. Mở `src/App.jsx`, đổi `const projectName = 'Mây'` thành tên bạn thích.
2. Lưu file rồi xem trình duyệt: tên trong header và đoạn mô tả cùng thay đổi. Vite hỗ trợ cập nhật khi bạn lưu code.
3. Đổi lại tên `Mây` sau khi thử. Lưu ý tiêu đề tab trình duyệt nằm riêng trong `index.html`.

## Tự kiểm tra kết quả

```powershell
npm.cmd run build
```

Lệnh này kiểm tra quá trình đóng gói và tạo thư mục `dist/`. Nó không khởi chạy website và không thay thế việc mở trang để xem kết quả.

Nếu terminal báo cổng 5173 đang được sử dụng, nghĩa là có chương trình khác đang nghe cổng đó, thường là một phiên Vite trước. Dừng phiên cũ bằng `Ctrl+C`, hoặc chạy `npm.cmd run dev -- --port 5174` và mở địa chỉ Vite in ra.

## Ba câu hỏi ôn tập

1. `<div id="root">` trong `index.html` và `createRoot(...)` trong `main.jsx` liên quan thế nào?
2. Vì sao chúng ta viết `<App />` với chữ A hoa, còn `<main>` viết thường?
3. Khi đổi biến `projectName`, vì sao cả header và đoạn mô tả thay đổi, nhưng tiêu đề tab trình duyệt vẫn giữ nguyên?

Tài liệu chính thức: [Component React đầu tiên](https://react.dev/learn/your-first-component), [Viết JSX](https://react.dev/learn/writing-markup-with-jsx), [Bắt đầu với Vite](https://vite.dev/guide/).
