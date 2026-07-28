'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileImage, FileType, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface UploadSectionProps {
  onProcessStart: (files: File[], isManualExtract: boolean) => void;
}

export function UploadSection({ onProcessStart }: UploadSectionProps) {

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isManualExtract, setIsManualExtract] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = () => {
    if (selectedFiles.length > 0) {
      onProcessStart(selectedFiles, isManualExtract);
      setSelectedFiles([]); // Clear list sau khi gửi đi xử lý
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 border-b bg-gray-50/50">
        <CardTitle className="text-sm font-semibold">Tải lên Phiếu Thu Nhận</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">
            Kéo thả hoặc click chọn file
          </p>
          <p className="text-xs text-muted-foreground">
            Hỗ trợ ảnh, PDF
          </p>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                  Đã chọn {selectedFiles.length} file
                </h3>
                <div className="flex items-start space-x-2 bg-secondary/30 p-2 rounded-md">
                  <Switch 
                    id="manual-extract" 
                    checked={isManualExtract}
                    onCheckedChange={setIsManualExtract}
                    className="mt-0.5"
                  />
                  <label 
                    htmlFor="manual-extract" 
                    className="text-xs leading-snug cursor-pointer flex-1 text-gray-700"
                  >
                    Chỉ tách file vào Bảng Tạm (Không quét OCR tự động)
                  </label>
                </div>
              </div>
              <Button onClick={handleProcess} size="sm" className="w-full gap-2">
                <Play className="w-4 h-4" /> Bắt đầu {isManualExtract ? 'tách' : 'quét'}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
              {selectedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border rounded-md relative group bg-white">
                  <div className="w-8 h-8 shrink-0 bg-secondary rounded flex items-center justify-center text-muted-foreground">
                    {file.type === 'application/pdf' ? <FileType size={16} /> : <FileImage size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
