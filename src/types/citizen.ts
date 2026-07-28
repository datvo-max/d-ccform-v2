export type ExtractionStatus = 'pending' | 'processing' | 'extracted' | 'verified' | 'error';
export type GenderType = 'Nam' | 'Nữ' | '';
export type CardIssueType = 'Cấp mới' | 'Cấp đổi' | 'Cấp lại' | '';

// File đính kèm (ảnh phiếu gốc hoặc trang PDF)
export interface AttachedFile {
  id: string;              // UUID
  fileName: string;        // Tên file gốc
  fileType: 'image' | 'pdf';
  pageNumber?: number;     // Số trang (nếu từ PDF)
  imageBlob: Blob;         // Ảnh gốc hoặc ảnh render từ PDF
  rawOcrText: string;      // Toàn bộ text OCR gốc
  createdAt: string;       // ISO timestamp
}

// Bảng tạm chứa thẻ PDF đã tách nhưng chưa OCR
export interface TempCitizenRecord {
  id?: number;
  fileName: string;
  fileType: 'image' | 'pdf';
  pageNumber?: number;
  imageBlob: Blob;
  createdAt: string;
}

// Thông tin nhân thân (mục 20) — giữ cấu trúc, tạm bỏ OCR
export interface FamilyMember {
  fullName: string;
  relationship: string;    // Cha, Mẹ, Vợ, Chồng, Con, Người ĐDHL
  nationality: string;
  idNumber9: string;       // CMND 9 số
  idNumber: string;        // Số định danh cá nhân 12 số
}

// Hồ sơ công dân (30 mục Mẫu CC01)
export interface CitizenRecord {
  id?: number;                     // Auto-increment PK (IndexedDB)

  // --- Thông tin phiếu ---
  receiptNumber: string;           // 1. Số phiếu thu nhận (dưới mã vạch)
  residenceFileNumber: string;     // 2. Số hồ sơ cư trú
  barcode: string;                 // Giá trị mã vạch (đọc từ barcode reader)

  // --- Mục 1–9: Thông tin định danh ---
  fullName: string;                // 3. Họ, chữ đệm và tên (IN HOA có dấu)
  fullNameNormalized: string;      // Tên không dấu (tìm kiếm)
  nickname: string;                // 4. Tên gọi khác
  birthDate: string;               // 5. Ngày sinh (DD/MM/YYYY)
  gender: GenderType;              // 6. Giới tính
  idNumber: string;                // 7. Số định danh cá nhân (12 số) — UNIQUE nhưng KHÔNG phải PK
  idNumber9: string;               // 8. Số CMND 9 số cũ
  ethnicity: string;               // 9a. Dân tộc
  religion: string;                // 9b. Tôn giáo
  nationality: string;             // 9c. Quốc tịch

  // --- Mục 10–15: Địa chỉ ---
  birthPlace: string;              // 10. Nơi sinh
  birthRegistration: string;       // 11. Nơi đăng ký khai sinh
  hometown: string;                // 12. Quê quán
  permanentAddress: string;        // 13. Nơi thường trú
  temporaryAddress: string;        // 14. Nơi tạm trú
  currentAddress: string;          // 15. Nơi ở hiện tại

  // --- Mục 16–19: Liên lạc ---
  occupation: string;              // 16. Nghề nghiệp
  bloodType: string;               // 17. Nhóm máu
  phoneNumber: string;             // 18. Số thuê bao di động (10 số)
  email: string;                   // 19. Email

  // --- Mục 20: Nhân thân (tạm bỏ OCR) ---
  familyMembers: FamilyMember[];

  // --- Mục 21–23 ---
  distinguishingMarks: string;     // 21. Đặc điểm nhận dạng
  issueType: CardIssueType;        // 22. Loại cấp
  issuingUnit: string;             // 23. Đơn vị lập (mặc định: CA phường Tân An, TP Cần Thơ)

  // --- Mục 24–30: Checkboxes ---
  requestDigitalCard: boolean;        // 24. Đề nghị cấp căn cước điện tử
  requestIntegrateOnCard: boolean;    // 25. (mặc định false, không quét)
  requestIntegrateDigital: boolean;   // 26. (mặc định false, không quét)
  requestVerifyOldId: boolean;        // 27. (mặc định false, không quét)
  requestVerifyRevokedId: boolean;    // 28. (mặc định false, không quét)
  requestDNACollection: boolean;      // 29. (mặc định false, không quét)
  requestVoiceCollection: boolean;    // 30. (mặc định false, không quét)

  // --- Metadata ---
  attachedFiles: AttachedFile[];     // Danh sách file đính kèm (>= 1)
  status: ExtractionStatus;
  extractionConfidence: number;      // 0–100
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface AppSettings {
  id?: number;
  ocrMode: 'tesseract_offline' | 'ai_vision' | 'cloud_vision_ocr';
  // Các field khác cho tương lai nếu dùng API
}
