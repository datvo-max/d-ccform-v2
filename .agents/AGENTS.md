# Hướng dẫn Phát triển Dự án D-CCForm V2 (Agent Rules)

## 1. Công nghệ & Framework
- **Next.js & React**: Sử dụng Next.js 16.x App Router và React 19.
- **Styling**: Tailwind CSS v4 kết hợp shadcn/ui.
- **Xử lý Dữ liệu Local (Offline-first)**: Toàn bộ dữ liệu được lưu trữ trên **IndexedDB** bằng `dexie` và `dexie-react-hooks`.
- **Trích xuất thông tin**: Sử dụng `tesseract.js` (Phase 1) và có thể thêm `paddleocr` sau này. Dùng thư viện `@AidenSnake zxing-js/library` để đọc mã vạch.
- **Biểu tượng (Icons)**: Đồng bộ sử dụng thư viện `lucide-react`.

## 2. Quy ước Thuật ngữ & Dữ liệu (QUAN TRỌNG)
- Tuyệt đối **KHÔNG** sử dụng thuật ngữ "CCCD". Các khái niệm phải được gọi là:
  - **Thẻ căn cước** (khi nói về thẻ vật lý).
  - **Số định danh cá nhân** (khi nói về dãy số 12 chữ số).
  - Trong code, biến lưu dãy 12 số phải đặt tên là `idNumber` (không dùng `idNumberCCCD`).
  - Viết tắt trên giao diện nếu cần: **ĐDCN**.
- **Data Model**:
  - `idNumber` là **UNIQUE** nhưng **KHÔNG phải Primary Key**.
  - Khóa chính luôn là `id` (Auto-increment ID do Dexie tạo).
  - Nếu import hoặc quét 1 thẻ mới mà `idNumber` đã tồn tại trong IndexedDB, hệ thống **không báo lỗi cứng** mà sẽ cho phép cập nhật (merge) hoặc thêm thông tin. Một hồ sơ (`idNumber` duy nhất) có thể đính kèm nhiều file phiếu gốc khác nhau.

## 3. Cấu trúc UI & Tính năng
- **Chỉ sử dụng 1 Page (Dashboard)**: Bố cục UI bao gồm:
  - Header
  - Bảng thống kê (Stats Cards)
  - Phần Upload Inline có thể ẩn hiện (Collapse)
  - Bảng dữ liệu chính (Data Table) và thanh Toolbar
- **Theme (Giao diện Sáng - Trắng Đen)**: Sử dụng các sắc độ của trắng, đen, xám. Hạn chế sử dụng màu nổi bật rực rỡ (đỏ, vàng, xanh biển, xanh lá...) ngoại trừ những chỗ cảnh báo cực kỳ quan trọng.
- **Form kiểm tra (Review)**: Sử dụng giao diện Split-screen (chia đôi màn hình). Bên trái là ảnh gốc để đối chiếu, có chức năng hiển thị **Raw OCR Text**. Bên phải là form để chỉnh sửa dữ liệu được trích xuất.
- **Xuất Excel**: Sử dụng thư viện `xlsx-js-style` để xuất file có định dạng đẹp (Times New Roman, viền đầy đủ) tương tự dự án dv-cap. Có Modal cấu hình cột muốn xuất.

## 4. Kiểm thử
- Do sử dụng Tesseract OCR và đọc mã vạch trực tiếp tại Browser, nên phải lưu ý các thao tác không được chiếm Main Thread quá lâu, dùng async/await hợp lý.
- Luôn hiển thị thông báo tiến độ (progress bar hoặc Toaster).



## 5. Quản lý Phiên bản (Versioning) & Git
- Mỗi khi đẩy code (push) lên GitHub, phải chủ động thay đổi phiên bản trong file `package.json` theo mức độ thay đổi của code:
  - Thay đổi lớn (Major): Cập nhật số đầu (VD: 1.0.0 -> 2.0.0).
  - Thay đổi tính năng mới (Minor): Cập nhật số ở giữa (VD: 1.0.0 -> 1.1.0).
  - Thay đổi nhỏ hoặc fix bugs (Patch): Cập nhật số cuối cùng (VD: 1.0.0 -> 1.0.1).

## 6. Trước khi đưa code lên github
- Không được push code lên github khi chưa chạy lệnh npm run lint và npm run build để kiểm tra, khi không còn lỗi thì mới push lên github.