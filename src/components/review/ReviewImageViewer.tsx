import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crop, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { extractIdFromManualCrop } from '@/services/ocrService';
import type { CitizenRecord } from '@/types/citizen';

interface ReviewImageViewerProps {
  formData: CitizenRecord;
  selectedFileIndex: number;
  setSelectedFileIndex: (index: number) => void;
  onIdNumberExtracted: (idNumber: string) => void;
}

export function ReviewImageViewer({ 
  formData, 
  selectedFileIndex, 
  setSelectedFileIndex, 
  onIdNumberExtracted 
}: ReviewImageViewerProps) {
  const [scale, setScale] = useState(1.2);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const [isCropMode, setIsCropMode] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const cropStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setScale(1.2);
    setPosition({ x: 0, y: 0 });
    setIsCropMode(false);
    setCropRect(null);
  }, [selectedFileIndex, formData.id]);

  const handleManualCropOcr = async () => {
    if (!cropRect || !imgRef.current || !formData?.attachedFiles[selectedFileIndex]) return;
    
    setIsOcrProcessing(true);
    const toastId = toast.loading('Đang xử lý OCR vùng chọn...');
    
    try {
      const imgEl = imgRef.current;
      const rect = imgEl.getBoundingClientRect();
      const clientW = imgEl.clientWidth;
      const clientH = imgEl.clientHeight;
      const naturalW = imgEl.naturalWidth;
      const naturalH = imgEl.naturalHeight;
      const renderedRatio = clientW / clientH;
      const naturalRatio = naturalW / naturalH;
      
      let renderW, renderH, offsetX = 0, offsetY = 0;
      if (naturalRatio > renderedRatio) {
        renderW = clientW;
        renderH = clientW / naturalRatio;
        offsetY = (clientH - renderH) / 2;
      } else {
        renderH = clientH;
        renderW = clientH * naturalRatio;
        offsetX = (clientW - renderW) / 2;
      }
      
      const x1 = Math.min(cropRect.startX, cropRect.endX);
      const x2 = Math.max(cropRect.startX, cropRect.endX);
      const y1 = Math.min(cropRect.startY, cropRect.endY);
      const y2 = Math.max(cropRect.startY, cropRect.endY);
      
      const realX = Math.max(0, (x1 - offsetX) * (naturalW / renderW));
      const realY = Math.max(0, (y1 - offsetY) * (naturalH / renderH));
      const realWidth = Math.min(naturalW - realX, (x2 - x1) * (naturalW / renderW));
      const realHeight = Math.min(naturalH - realY, (y2 - y1) * (naturalH / renderH));
      
      const file = formData.attachedFiles[selectedFileIndex];
      const preciseId = await extractIdFromManualCrop(file.imageBlob, {
        x: realX, y: realY, width: realWidth, height: realHeight
      });
      
      if (preciseId && preciseId.length === 12) {
        onIdNumberExtracted(preciseId);
        toast.success(`Đã quét được số định danh: ${preciseId}`, { id: toastId });
        setIsCropMode(false);
        setCropRect(null);
      } else {
        toast.error(`Đọc được: "${preciseId || ''}". Vui lòng khoanh sát chữ số hơn!`, { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi OCR vùng chọn', { id: toastId });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const renderImage = () => {
    if (formData.attachedFiles.length === 0) {
      return <div className="h-full flex items-center justify-center bg-muted text-muted-foreground">Không có ảnh</div>;
    }
    const file = formData.attachedFiles[selectedFileIndex] || formData.attachedFiles[formData.attachedFiles.length - 1];
    const url = URL.createObjectURL(file.imageBlob);
    return (
      <div className="flex flex-col h-full gap-2 relative">
        <div 
          className={`w-full flex-1 relative overflow-hidden border rounded-md bg-muted/30 ${isCropMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onWheel={(e) => {
             if (isCropMode) return;
             const zoomSensitivity = 0.1;
             const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
             setScale(prev => Math.min(Math.max(0.2, prev + delta), 5));
          }}
          onMouseDown={(e) => {
            if (isCropMode) {
              const rect = imgRef.current?.getBoundingClientRect();
              if (rect) {
                const x = (e.clientX - rect.left) / scale;
                const y = (e.clientY - rect.top) / scale;
                cropStart.current = { x, y };
                setCropRect({ startX: x, startY: y, endX: x, endY: y });
                setIsCropping(true);
              }
            } else {
              setIsDragging(true);
              dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
            }
          }}
          onMouseMove={(e) => {
            if (isCropMode && isCropping) {
              const rect = imgRef.current?.getBoundingClientRect();
              if (rect) {
                const x = (e.clientX - rect.left) / scale;
                const y = (e.clientY - rect.top) / scale;
                setCropRect(prev => prev ? { ...prev, endX: x, endY: y } : null);
              }
            } else if (!isCropMode && isDragging) {
              setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
              });
            }
          }}
          onMouseUp={() => {
            if (isCropMode) setIsCropping(false);
            else setIsDragging(false);
          }}
          onMouseLeave={() => {
            if (isCropMode) setIsCropping(false);
            else setIsDragging(false);
          }}
        >
          {/* Container chứa cả ảnh và lớp phủ */}
          <div 
            className="w-full h-full relative origin-center"
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: (isDragging || isCropMode) ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              ref={imgRef}
              src={url} 
              alt={`Phiếu thu nhận ${selectedFileIndex + 1}`} 
              className="w-full h-full object-contain pointer-events-none select-none" 
            />
            
            {/* Lớp phủ vẽ khung crop */}
            {isCropMode && cropRect && (
              <div 
                className="absolute border-2 border-blue-500 border-dashed bg-blue-500/20"
                style={{
                  left: Math.min(cropRect.startX, cropRect.endX),
                  top: Math.min(cropRect.startY, cropRect.endY),
                  width: Math.abs(cropRect.endX - cropRect.startX),
                  height: Math.abs(cropRect.endY - cropRect.startY),
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </div>
        
        {/* Nút thực thi OCR khi có vùng chọn */}
        {isCropMode && cropRect && !isCropping && Math.abs(cropRect.endX - cropRect.startX) > 20 && formData?.status !== 'verified' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <Button 
              size="sm" 
              className="shadow-lg bg-blue-600 hover:bg-blue-700 animate-in fade-in slide-in-from-top-4"
              onClick={handleManualCropOcr}
              disabled={isOcrProcessing}
            >
              <ScanLine className="w-4 h-4 mr-2" />
              {isOcrProcessing ? 'Đang đọc...' : 'Đọc Số định danh'}
            </Button>
          </div>
        )}

        {/* Nút điều khiển zoom & công cụ */}
        <div className="absolute bottom-4 right-4 flex gap-1 bg-background/80 p-1 rounded-md shadow-sm border backdrop-blur-sm z-10">
          <Button 
            variant={isCropMode ? "default" : "ghost"} 
            size="icon" 
            className={`h-7 w-7 ${isCropMode ? 'bg-blue-600' : ''}`}
            onClick={() => {
              setIsCropMode(!isCropMode);
              setCropRect(null);
            }}
            title="Khoanh vùng đọc số thủ công"
          >
            <Crop className="w-4 h-4" />
          </Button>
          <div className="w-px h-7 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(p => Math.max(0.2, p - 0.2))}>
            <span className="text-lg leading-none">-</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 font-mono" onClick={() => { setScale(1.2); setPosition({x:0, y:0}) }}>
            {Math.round(scale * 100)}%
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(p => Math.min(5, p + 0.2))}>
            <span className="text-lg leading-none">+</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-1/2 flex flex-col border-r p-4 gap-4 bg-muted/10">
      {formData.attachedFiles.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 border-b border-border">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">Chọn file:</span>
          {formData.attachedFiles.map((f, idx) => (
            <Button
              key={f.id || idx}
              variant={idx === selectedFileIndex ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFileIndex(idx)}
              className="shrink-0 h-8 text-xs"
            >
              File {idx + 1}
            </Button>
          ))}
        </div>
      )}
      <Tabs defaultValue="image" className="w-full h-full flex flex-col min-h-0">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="image">Ảnh Phiếu Gốc</TabsTrigger>
          <TabsTrigger value="raw_text">Dữ liệu thô (Raw OCR)</TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="flex-1 overflow-hidden mt-2">
          {renderImage()}
        </TabsContent>

        <TabsContent value="raw_text" className="flex-1 mt-2">
          <textarea
            className="w-full h-full p-4 font-mono text-xs resize-none rounded-md border bg-muted focus:outline-none"
            readOnly
            value={formData.attachedFiles[selectedFileIndex]?.rawOcrText || ''}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
