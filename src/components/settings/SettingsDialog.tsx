import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { Trash2 } from "lucide-react";
import packageJson from "../../../package.json";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const handleClearDatabase = async () => {
    if (confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu trong hệ thống? Hành động này không thể hoàn tác!')) {
      try {
        await db.citizens.clear();
        toast.success('Đã xóa toàn bộ cơ sở dữ liệu IndexedDB!');
        onClose();
      } catch (err) {
        toast.error('Lỗi khi xóa cơ sở dữ liệu');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cài đặt Hệ thống</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Tesseract OCR</h3>
            <div className="space-y-2">
              <Label>Ngôn ngữ nhận diện</Label>
              <Input disabled value="vie+eng" />
              <p className="text-xs text-muted-foreground">
                Đang sử dụng Tesseract.js chạy offline 100% tại trình duyệt.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Hệ thống</h3>
            <div className="space-y-2">
              <Label>Phiên bản hiện tại</Label>
              <Input disabled value={`v${packageJson.version}`} />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-destructive">Khu vực nguy hiểm</h3>
            <div className="flex flex-col gap-2 border border-destructive/20 p-4 rounded-md bg-destructive/5">
              <p className="text-sm text-muted-foreground">
                Xóa sạch dữ liệu IndexedDB hiện tại trên trình duyệt này.
              </p>
              <Button variant="destructive" className="w-full gap-2" onClick={handleClearDatabase}>
                <Trash2 size={16} /> Xóa toàn bộ dữ liệu
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
