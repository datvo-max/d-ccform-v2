---
name: ocr-extraction
description: Hướng dẫn nghiệp vụ bóc tách OCR từ hình ảnh bằng Tesseract offline
---

# Bóc tách bằng Tesseract.js (Offline) cho Phiếu Thu Nhận

## 1. Phương thức khởi tạo Tesseract Worker
- Phải khởi tạo Tesseract worker (với ngôn ngữ `vie+eng`) dạng **singleton** để tối ưu hiệu suất, không khởi tạo lại sau mỗi ảnh.

## 2. Tiền xử lý (Preprocessing)
- Dữ liệu thô từ Tesseract thường dính các ký tự viền bảng biểu như `|`, `Ì`, `+`. 
- Cần có hàm loại bỏ các ký tự này ở đầu và cuối mỗi dòng trước khi parse regex.
- Loại bỏ dấu tiếng Việt (thành không dấu) trước khi tìm kiếm keyword để tăng độ chính xác matching, do OCR thường hay đọc sai/bỏ sót dấu.

## 3. Thứ tự ưu tiên bóc tách
Luôn phải parse theo thứ tự ưu tiên quan trọng giảm dần:
1. **Số định danh cá nhân** (idNumber): 12 chữ số liên tiếp hoặc có khoảng trắng giữa các chữ số. Nên quét cả bản text gốc lẫn text loại bỏ khoảng trắng.
2. **Họ và Tên** (fullName): Thường nằm sau chữ "Họ, chữ đệm" hoặc "Ho, chu dem". Lấy phần bên phải dấu hai chấm `:`.
3. **Ngày sinh** (birthDate): Tìm định dạng `dd/mm/yyyy` hoặc các biến thể (dùng `-`, `.`).
4. **Số điện thoại** (phoneNumber): Tìm cụm 9-11 số hoặc số bắt đầu bằng `0[35789]`.
5. **Các trường thông tin khác**: Giới tính, Dân tộc, Tôn giáo, và Địa chỉ.
6. **Mục Boolean**: Ví dụ mục 24 (Đề nghị cấp thẻ điện tử), cần kiểm tra ký tự "x" hoặc dấu check trong ô vuông.

## 4. Xử lý giá trị sau dấu hai chấm
- Format tiêu chuẩn của phiếu CC01 là `Nhãn mục : Giá trị`.
- Khi đã match được dòng, cần cắt bỏ phần nhãn (bên trái dấu hai chấm) và các số thứ tự. Trả về phần text bên phải đã `trim()`.

## 5. Metadata bổ sung
- Cần trả về đầy đủ 3 trường sau quá trình trích xuất:
  - `parsedData`: Object chứa thông tin đã bóc tách.
  - `rawText`: Toàn bộ dữ liệu chữ gốc (để user kiểm tra lại khi OCR sai).
  - `confidence`: Điểm tin cậy, tính bằng cách đếm xem đã bóc tách thành công bao nhiêu trường ưu tiên.
