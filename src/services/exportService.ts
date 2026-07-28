import * as XLSX from 'xlsx-js-style';
import { CitizenRecord } from '@/types/citizen';

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 10));

export const EXPORT_COLUMNS = [
  { key: 'stt', label: 'STT', defaultChecked: true, wch: 6 },
  { key: 'receiptNumber', label: 'Số Phiếu Thu Nhận', defaultChecked: true, wch: 22 },
  { key: 'residenceFileNumber', label: 'Số Hồ Sơ Cư Trú', defaultChecked: false, wch: 22 },
  { key: 'idNumber', label: 'Số Định Danh Cá Nhân', defaultChecked: true, wch: 18 },
  { key: 'idNumber9', label: 'Số CMND 9 số', defaultChecked: false, wch: 15 },
  { key: 'fullName', label: 'Họ và Tên', defaultChecked: true, wch: 28 },
  { key: 'nickname', label: 'Tên Gọi Khác', defaultChecked: false, wch: 20 },
  { key: 'birthDate', label: 'Ngày Sinh', defaultChecked: true, wch: 15 },
  { key: 'gender', label: 'Giới Tính', defaultChecked: true, wch: 10 },
  { key: 'ethnicity', label: 'Dân Tộc', defaultChecked: false, wch: 12 },
  { key: 'religion', label: 'Tôn Giáo', defaultChecked: false, wch: 12 },
  { key: 'nationality', label: 'Quốc Tịch', defaultChecked: false, wch: 12 },
  { key: 'phoneNumber', label: 'Số Điện Thoại', defaultChecked: true, wch: 15 },
  { key: 'birthPlace', label: 'Nơi Sinh', defaultChecked: false, wch: 35 },
  { key: 'birthRegistration', label: 'Nơi Khai Sinh', defaultChecked: false, wch: 35 },
  { key: 'hometown', label: 'Quê Quán', defaultChecked: false, wch: 35 },
  { key: 'permanentAddress', label: 'Nơi Thường Trú', defaultChecked: true, wch: 45 },
  { key: 'temporaryAddress', label: 'Nơi Tạm Trú', defaultChecked: false, wch: 45 },
  { key: 'currentAddress', label: 'Nơi Ở Hiện Tại', defaultChecked: false, wch: 45 },
  { key: 'occupation', label: 'Nghề Nghiệp', defaultChecked: false, wch: 20 },
  { key: 'bloodType', label: 'Nhóm Máu', defaultChecked: false, wch: 10 },
  { key: 'email', label: 'Email', defaultChecked: false, wch: 25 },
  { key: 'distinguishingMarks', label: 'Đặc Điểm Nhận Dạng', defaultChecked: false, wch: 35 },
  { key: 'issueType', label: 'Loại Cấp', defaultChecked: false, wch: 15 },
  { key: 'issuingUnit', label: 'Đơn Vị Lập', defaultChecked: false, wch: 25 },
];

export const exportToExcel = async (
  data: CitizenRecord[],
  selectedKeys: string[],
  onProgress: (percent: number) => void
): Promise<void> => {
  if (data.length === 0) throw new Error("Chưa có dữ liệu để xuất!");

  onProgress(5);
  await yieldToMain();

  const activeSchema = EXPORT_COLUMNS.filter(col => selectedKeys.includes(col.key));
  
  // 1. Chuẩn bị dữ liệu
  const dataToExport = data.map((item, index) => {
    const rowData: Record<string, unknown> = {};
    activeSchema.forEach(col => {
      if (col.key === 'stt') rowData[col.label] = index + 1;
      else rowData[col.label] = (item as any)[col.key] || '';
    });
    return rowData;
  });

  const ws = XLSX.utils.json_to_sheet(dataToExport);

  onProgress(30);
  await yieldToMain();

  // 2. Thiết lập độ rộng cột
  ws['!cols'] = activeSchema.map(col => ({ wch: col.wch }));

  // 3. AutoFilter
  const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
  if (range.e.r > 0 && range.e.c > 0) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
  }

  // 4. Định dạng Style
  const totalRows = range.e.r - range.s.r + 1;
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        font: { name: "Times New Roman", sz: 12, bold: R === 0 },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        },
        alignment: { wrapText: true, vertical: "center", horizontal: R === 0 ? "center" : "left" }
      };
    }

    if (R % 50 === 0 || R === range.e.r) {
      const currentProgress = 30 + Math.floor((R / totalRows) * 50); // 30% -> 80%
      onProgress(currentProgress);
      await yieldToMain();
    }
  }

  onProgress(85);
  await yieldToMain();

  // 5. Khởi tạo file và tải xuống
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, "DanhSach");

  onProgress(95);
  await yieldToMain();

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `Danh_Sach_Thu_Nhan_${dateStr}.xlsx`);

  onProgress(100);
};
