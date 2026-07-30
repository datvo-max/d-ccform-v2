import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { Trash2, Download, Upload, Eye, EyeOff } from "lucide-react";
import packageJson from "../../../package.json";
import { exportDatabase, importDatabase } from "@/lib/backupService";
import { useConfirm } from "@/hooks/useConfirm";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmComponent } = useConfirm();

  // Modal mật khẩu state
  const [passwordPrompt, setPasswordPrompt] = useState<{
    isOpen: boolean;
    type: 'backup' | 'restore';
    file?: File;
  }>({ isOpen: false, type: 'backup' });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleClearDatabase = async () => {
    confirm(
      'Xóa dữ liệu',
      'Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu trong hệ thống? Hành động này không thể hoàn tác!',
      async () => {
        try {
          await db.citizens.clear();
          await db.tempCitizens.clear();
          toast.success('Đã xóa toàn bộ cơ sở dữ liệu IndexedDB!');
          onClose();
        } catch (err) {
          toast.error('Lỗi khi xóa cơ sở dữ liệu');
        }
      },
      { isDestructive: true, confirmText: 'Xóa toàn bộ' }
    );
  };

  const executeBackup = async (pass: string) => {
    setIsExporting(true);
    setProgress({ percent: 0, message: 'Đang chuẩn bị...' });
    setPasswordPrompt({ isOpen: false, type: 'backup' });
    const toastId = toast.loading('Đang tiến hành sao lưu (có thể mất vài phút)...');
    try {
      const { blob, isEncrypted } = await exportDatabase(pass, (percent, message) => {
        setProgress({ percent, message });
        toast.loading(message, { id: toastId });
      });
      
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dccform_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.${isEncrypted ? 'dccbackup' : 'json'}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success('Sao lưu thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi sao lưu', { id: toastId });
    } finally {
      setIsExporting(false);
      setProgress(null);
      setPassword('');
    }
  };

  const executeRestore = async (file: File, pass: string) => {
    confirm(
      'Khôi phục dữ liệu',
      'Khôi phục sẽ XÓA TOÀN BỘ dữ liệu hiện tại và thay thế bằng dữ liệu từ file backup. Bạn có chắc chắn muốn tiếp tục?',
      async () => {
        setIsImporting(true);
        setProgress({ percent: 0, message: 'Đang chuẩn bị...' });
        setPasswordPrompt({ isOpen: false, type: 'restore' });
        const toastId = toast.loading('Đang khôi phục dữ liệu...');
        try {
          await importDatabase(file, pass, (percent, message) => {
            setProgress({ percent, message });
            toast.loading(message, { id: toastId });
          });
          toast.success('Khôi phục thành công! Trang web sẽ được tải lại.', { id: toastId });
          setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
          toast.error(err.message || 'Lỗi khôi phục', { id: toastId });
        } finally {
          setIsImporting(false);
          setProgress(null);
          setPassword('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      {
        isDestructive: true,
        confirmText: 'Khôi phục',
        onCancel: () => {
          setPasswordPrompt({ isOpen: false, type: 'restore' });
          setPassword('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    );
  };

  const handleBackupClick = () => {
    setPassword('');
    setShowPassword(false);
    setPasswordPrompt({ isOpen: true, type: 'backup' });
  };

  const handleRestoreClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.dccbackup')) {
      setPassword('');
      setShowPassword(false);
      setPasswordPrompt({ isOpen: true, type: 'restore', file });
    } else if (file.name.endsWith('.json')) {
      await executeRestore(file, '');
    } else {
      toast.error('Định dạng file không được hỗ trợ!');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordPrompt.type === 'backup') {
      executeBackup(password);
    } else if (passwordPrompt.type === 'restore' && passwordPrompt.file) {
      if (!password) {
        toast.error('Vui lòng nhập mật khẩu để giải mã file!');
        return;
      }
      executeRestore(passwordPrompt.file, password);
    }
  };

  return (
    <>
      <ConfirmComponent />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              <h3 className="text-sm font-semibold">Sao lưu & Khôi phục</h3>
              <p className="text-sm text-muted-foreground">
                Sao lưu toàn bộ dữ liệu hồ sơ xuống máy tính (bao gồm cả ảnh).
              </p>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2 border-primary/20 text-primary hover:bg-primary/5" 
                  onClick={handleBackupClick}
                  disabled={isExporting || isImporting}
                >
                  <Download size={16} /> Sao lưu
                </Button>
                
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={handleRestoreClick}
                  disabled={isExporting || isImporting}
                >
                  <Upload size={16} /> Khôi phục
                </Button>
                
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".json,.dccbackup"
                  onChange={handleFileChange}
                />
              </div>

              {progress && (
                <div className="mt-4 p-4 border rounded-md bg-muted/30 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-primary line-clamp-1">{progress.message}</span>
                    <span className="text-muted-foreground ml-2 whitespace-nowrap">{progress.percent}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary overflow-hidden rounded-full">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-in-out" 
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}
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

      <Dialog open={passwordPrompt.isOpen} onOpenChange={(open) => {
        if (!open) {
          setPasswordPrompt(prev => ({...prev, isOpen: false}));
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {passwordPrompt.type === 'backup' ? 'Bảo mật file sao lưu' : 'Nhập mật khẩu giải mã'}
            </DialogTitle>
            <DialogDescription>
              {passwordPrompt.type === 'backup' 
                ? 'Bạn có thể nhập mật khẩu để mã hóa file backup (Tuỳ chọn). Nếu để trống, file sẽ lưu dạng .json.'
                : 'File backup này đã được bảo vệ. Vui lòng nhập mật khẩu để có thể khôi phục.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative">
              <Input
                autoFocus
                type={showPassword ? "text" : "password"}
                placeholder={passwordPrompt.type === 'backup' ? "Bỏ trống nếu không muốn cài mật khẩu" : "Nhập mật khẩu của bạn..."}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {passwordPrompt.type === 'backup' && (
              <p className="text-xs text-muted-foreground italic mt-2 text-destructive">
                Lưu ý: Nếu quên mật khẩu, bạn sẽ không thể khôi phục file backup!
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordPrompt(prev => ({...prev, isOpen: false}));
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}>Huỷ</Button>
            <Button onClick={handlePasswordSubmit}>
              {passwordPrompt.type === 'backup' ? 'Xác nhận & Tải về' : 'Tiếp tục Khôi phục'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
