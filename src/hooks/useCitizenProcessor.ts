import { useState, useRef } from 'react';
import { db } from '@/lib/db';
import { performOfflineOcr } from '@/services/ocrService';
import { readBarcode } from '@/services/barcodeService';
import { pdfToBlobs, createThumbnail, loadPdfDocument, extractPdfPageToBlob } from '@/services/pdfService';
import { CitizenRecord, AttachedFile } from '@/types/citizen';
import { toast } from 'sonner';

export type ConflictResolution = 'merge' | 'add_file_only' | 'skip' | 'create_new';

export interface PendingConflict {
  id: string;
  existingRecord: CitizenRecord;
  parsedData: Partial<CitizenRecord>;
  newFileAttr: AttachedFile;
}

export type FileProcessStatus = 'waiting' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface FileQueueItem {
  id: string;
  file: File;
  fileName: string;
  totalImages: number;
  processedImages: number;
  status: FileProcessStatus;
  error?: string;
}

export function useCitizenProcessor() {
  const [pendingConflicts, setPendingConflicts] = useState<PendingConflict[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');

  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const cancelRef = useRef<boolean>(false);

  const cancelProcessing = () => {
    cancelRef.current = true;
    toast.info('Đang dừng xử lý...');
  };

  const executeQueue = async (queueToProcess: FileQueueItem[]) => {
    setIsProcessing(true);
    cancelRef.current = false;

    const totalFiles = queueToProcess.length;
    let processedCount = queueToProcess.filter(q => q.status === 'completed' || q.status === 'error').length;
    setProgress((processedCount / totalFiles) * 100);

    for (let i = 0; i < queueToProcess.length; i++) {
      if (cancelRef.current) {
        setFileQueue(prev => prev.map((q, idx) => idx >= i && !['completed', 'error'].includes(q.status) ? { ...q, status: 'cancelled' } : q));
        break;
      }

      const queueItem = queueToProcess[i];
      if (queueItem.status === 'completed' || queueItem.status === 'error') {
        continue;
      }

      const file = queueItem.file;
      setFileQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'processing' } : q));

      try {
        const handleBlob = async (blob: Blob, pageInfo: string) => {
          if (cancelRef.current) return;

          setCurrentStep(`Tạo Thumbnail: ${file.name}${pageInfo}`);
          const thumbnail = await createThumbnail(new File([blob], file.name, { type: blob.type }));

          if (cancelRef.current) return;
          setCurrentStep(`Quét Mã vạch (Barcode): ${file.name}${pageInfo}`);
          const barcodeText = await readBarcode(blob);

          if (cancelRef.current) return;
          setCurrentStep(`Đang trích xuất văn bản (OCR)... Có thể mất vài giây: ${file.name}${pageInfo}`);
          const { text: rawText, parsedData } = await performOfflineOcr(blob);

          if (parsedData.fullName) {
            parsedData.fullName = parsedData.fullName.toUpperCase();
          }

          if (barcodeText && !parsedData.receiptNumber) {
            parsedData.receiptNumber = barcodeText;
          }

          const newFileAttr: AttachedFile = {
            id: Date.now().toString(),
            fileName: file.name,
            fileType: file.type as 'image' | 'pdf',
            uploadDate: new Date().toISOString(),
            imageBlob: thumbnail,
            rawOcrText: rawText,
          } as any;

          if (cancelRef.current) return;
          setCurrentStep(`Kiểm tra dữ liệu trùng lặp trong CSDL...${pageInfo}`);
          if (parsedData.idNumber) {
            const existingRecord = await db.findByIdNumber(parsedData.idNumber);

            if (existingRecord) {
              setPendingConflicts(prev => [...prev, {
                id: Date.now().toString() + '_' + Math.random().toString(36).substring(7),
                existingRecord,
                parsedData,
                newFileAttr,
              }]);
            } else {
              const newRecord: CitizenRecord = {
                ...(parsedData as any),
                status: 'pending',
                attachedFiles: [newFileAttr],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await db.citizens.add(newRecord as CitizenRecord);
              toast.success(`Đã lưu hồ sơ mới: ${parsedData.idNumber}`);
            }
          } else {
            toast.warning(`Không nhận diện được Số định danh trong file ${file.name}. Đã lưu dưới dạng "Chưa xác định".`);
            const newRecord: CitizenRecord = {
              ...(parsedData as any),
              idNumber: `UNKNOWN_${Date.now()}`,
              status: 'error',
              attachedFiles: [newFileAttr],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await db.citizens.add(newRecord as CitizenRecord);
          }

          setFileQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, processedImages: q.processedImages + 1 } : q));
        };

        if (file.type === 'application/pdf') {
          setCurrentStep(`Đang tải file PDF: ${file.name}`);
          const pdfDoc = await loadPdfDocument(file);
          const pageCount = pdfDoc.numPages;
          for (let p = 1; p <= pageCount; p++) {
            if (cancelRef.current) break;

            const pageInfo = pageCount > 1 ? ` (Trang ${p}/${pageCount})` : '';
            setCurrentStep(`Trích xuất trang PDF: ${file.name}${pageInfo}`);

            const { blob } = await extractPdfPageToBlob(pdfDoc, p, 2.0);
            await handleBlob(blob, pageInfo);

            if (pageCount > 1) {
              const currentSubProgress = p / pageCount;
              setProgress(((processedCount + currentSubProgress) / totalFiles) * 100);
            }
          }
          await pdfDoc.cleanup();
        } else {
          await handleBlob(file, '');
        }

        if (!cancelRef.current) {
          setFileQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'completed' } : q));
        }
      } catch (err) {
        console.error('Lỗi xử lý file:', file.name, err);
        toast.error(`Có lỗi khi xử lý file ${file.name}`);
        setFileQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'error', error: 'Có lỗi xảy ra' } : q));
      }

      if (!cancelRef.current) {
        processedCount++;
        setProgress((processedCount / totalFiles) * 100);
      }
    }

    if (cancelRef.current) {
      setCurrentStep('Đã dừng xử lý.');
      toast.warning('Đã dừng xử lý theo yêu cầu!');
    } else {
      setCurrentStep('Hoàn tất!');
      toast.success('Đã xử lý xong tất cả các file!');
    }
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Đang phân tích file...');

    const initialQueue: FileQueueItem[] = [];
    for (const file of files) {
      let totalImages = 1;
      try {
        if (file.type === 'application/pdf') {
          const pdfDoc = await loadPdfDocument(file);
          totalImages = pdfDoc.numPages;
          await pdfDoc.cleanup();
        }
      } catch (err) {
        console.error('Lỗi khi đọc số trang PDF:', err);
      }

      initialQueue.push({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        totalImages,
        processedImages: 0,
        status: 'waiting'
      });
    }

    setFileQueue(initialQueue);
    await executeQueue(initialQueue);
  };

  const resumeProcessing = async () => {
    // Resume processing by resetting cancelled items to waiting
    const updatedQueue: FileQueueItem[] = fileQueue.map(q => q.status === 'cancelled' ? { ...q, status: 'waiting' } : q);
    setFileQueue(updatedQueue);
    await executeQueue(updatedQueue);
  };

  const resolveConflict = async (conflictId: string, resolution: ConflictResolution) => {
    const conflict = pendingConflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    if (resolution !== 'skip') {
      const freshExistingRecord = await db.findByIdNumber(conflict.parsedData.idNumber!);
      if (freshExistingRecord) {
        if (resolution === 'add_file_only') {
          await db.citizens.update(freshExistingRecord.id!, {
            attachedFiles: [...freshExistingRecord.attachedFiles, conflict.newFileAttr],
            updatedAt: new Date().toISOString()
          });
          toast.success(`Đã thêm file vào hồ sơ ${conflict.parsedData.idNumber}`);
        } else if (resolution === 'merge') {
          const mergedData = { ...freshExistingRecord };
          for (const key in conflict.parsedData) {
            const val = (conflict.parsedData as any)[key];
            if (val && val !== '') {
              (mergedData as any)[key] = val;
            }
          }
          mergedData.attachedFiles = [...freshExistingRecord.attachedFiles, conflict.newFileAttr];
          mergedData.updatedAt = new Date().toISOString();

          await db.citizens.update(freshExistingRecord.id!, mergedData);
          toast.success(`Đã gộp hồ sơ ${conflict.parsedData.idNumber}`);
        } else if (resolution === 'create_new') {
          const newRecord: CitizenRecord = {
            ...(conflict.parsedData as any),
            idNumber: `${conflict.parsedData.idNumber}_COPY_${Date.now()}`,
            status: 'pending',
            attachedFiles: [conflict.newFileAttr],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await db.citizens.add(newRecord as CitizenRecord);
          toast.success(`Đã tạo hồ sơ mới tách biệt.`);
        }
      } else {
        const newRecord: CitizenRecord = {
          ...(conflict.parsedData as any),
          status: 'pending',
          attachedFiles: [conflict.newFileAttr],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.citizens.add(newRecord as CitizenRecord);
        toast.success(`Đã lưu hồ sơ mới: ${conflict.parsedData.idNumber}`);
      }
    }
    setPendingConflicts(prev => prev.filter(c => c.id !== conflictId));
  };

  const reprocessRecords = async (ids: number[]) => {
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Bắt đầu quét lại hồ sơ...');
    let processedCount = 0;
    const totalFiles = ids.length;

    for (const id of ids) {
      try {
        const record = await db.citizens.get(id);
        if (!record || !record.attachedFiles || record.attachedFiles.length === 0) {
          processedCount++;
          setProgress((processedCount / totalFiles) * 100);
          continue;
        }

        // Ưu tiên quét file đính kèm đầu tiên
        const fileToOcr = record.attachedFiles[0];

        setCurrentStep(`Đang quét lại (OCR): ${record.idNumber || record.fullName || 'Hồ sơ ID ' + id}`);
        const { text: rawText, parsedData } = await performOfflineOcr(fileToOcr.imageBlob);

        if (parsedData.fullName) {
          parsedData.fullName = parsedData.fullName.toUpperCase();
        }

        // Gộp dữ liệu mới đè lên dữ liệu cũ (chỉ cập nhật trường có giá trị)
        const mergedData = { ...record };
        for (const key in parsedData) {
          const val = (parsedData as any)[key];
          if (val && val !== '') {
            (mergedData as any)[key] = val;
          }
        }

        // Cập nhật text raw cho file đó
        fileToOcr.rawOcrText = rawText;
        mergedData.updatedAt = new Date().toISOString();

        await db.citizens.update(id, mergedData);
      } catch (err) {
        console.error('Lỗi khi OCR lại hồ sơ:', id, err);
        toast.error(`Có lỗi khi quét lại hồ sơ ID: ${id}`);
      }

      processedCount++;
      setProgress((processedCount / totalFiles) * 100);
    }

    setCurrentStep('Hoàn tất quét lại!');
    setIsProcessing(false);
    toast.success(`Đã quét lại xong ${totalFiles} hồ sơ!`);
  };

  const finishProcessing = () => {
    setIsProcessing(false);
    setFileQueue([]);
  };

  return { processFiles, resumeProcessing, reprocessRecords, resolveConflict, pendingConflicts, isProcessing, progress, currentStep, fileQueue, cancelProcessing, finishProcessing };
}
