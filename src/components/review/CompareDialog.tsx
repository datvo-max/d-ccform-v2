import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CitizenRecord } from '@/types/citizen';

interface CompareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingRecord: CitizenRecord | null;
  newRecord: Partial<CitizenRecord> | null;
  onMerge: () => void;
  onAddFileOnly: () => void;
  onSkip: () => void;
  onCreateNew: () => void;
  hideCreateNew?: boolean;
}

export function CompareDialog({
  isOpen,
  onClose,
  existingRecord,
  newRecord,
  onMerge,
  onAddFileOnly,
  onSkip,
  onCreateNew,
  hideCreateNew
}: CompareDialogProps) {
  if (!existingRecord || !newRecord) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            ⚠️ Cảnh báo trùng dữ liệu!
          </DialogTitle>
          <DialogDescription>
            Phát hiện số định danh cá nhân <strong>{existingRecord.idNumber}</strong> đã được lưu trữ trước đó.
            Vui lòng chọn cách xử lý.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Trường dữ liệu</th>
                  <th className="px-4 py-2 font-medium">Dữ liệu cũ (Hiện tại)</th>
                  <th className="px-4 py-2 font-medium">Dữ liệu mới (Quét được)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2 font-medium">Họ và Tên</td>
                  <td className="px-4 py-2">{existingRecord.fullName}</td>
                  <td className={`px-4 py-2 ${existingRecord.fullName !== newRecord.fullName ? 'text-destructive font-bold' : ''}`}>
                    {newRecord.fullName}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Ngày sinh</td>
                  <td className="px-4 py-2">{existingRecord.birthDate}</td>
                  <td className={`px-4 py-2 ${existingRecord.birthDate !== newRecord.birthDate ? 'text-destructive font-bold' : ''}`}>
                    {newRecord.birthDate}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Nơi thường trú</td>
                  <td className="px-4 py-2">{existingRecord.permanentAddress}</td>
                  <td className={`px-4 py-2 ${existingRecord.permanentAddress !== newRecord.permanentAddress ? 'text-destructive font-bold' : ''}`}>
                    {newRecord.permanentAddress}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-sm bg-muted/50 p-3 rounded-md">
            <p className="font-semibold mb-2">Danh sách file đính kèm:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{existingRecord.attachedFiles.length} file cũ</li>
              <li className="text-foreground font-medium">+ 1 file mới chuẩn bị thêm vào</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:space-x-0">
          <Button variant="outline" onClick={onSkip} className="sm:mr-auto text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
            Bỏ qua & Xóa bản quét
          </Button>

          <Button variant="secondary" onClick={onAddFileOnly}>
            Chỉ thêm file
          </Button>
          {existingRecord.status !== 'verified' && (
            <Button onClick={onMerge}>
              Thêm file và cập nhật các trường
            </Button>
          )}
          {!hideCreateNew && (
            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700" onClick={onCreateNew}>
              Tạo mới (không trùng)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
