'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileImage, FileType, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


interface UploadSectionProps {
  onProcessStart: (files: File[]) => void;
}

export function UploadSection({ onProcessStart }: UploadSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
      onProcessStart(selectedFiles);
      setSelectedFiles([]); // Clear list sau khi gửi đi xử lý
      setIsOpen(false);     // Tự động đóng lại
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full space-y-2">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold">Tải lên Phiếu Thu Nhận</h2>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            {isOpen ? 'Ẩn' : 'Hiện'}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                Kéo thả file vào đây hoặc click để chọn
              </p>
              <p className="text-xs text-muted-foreground">
                Hỗ trợ ảnh (JPG, PNG, WebP) và PDF (nhiều trang)
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
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Đã chọn {selectedFiles.length} file
                  </h3>
                  <Button onClick={handleProcess} size="sm" className="gap-2">
                    <Play className="w-4 h-4" /> Bắt đầu quét
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 border rounded-md relative group">
                      <div className="w-10 h-10 shrink-0 bg-secondary rounded flex items-center justify-center text-muted-foreground">
                        {file.type === 'application/pdf' ? <FileType size={20} /> : <FileImage size={20} />}
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
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
