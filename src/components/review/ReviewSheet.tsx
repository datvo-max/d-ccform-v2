'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CitizenRecord } from '@/types/citizen';
import { Crop, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { extractIdFromManualCrop } from '@/services/ocrService';

interface ReviewSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  record: CitizenRecord | null;
  onSave: (record: CitizenRecord) => void;
  onCheckDuplicate?: (idNumber: string, currentId: number) => void;
}

export function ReviewSheet({ isOpen, onOpenChange, record, onSave, onCheckDuplicate }: ReviewSheetProps) {
  const [formData, setFormData] = useState<CitizenRecord | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const [scale, setScale] = useState(1.2);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  // States cho tính năng khoanh vùng OCR thủ công
  const imgRef = useRef<HTMLImageElement>(null);
  const [isCropMode, setIsCropMode] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const cropStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (record && isOpen) {
      setFormData({ ...record });
      setSelectedFileIndex(record.attachedFiles?.length > 0 ? record.attachedFiles.length - 1 : 0);
      setScale(1.2);
      setPosition({ x: 0, y: 0 });
      setIsCropMode(false);
      setCropRect(null);
    }
  }, [record, isOpen]);

  useEffect(() => {
    setScale(1.2);
    setPosition({ x: 0, y: 0 });
  }, [selectedFileIndex]);

  // Phím tắt Save (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (isOpen && formData) {
          e.preventDefault(); // Ngăn trình duyệt mở dialog Save
          onSave(formData);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, formData, onSave]);

  if (!record || !formData) return null;

  const handleInputChange = (field: keyof CitizenRecord, value: any) => {
    let finalValue = value;
    if (field === 'fullName' && typeof value === 'string') {
      finalValue = value.toUpperCase();
    }
    setFormData(prev => prev ? { ...prev, [field]: finalValue } : null);
  };

  const handleManualCropOcr = async () => {
    if (!cropRect || !imgRef.current || !formData?.attachedFiles[selectedFileIndex]) return;
    
    setIsOcrProcessing(true);
    const toastId = toast.loading('Đang xử lý OCR vùng chọn...');
    
    try {
      // Tính toán toạ độ thực trên ảnh gốc
      const imgEl = imgRef.current;
      const rect = imgEl.getBoundingClientRect();
      // Vì ảnh dùng object-fit: contain, clientWidth/Height có thể bao gồm khoảng trống (letterbox)
      // Sử dụng clientWidth/Height thay vì rect.width/height vì cropRect đang được lưu ở hệ toạ độ chưa scale
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
      
      // Chuyển toạ độ màn hình (relative to img element) sang toạ độ tự nhiên (natural)
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
        handleInputChange('idNumber', preciseId);
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
        {isCropMode && cropRect && !isCropping && Math.abs(cropRect.endX - cropRect.startX) > 20 && (
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[90vw] sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Kiểm tra & Chỉnh sửa Phiếu</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Cột trái: Ảnh gốc */}
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

          {/* Cột phải: Form chỉnh sửa */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <div className="space-y-8">

              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 text-primary">I. THÔNG TIN PHIẾU</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>1. Số phiếu thu nhận</Label>
                    <Input
                      value={formData.receiptNumber || ''}
                      onChange={e => handleInputChange('receiptNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>2. Số hồ sơ cư trú</Label>
                    <Input
                      value={formData.residenceFileNumber || ''}
                      onChange={e => handleInputChange('residenceFileNumber', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 text-primary">II. THÔNG TIN ĐỊNH DANH CÁ NHÂN</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>3. Họ, chữ đệm và tên</Label>
                    <Input
                      value={formData.fullName || ''}
                      onChange={e => handleInputChange('fullName', e.target.value)}
                      className="uppercase font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>4. Tên gọi khác</Label>
                    <Input
                      value={formData.nickname || ''}
                      onChange={e => handleInputChange('nickname', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>5. Ngày sinh</Label>
                    <Input
                      value={formData.birthDate || ''}
                      onChange={e => handleInputChange('birthDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>6. Giới tính</Label>
                    <Select value={formData.gender || ''} onValueChange={val => handleInputChange('gender', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn giới tính" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nam">Nam</SelectItem>
                        <SelectItem value="Nữ">Nữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>7. Số định danh cá nhân</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.idNumber || ''}
                        onChange={e => handleInputChange('idNumber', e.target.value)}
                        className="font-bold font-mono text-primary flex-1"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => onCheckDuplicate && formData.idNumber && formData.id && onCheckDuplicate(formData.idNumber, formData.id)}
                      >
                        Kiểm tra
                      </Button>
                  </div>
                  </div>
                  <div className="space-y-2">
                    <Label>18. Số điện thoại</Label>
                    <Input 
                      value={formData.phoneNumber || ''} 
                      onChange={e => handleInputChange('phoneNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>8. Số CMND 9 số</Label>
                    <Input
                      value={formData.idNumber9 || ''}
                      onChange={e => handleInputChange('idNumber9', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>9a. Dân tộc</Label>
                    <Select value={formData.ethnicity || ''} onValueChange={val => handleInputChange('ethnicity', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn dân tộc" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kinh">Kinh</SelectItem>
                        <SelectItem value="Tày">Tày</SelectItem>
                        <SelectItem value="Thái">Thái</SelectItem>
                        <SelectItem value="Mường">Mường</SelectItem>
                        <SelectItem value="Khmer">Khmer</SelectItem>
                        <SelectItem value="Hoa">Hoa</SelectItem>
                        <SelectItem value="Nùng">Nùng</SelectItem>
                        <SelectItem value="H'Mông">H'Mông</SelectItem>
                        <SelectItem value="Dao">Dao</SelectItem>
                        <SelectItem value="Gia Rai">Gia Rai</SelectItem>
                        <SelectItem value="Ê Đê">Ê Đê</SelectItem>
                        <SelectItem value="Ba Na">Ba Na</SelectItem>
                        <SelectItem value="Sán Chay">Sán Chay</SelectItem>
                        <SelectItem value="Chăm">Chăm</SelectItem>
                        <SelectItem value="Khác">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>9b. Tôn giáo</Label>
                    <Select value={formData.religion || ''} onValueChange={val => handleInputChange('religion', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tôn giáo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Không">Không</SelectItem>
                        <SelectItem value="Phật giáo">Phật giáo</SelectItem>
                        <SelectItem value="Công giáo">Công giáo</SelectItem>
                        <SelectItem value="Cao Đài">Cao Đài</SelectItem>
                        <SelectItem value="Hòa Hảo">Hòa Hảo</SelectItem>
                        <SelectItem value="Tin Lành">Tin Lành</SelectItem>
                        <SelectItem value="Hồi giáo">Hồi giáo</SelectItem>
                        <SelectItem value="Khác">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>9c. Quốc tịch</Label>
                    <Input
                      value={formData.nationality || ''}
                      onChange={e => handleInputChange('nationality', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 text-primary">III. THÔNG TIN ĐỊA CHỈ & LIÊN LẠC</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>10. Nơi sinh</Label>
                    <Input
                      value={formData.birthPlace || ''}
                      onChange={e => handleInputChange('birthPlace', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>11. Nơi đăng ký khai sinh</Label>
                    <Input
                      value={formData.birthRegistration || ''}
                      onChange={e => handleInputChange('birthRegistration', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>12. Quê quán</Label>
                    <Input
                      value={formData.hometown || ''}
                      onChange={e => handleInputChange('hometown', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>13. Nơi thường trú</Label>
                    <Input
                      value={formData.permanentAddress || ''}
                      onChange={e => handleInputChange('permanentAddress', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>14. Nơi tạm trú</Label>
                    <Input
                      value={formData.temporaryAddress || ''}
                      onChange={e => handleInputChange('temporaryAddress', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>15. Nơi ở hiện tại</Label>
                    <Input
                      value={formData.currentAddress || ''}
                      onChange={e => handleInputChange('currentAddress', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>16. Nghề nghiệp</Label>
                    <Input
                      value={formData.occupation || ''}
                      onChange={e => handleInputChange('occupation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>17. Nhóm máu</Label>
                    <Input
                      value={formData.bloodType || ''}
                      onChange={e => handleInputChange('bloodType', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>19. Email</Label>
                    <Input
                      value={formData.email || ''}
                      onChange={e => handleInputChange('email', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Thành viên gia đình (Mục 20)</h3>
                  <Button variant="outline" size="sm" onClick={() => {
                    setFormData(prev => prev ? {
                      ...prev,
                      familyMembers: [...(prev.familyMembers || []), { fullName: '', relationship: '', nationality: 'Việt Nam', idNumber: '', idNumber9: '' }]
                    } : null)
                  }}>Thêm người</Button>
                </div>

                {(!formData.familyMembers || formData.familyMembers.length === 0) && (
                  <p className="text-xs text-muted-foreground italic">Không có dữ liệu thành viên gia đình.</p>
                )}

                {formData.familyMembers && formData.familyMembers.length > 0 && (
                  <div className="space-y-3">
                    {formData.familyMembers.map((member, idx) => (
                      <div key={idx} className="border p-3 rounded-md bg-muted/20 relative group">
                        <button
                          onClick={() => {
                            setFormData(prev => prev ? {
                              ...prev,
                              familyMembers: prev.familyMembers.filter((_, i) => i !== idx)
                            } : null)
                          }}
                          className="absolute right-2 top-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <Label className="text-xs">Mối quan hệ</Label>
                            <Input
                              className="h-8 text-xs"
                              value={member.relationship || ''}
                              onChange={e => {
                                const newMembers = [...formData.familyMembers];
                                newMembers[idx].relationship = e.target.value;
                                setFormData({ ...formData, familyMembers: newMembers });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Họ và tên</Label>
                            <Input
                              className="h-8 text-xs font-semibold"
                              value={member.fullName || ''}
                              onChange={e => {
                                const newMembers = [...formData.familyMembers];
                                newMembers[idx].fullName = e.target.value;
                                setFormData({ ...formData, familyMembers: newMembers });
                              }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Số ĐDCN</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              value={member.idNumber || member.idNumber || ''}
                              onChange={e => {
                                const newMembers = [...formData.familyMembers];
                                newMembers[idx].idNumber = e.target.value;
                                setFormData({ ...formData, familyMembers: newMembers });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Số CMND 9 số</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              value={member.idNumber9 || ''}
                              onChange={e => {
                                const newMembers = [...formData.familyMembers];
                                newMembers[idx].idNumber9 = e.target.value;
                                setFormData({ ...formData, familyMembers: newMembers });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 text-primary">IV. THÔNG TIN KHÁC</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>21. Đặc điểm nhận dạng</Label>
                    <Input
                      value={formData.distinguishingMarks || ''}
                      onChange={e => handleInputChange('distinguishingMarks', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>22. Loại cấp</Label>
                    <Input
                      value={formData.issueType || ''}
                      onChange={e => handleInputChange('issueType', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>23. Đơn vị lập</Label>
                    <Input
                      value={formData.issuingUnit || ''}
                      onChange={e => handleInputChange('issuingUnit', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 text-primary">V. TÙY CHỌN CẤP THẺ (24-30)</h3>
                <div className="grid grid-cols-1 gap-3 border p-4 rounded-md bg-muted/10">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c24" checked={formData.requestDigitalCard} onCheckedChange={c => handleInputChange('requestDigitalCard', !!c)} />
                    <Label htmlFor="c24" className="text-xs font-normal">24. Đề nghị cấp căn cước điện tử</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c25" checked={formData.requestIntegrateOnCard} onCheckedChange={c => handleInputChange('requestIntegrateOnCard', !!c)} />
                    <Label htmlFor="c25" className="text-xs font-normal">25. Đề nghị tích hợp thông tin vào thẻ Căn cước</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c26" checked={formData.requestIntegrateDigital} onCheckedChange={c => handleInputChange('requestIntegrateDigital', !!c)} />
                    <Label htmlFor="c26" className="text-xs font-normal">26. Đề nghị tích hợp thông tin vào thẻ Căn cước điện tử</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c27" checked={formData.requestVerifyOldId} onCheckedChange={c => handleInputChange('requestVerifyOldId', !!c)} />
                    <Label htmlFor="c27" className="text-xs font-normal">27. Đề nghị xác nhận số CMND, số ĐDCN đã hủy</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c28" checked={formData.requestVerifyRevokedId} onCheckedChange={c => handleInputChange('requestVerifyRevokedId', !!c)} />
                    <Label htmlFor="c28" className="text-xs font-normal">28. Đề nghị cấp Giấy xác nhận thông tin về cư trú</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c29" checked={formData.requestDNACollection} onCheckedChange={c => handleInputChange('requestDNACollection', !!c)} />
                    <Label htmlFor="c29" className="text-xs font-normal">29. Yêu cầu thu nhận thông tin sinh trắc học ADN</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="c30" checked={formData.requestVoiceCollection} onCheckedChange={c => handleInputChange('requestVoiceCollection', !!c)} />
                    <Label htmlFor="c30" className="text-xs font-normal">30. Yêu cầu thu nhận thông tin sinh trắc học giọng nói</Label>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-card flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ bỏ
          </Button>
          <Button onClick={() => onSave(formData)} title="Phím tắt: Ctrl + S">
            Xác nhận & Lưu
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
