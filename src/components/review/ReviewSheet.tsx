'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import type { CitizenRecord } from '@/types/citizen';
import { ReviewImageViewer } from './ReviewImageViewer';
import { ReviewForm } from './ReviewForm';

interface ReviewSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  record: CitizenRecord | null;
  onSave: (record: CitizenRecord) => void;
  onSaveAndNext?: (record: CitizenRecord) => void;
  onCheckDuplicate?: (idNumber: string, currentId: number) => void;
}

export function ReviewSheet({ isOpen, onOpenChange, record, onSave, onSaveAndNext, onCheckDuplicate }: ReviewSheetProps) {
  const [formData, setFormData] = useState<CitizenRecord | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  useEffect(() => {
    if (record && isOpen) {
      setFormData({ ...record });
      setSelectedFileIndex(record.attachedFiles?.length > 0 ? record.attachedFiles.length - 1 : 0);
    }
  }, [record, isOpen]);

  // Phím tắt Save (Ctrl+S / Cmd+S) và Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (isOpen && formData) {
          e.preventDefault(); // Ngăn trình duyệt mở dialog Save
          onSave(formData);
        }
      } else if (e.key === 'Enter') {
        if (isOpen && formData && onSaveAndNext) {
          // Bỏ qua nếu đang gõ trong textarea
          const activeElement = document.activeElement;
          if (activeElement && activeElement.tagName.toLowerCase() === 'textarea') {
            return;
          }
          e.preventDefault();
          onSaveAndNext(formData);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, formData, onSave, onSaveAndNext]);

  if (!record || !formData) return null;

  const handleInputChange = (field: keyof CitizenRecord, value: any) => {
    let finalValue = value;
    if (field === 'fullName' && typeof value === 'string') {
      finalValue = value.toUpperCase();
    }
    setFormData(prev => prev ? { ...prev, [field]: finalValue } : null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[90vw] sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Kiểm tra & Chỉnh sửa Phiếu</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex overflow-hidden">
          <ReviewImageViewer 
            formData={formData}
            selectedFileIndex={selectedFileIndex}
            setSelectedFileIndex={setSelectedFileIndex}
            onIdNumberExtracted={(idNumber) => handleInputChange('idNumber', idNumber)}
          />

          <ReviewForm 
            formData={formData}
            handleInputChange={handleInputChange}
            setFormData={setFormData}
            onCheckDuplicate={onCheckDuplicate}
          />
        </div>

        <div className="p-4 border-t bg-card flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ bỏ
          </Button>
          {onSaveAndNext && (
            <Button variant="secondary" onClick={() => onSaveAndNext(formData)} title="Phím tắt: Enter">
              Lưu và tiếp tục
            </Button>
          )}
          <Button onClick={() => onSave(formData)} title="Phím tắt: Ctrl + S">
            Lưu và Đóng
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
