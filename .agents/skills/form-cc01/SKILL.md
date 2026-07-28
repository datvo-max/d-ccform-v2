---
name: form-cc01
description: Cấu trúc biểu mẫu CC01 và định dạng Data Model cho CitizenRecord
---

# Mẫu phiếu CC01 (Phiếu thu nhận thông tin căn cước)

Mẫu CC01 gồm 30 mục cơ bản, được quy định theo Thông tư số 17/2024/TT-BCA. Dự án d-ccform-v2 lưu thông tin này trong Object `CitizenRecord`.

## 1. Các trường dữ liệu chính

### Thông tin Phiếu
- `receiptNumber`: Số phiếu thu nhận (dãy số bên dưới mã vạch).
- `residenceFileNumber`: Số hồ sơ cư trú (ngay dưới số phiếu).
- `barcode`: Mã vạch (Đọc từ thư viện quét mã vạch chuyên dụng).

### Thông tin Định danh Công dân
- `fullName`: Họ, chữ đệm và tên (Luôn IN HOA CÓ DẤU).
- `fullNameNormalized`: Tên không dấu (để hỗ trợ thanh tìm kiếm).
- `birthDate`: Ngày sinh, định dạng `DD/MM/YYYY`.
- `gender`: Giới tính (`Nam` hoặc `Nữ`).
- `idNumber`: **Số định danh cá nhân (12 chữ số)**. Đây là trường cực kỳ quan trọng, dùng để liên kết các phiếu khác nhau của cùng 1 người. Dù nó mang tính duy nhất cho mỗi công dân, nhưng nó **KHÔNG** dùng làm khoá chính của CSDL IndexedDB (khoá chính là trường `id` tự động tăng).
- `idNumber9`: Số CMND 9 số cũ (nếu có).

### Thông tin Địa chỉ & Liên lạc
- Các trường Nơi đăng ký khai sinh (`birthRegistration`), Quê quán (`hometown`), Nơi thường trú (`permanentAddress`), Nơi tạm trú (`temporaryAddress`), Nơi ở hiện tại (`currentAddress`).
- Số điện thoại (`phoneNumber`) và Email (`email`).

### Bảng Nhân thân (Mục 20)
- Kiểu dữ liệu `FamilyMember[]` bao gồm: Họ tên, Quan hệ (Cha/Mẹ/Vợ/Chồng/Con/NĐD), Quốc tịch, CMND 9 số, và Số định danh cá nhân 12 số.
- Ở giai đoạn hiện tại (v2), **KHÔNG bóc tách OCR bảng này** do độ khó cao của cấu trúc bảng, nhưng vẫn phải giữ đúng data model để tương lai triển khai hoặc cho phép user nhập tay.

### Các mục check (Boolean) (Mục 24 - 30)
- Chỉ quét duy nhất mục 24: `requestDigitalCard` (Đề nghị cấp thẻ điện tử, tài khoản ĐDĐT).
- Các mục 25 đến 30 mặc định là `false` và không cần quét.

## 2. Quản lý File
- Mỗi `CitizenRecord` có thể có nhiều `attachedFiles`. Cấu trúc mỗi file cần lưu lại:
  - `id`: Mã UUID của file.
  - `fileName`: Tên gốc.
  - `imageBlob`: Dữ liệu ảnh.
  - `rawOcrText`: Dữ liệu chữ OCR gốc của file đó (cần cho tính năng hiển thị raw text).
