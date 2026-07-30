import { useState, useRef } from 'react';
import { db } from '@/lib/db';
import { performOfflineOcr } from '@/services/ocrService';
import { readBarcode } from '@/services/barcodeService';
import { pdfToBlobs, createThumbnail, loadPdfDocument, extractPdfPageToBlob } from '@/services/pdfService';
import { CitizenRecord, AttachedFile, PendingConflict } from '@/types/citizen';
import { toast } from 'sonner';

export type ConflictResolution = 'merge' | 'add_file_only' | 'skip' | 'create_new';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');

  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const cancelRef = useRef<boolean>(false);

  const cancelProcessing = () => {
    cancelRef.current = true;
    finishProcessing();
    toast.info('Đã dừng và xoá phiên xử lý.');
  };

  const executeQueue = async (queueToProcess: FileQueueItem[], isManualExtract: boolean = false) => {
    setIsProcessing(true);
    cancelRef.current = false;

    const totalFiles = queueToProcess.length;
    let processedCount = queueToProcess.filter(q => q.status === 'completed' || q.status === 'error').length;
    setProgress((processedCount / totalFiles) * 100);

    for (let i = 0; i < queueToProcess.length; i++) {
      if (cancelRef.current) {
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

          if (!isManualExtract) {
            setCurrentStep(`Tạo Thumbnail: ${file.name}${pageInfo}`);
          }
          const thumbnail = await createThumbnail(new File([blob], file.name, { type: blob.type }));

          if (isManualExtract) {
            let parsedPage: number | undefined = undefined;
            if (pageInfo) {
               const match = pageInfo.match(/\|(\d+)\|/);
               if (match) parsedPage = parseInt(match[1]);
            }
            await db.tempCitizens.add({
              fileName: file.name,
              fileType: file.type as 'image' | 'pdf',
              pageNumber: parsedPage,
              imageBlob: blob, // Giữ nguyên blob gốc để sau này OCR tốt hơn
              createdAt: new Date().toISOString()
            });
            setFileQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, processedImages: q.processedImages + 1 } : q));
            return;
          }

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
              await db.conflicts.add({
                id: Date.now().toString() + '_' + Math.random().toString(36).substring(7),
                existingRecord,
                parsedData,
                newFileAttr,
                createdAt: new Date().toISOString()
              });
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
            if (isManualExtract) {
              setCurrentStep(`Đang tách và lưu trang PDF: ${file.name}${pageInfo}`);
            } else {
              setCurrentStep(`Trích xuất trang PDF: ${file.name}${pageInfo}`);
            }

            const { blob } = await extractPdfPageToBlob(pdfDoc, p, 2.0);
            
            // Fix page parsing cho db.tempCitizens
            const customPageInfo = `|${p}|`; 
            await handleBlob(blob, customPageInfo);

            if (pageCount > 1) {
              const currentSubProgress = p / pageCount;
              setProgress(((processedCount + currentSubProgress) / totalFiles) * 100);
            }
          }
          await pdfDoc.cleanup();
        } else {
          if (isManualExtract) {
            setCurrentStep(`Đang lưu ảnh: ${file.name}`);
          }
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
    } else {
      setCurrentStep('Hoàn tất!');
      toast.success('Đã xử lý xong tất cả các file!');
    }
    setIsProcessing(false);
  };

  const processFiles = async (files: File[], isManualExtract: boolean = false) => {
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
    await executeQueue(initialQueue, isManualExtract);
  };

  const resumeProcessing = async () => {
    // Resume processing by resetting cancelled items to waiting
    const updatedQueue: FileQueueItem[] = fileQueue.map(q => q.status === 'cancelled' ? { ...q, status: 'waiting' } : q);
    setFileQueue(updatedQueue);
    await executeQueue(updatedQueue);
  };

  const resolveConflict = async (conflict: PendingConflict, resolution: ConflictResolution) => {
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
    await db.conflicts.delete(conflict.id);
  };

  const reprocessRecords = async (ids: number[]) => {
    setIsProcessing(true);
    setProgress(0);
    cancelRef.current = false;
    setCurrentStep('Bắt đầu chuẩn bị quét lại hồ sơ...');

    // Lấy thông tin hồ sơ
    const records = await Promise.all(ids.map(id => db.citizens.get(id)));
    const validRecords = records.filter(r => r !== undefined);

    const totalFiles = validRecords.length;
    let processedCount = 0;

    // Khởi tạo queue hiển thị
    const initialQueue: FileQueueItem[] = validRecords.map(r => ({
      id: r!.id!.toString(),
      file: { name: r!.attachedFiles?.[0]?.fileName || 'Hồ sơ ' + r!.id, type: 'image/jpeg' } as File,
      fileName: r!.attachedFiles?.[0]?.fileName || 'Hồ sơ ' + r!.id,
      totalImages: 1,
      processedImages: 0,
      status: 'waiting'
    }));
    setFileQueue(initialQueue);

    for (const record of validRecords) {
      if (cancelRef.current) {
        setFileQueue(prev => prev.map(q => !['completed', 'error'].includes(q.status) ? { ...q, status: 'cancelled' } : q));
        break;
      }

      const queueId = record!.id!.toString();
      setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'processing' } : q));

      try {
        if (!record!.attachedFiles || record!.attachedFiles.length === 0) {
          setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'error', error: 'Không có file đính kèm' } : q));
          processedCount++;
          setProgress((processedCount / totalFiles) * 100);
          continue;
        }

        // Ưu tiên quét file đính kèm đầu tiên
        const fileToOcr = record!.attachedFiles[0];

        setCurrentStep(`Đang quét lại (OCR): ${record!.idNumber || record!.fullName || 'Hồ sơ ID ' + record!.id}`);
        const { text: rawText, parsedData } = await performOfflineOcr(fileToOcr.imageBlob);

        if (parsedData.fullName) {
          parsedData.fullName = parsedData.fullName.toUpperCase();
        }

        // Gộp dữ liệu mới đè lên dữ liệu cũ (chỉ cập nhật trường có giá trị)
        const mergedData = { ...record! };
        for (const key in parsedData) {
          const val = (parsedData as any)[key];
          if (val && val !== '') {
            (mergedData as any)[key] = val;
          }
        }

        // Cập nhật text raw cho file đó
        fileToOcr.rawOcrText = rawText;
        mergedData.updatedAt = new Date().toISOString();

        await db.citizens.update(record!.id!, mergedData);

        if (!cancelRef.current) {
          setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, processedImages: 1, status: 'completed' } : q));
        }
      } catch (err) {
        console.error('Lỗi khi OCR lại hồ sơ:', record!.id, err);
        setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'error', error: 'Có lỗi xảy ra' } : q));
        toast.error(`Có lỗi khi quét lại hồ sơ ID: ${record!.id}`);
      }

      if (!cancelRef.current) {
        processedCount++;
        setProgress((processedCount / totalFiles) * 100);
      }
    }

    if (cancelRef.current) {
      setCurrentStep('Đã dừng xử lý.');
    } else {
      setCurrentStep('Hoàn tất quét lại!');
      toast.success(`Đã quét lại xong ${totalFiles} hồ sơ!`);
    }
    setIsProcessing(false);
  };

  const finishProcessing = () => {
    setIsProcessing(false);
    setFileQueue([]);
  };

  const processTempBatchOcr = async (tempIds: number[]) => {
    setIsProcessing(true);
    cancelRef.current = false;
    setProgress(0);
    setCurrentStep('Bắt đầu xử lý OCR hàng loạt từ Bảng Tạm...');

    let processedCount = 0;
    const totalFiles = tempIds.length;

    // Lấy các record từ db
    const tempRecords = await Promise.all(tempIds.map(id => db.tempCitizens.get(id)));
    const validRecords = tempRecords.filter(r => r !== undefined);

    // Khởi tạo queue để hiển thị UI
    const initialQueue: FileQueueItem[] = validRecords.map(r => ({
      id: r!.id!.toString(),
      file: { name: r!.fileName, type: r!.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg' } as File,
      fileName: r!.fileName,
      totalImages: 1,
      processedImages: 0,
      status: 'waiting'
    }));
    setFileQueue(initialQueue);

    const concurrencyLimit = 5;
    let index = 0;

    const worker = async () => {
      while (index < validRecords.length) {
        if (cancelRef.current) break;
        
        const currentIndex = index++;
        const record = validRecords[currentIndex];
        if (!record) continue;

        const queueId = record.id!.toString();
        setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'processing' } : q));

        try {
          // 1. Quét mã vạch
          const barcodeText = await readBarcode(record.imageBlob);
          
          // 2. OCR
          const { text: rawText, parsedData } = await performOfflineOcr(record.imageBlob);

          if (parsedData.fullName) {
            parsedData.fullName = parsedData.fullName.toUpperCase();
          }

          if (barcodeText && !parsedData.receiptNumber) {
            parsedData.receiptNumber = barcodeText;
          }

          const newFileAttr: AttachedFile = {
            id: Date.now().toString() + '_' + currentIndex,
            fileName: record.fileName,
            fileType: record.fileType,
            pageNumber: record.pageNumber,
            uploadDate: record.createdAt,
            imageBlob: record.imageBlob, 
            rawOcrText: rawText,
          } as any;

          // Tạo thumbnail cho file đính kèm
          const thumbnail = await createThumbnail(new File([record.imageBlob], record.fileName, { type: record.imageBlob.type }));
          newFileAttr.imageBlob = thumbnail;

          // 3. Xử lý lưu
          if (parsedData.idNumber) {
            const existingRecord = await db.findByIdNumber(parsedData.idNumber);

            if (existingRecord) {
              await db.conflicts.add({
                id: Date.now().toString() + '_' + Math.random().toString(36).substring(7),
                existingRecord,
                parsedData,
                newFileAttr,
                createdAt: new Date().toISOString()
              });
            } else {
              const newRecord: CitizenRecord = {
                ...(parsedData as any),
                status: 'pending',
                attachedFiles: [newFileAttr],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await db.citizens.add(newRecord as CitizenRecord);
            }
          } else {
            const newRecord: CitizenRecord = {
              ...(parsedData as any),
              idNumber: `UNKNOWN_${Date.now()}_${currentIndex}`,
              status: 'error',
              attachedFiles: [newFileAttr],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await db.citizens.add(newRecord as CitizenRecord);
          }

          // 4. Xóa khỏi temp
          await db.tempCitizens.delete(record.id!);
          
          if (!cancelRef.current) {
            setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, processedImages: 1, status: 'completed' } : q));
          }

        } catch (err) {
          console.error(`Lỗi xử lý OCR thẻ tạm ID ${record.id}:`, err);
          setFileQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: 'error', error: 'Có lỗi xảy ra' } : q));
        }

        if (!cancelRef.current) {
          processedCount++;
          setProgress((processedCount / totalFiles) * 100);
          setCurrentStep(`Đã xử lý ${processedCount}/${totalFiles}`);
        }
      }
    };

    const workers = [];
    for (let i = 0; i < concurrencyLimit; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    if (cancelRef.current) {
      setCurrentStep('Đã dừng xử lý.');
    } else {
      setCurrentStep('Hoàn tất!');
      toast.success('Đã xử lý OCR hàng loạt xong!');
    }
    setIsProcessing(false);
  };

  return { processFiles, processTempBatchOcr, resumeProcessing, reprocessRecords, resolveConflict, isProcessing, progress, currentStep, fileQueue, cancelProcessing, finishProcessing };
}
