import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EXPORT_COLUMNS } from "@/services/exportService";

interface ExportConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedKeys: string[]) => void;
}

export function ExportConfigDialog({ isOpen, onClose, onConfirm }: ExportConfigDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedKeys(EXPORT_COLUMNS.filter(c => c.defaultChecked).map(c => c.key));
    }
  }, [isOpen]);

  const handleToggle = (key: string) => {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(EXPORT_COLUMNS.map(c => c.key));
  };

  const handleSubmit = () => {
    if (selectedKeys.length === 0) return;
    onConfirm(selectedKeys);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cấu hình xuất Excel</DialogTitle>
          <DialogDescription className="flex justify-between items-center">
            <span>Chọn các trường dữ liệu muốn hiển thị trong file Excel</span>
            <button onClick={handleSelectAll} className="text-primary hover:underline font-medium">
              Chọn tất cả
            </button>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4 bg-muted/30 p-4 rounded-md border">
          {EXPORT_COLUMNS.map(col => (
            <div key={col.key} className="flex items-center space-x-2">
              <Checkbox 
                id={`col-${col.key}`} 
                checked={selectedKeys.includes(col.key)}
                onCheckedChange={() => handleToggle(col.key)}
              />
              <label 
                htmlFor={`col-${col.key}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {col.label}
              </label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={selectedKeys.length === 0}>
            Tải xuống Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
