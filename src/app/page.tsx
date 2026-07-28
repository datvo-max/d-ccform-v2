'use client';

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { UploadSection } from "@/components/upload/UploadSection";
import { CitizenTable } from "@/components/dashboard/CitizenTable";
import { ProcessQueue } from "@/components/dashboard/ProcessQueue";
import { ReviewSheet } from "@/components/review/ReviewSheet";
import { CompareDialog } from "@/components/review/CompareDialog";
import { ExportConfigDialog } from "@/components/export/ExportConfigDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TempCitizenTable } from "@/components/dashboard/TempCitizenTable";
import type { CitizenRecord, TempCitizenRecord } from "@/types/citizen";
import { useCitizenProcessor, ConflictResolution } from "@/hooks/useCitizenProcessor";
import { exportToExcel } from "@/services/exportService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lấy thông báo toast ra
export default function DashboardPage() {
  const records = useLiveQuery(() => db.citizens.toArray(), []) || [];
  const tempRecords = useLiveQuery(() => db.tempCitizens.toArray(), []) || [];
  
  // States for dialogs
  const [selectedRecord, setSelectedRecord] = useState<CitizenRecord | null>(null);
  const [selectedTempRecord, setSelectedTempRecord] = useState<TempCitizenRecord | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [manualConflict, setManualConflict] = useState<{
    existingRecord: CitizenRecord;
    newRecord: CitizenRecord;
  } | null>(null);
  
  const { 
    processFiles, 
    processTempBatchOcr,
    resumeProcessing, 
    reprocessRecords, 
    resolveConflict, 
    pendingConflicts, 
    isProcessing, 
    progress, 
    currentStep, 
    fileQueue, 
    cancelProcessing, 
    finishProcessing 
  } = useCitizenProcessor();
  
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const activeConflict = pendingConflicts.find(c => c.id === selectedConflictId);
  
  const total = records.length;
  const verified = records.filter(r => r.status === 'verified').length;
  const pending = records.filter(r => r.status === 'pending').length;
  const errors = records.filter(r => r.status === 'error').length;

  const handleProcessFiles = async (files: File[], isManualExtract: boolean = false) => {
    await processFiles(files, isManualExtract);
  };

  const handleExport = async (selectedKeys: string[]) => {
    try {
      const toastId = toast.loading('Đang chuẩn bị xuất file Excel...');
      await exportToExcel(records, selectedKeys, (pct) => {
        toast.loading(`Đang tạo Excel... ${pct}%`, { id: toastId });
      });
      toast.success('Xuất file thành công!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  const handleSaveReview = async (updatedRecord: CitizenRecord) => {
    // Kiểm tra trùng lặp trước khi lưu
    if (updatedRecord.idNumber) {
      try {
        const existing = await db.findByIdNumber(updatedRecord.idNumber);
        // Nếu tồn tại một hồ sơ khác có cùng số định danh
        if (existing && existing.id !== updatedRecord.id) {
          setManualConflict({
            existingRecord: existing,
            newRecord: updatedRecord
          });
          return; // Dừng luồng lưu thông thường, chuyển sang CompareDialog
        }
      } catch (err) {
        console.error('Lỗi khi kiểm tra trùng lặp lúc lưu', err);
      }
    }

    // Cập nhật record, set status thành verified
    try {
      const dataToSave = { ...updatedRecord };
      if (dataToSave.fullName) {
        dataToSave.fullName = dataToSave.fullName.toUpperCase();
      }
      
      if (selectedTempRecord) {
        // Xoá record tạm nếu nó xuất phát từ bảng tạm
        const { id, ...newCitizenData } = dataToSave; // bỏ qua id ảo nếu có
        await db.citizens.add({
          ...newCitizenData,
          status: 'verified',
          updatedAt: new Date().toISOString()
        } as CitizenRecord);
        await db.tempCitizens.delete(selectedTempRecord.id!);
        setSelectedTempRecord(null);
      } else {
        await db.citizens.update(updatedRecord.id!, {
          ...dataToSave,
          status: 'verified',
          updatedAt: new Date().toISOString()
        });
      }
      toast.success('Đã lưu và duyệt hồ sơ');
      setIsReviewOpen(false);
    } catch (err) {
      toast.error('Lỗi khi lưu hồ sơ');
    }
  };

  const handleDeleteRecord = async (id: number) => {
    try {
      await db.citizens.delete(id);
      toast.success('Đã xoá hồ sơ');
    } catch (err) {
      toast.error('Lỗi khi xoá hồ sơ');
    }
  };

  const handleBatchReOcr = async (ids: number[]) => {
    if (reprocessRecords) {
      await reprocessRecords(ids);
    }
  };

  const handleBatchDelete = async (ids: number[]) => {
    try {
      await db.citizens.bulkDelete(ids);
      toast.success(`Đã xoá ${ids.length} hồ sơ`);
    } catch (err) {
      toast.error('Lỗi khi xoá hàng loạt');
    }
  };

  const handleBatchDeleteTemp = async (ids: number[]) => {
    try {
      await db.tempCitizens.bulkDelete(ids);
      toast.success(`Đã xoá ${ids.length} thẻ khỏi bảng tạm`);
    } catch (err) {
      toast.error('Lỗi khi xoá hàng loạt bảng tạm');
    }
  };

  const handleBatchProcessTemp = async (ids: number[]) => {
    await processTempBatchOcr(ids);
  };

  const handleCheckDuplicate = async (idNumber: string, currentId: number) => {
    if (!idNumber) return toast.error('Vui lòng nhập số định danh');
    try {
      const existing = await db.findByIdNumber(idNumber);
      if (existing && existing.id !== currentId) {
        if (selectedRecord) {
          setManualConflict({
            existingRecord: existing,
            newRecord: selectedRecord
          });
        }
      } else {
        toast.info('Số định danh hợp lệ (chưa tồn tại hồ sơ nào khác).');
      }
    } catch (err) {
      toast.error('Lỗi khi kiểm tra trùng lặp');
    }
  };

  const handleResolveManualConflict = async (resolution: 'merge' | 'add_file_only') => {
    if (!manualConflict) return;
    
    const { existingRecord: existing, newRecord: currentRec } = manualConflict;
    
    try {
      if (resolution === 'add_file_only') {
        await db.citizens.update(existing.id!, {
          attachedFiles: [...existing.attachedFiles, ...currentRec.attachedFiles],
          updatedAt: new Date().toISOString()
        });
      } else if (resolution === 'merge') {
        const mergedData = { ...existing };
        mergedData.attachedFiles = [...existing.attachedFiles, ...currentRec.attachedFiles];
        for (const key in currentRec) {
          const val = (currentRec as any)[key];
          if (val && val !== '' && key !== 'id' && key !== 'attachedFiles') {
            (mergedData as any)[key] = val;
          }
        }
        mergedData.updatedAt = new Date().toISOString();
        await db.citizens.update(existing.id!, mergedData);
      }
      
      // Xoá record sau khi đã gộp
      if (selectedTempRecord && selectedTempRecord.id) {
        await db.tempCitizens.delete(selectedTempRecord.id);
        setSelectedTempRecord(null);
      } else if (currentRec.id) {
        await db.citizens.delete(currentRec.id);
      }
      
      toast.success('Đã xử lý gộp hồ sơ thành công');
      setIsReviewOpen(false);
    } catch (err) {
      toast.error('Có lỗi khi gộp hồ sơ');
    } finally {
      setManualConflict(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header 
        onSettingsClick={() => setIsSettingsOpen(true)} 
      />
      
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        <StatsCards 
          total={total} 
          verified={verified} 
          pending={pending} 
          errors={errors} 
        />
        
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Cột trái: Upload, Bảng tạm, ProcessQueue */}
          <div className="w-full lg:w-1/3 xl:w-1/4 shrink-0 flex flex-col gap-6">
            <UploadSection 
              onProcessStart={handleProcessFiles} 
            />

            {isProcessing && (
              <ProcessQueue 
                queue={fileQueue}
                currentStep={currentStep}
                progress={progress}
                onCancel={cancelProcessing}
                onResume={resumeProcessing}
                onClose={finishProcessing}
              />
            )}

            {tempRecords.length > 0 && (
              <div className="h-[600px]">
                <TempCitizenTable
                  data={tempRecords}
                  onRowClick={(tempRec) => {
                    setSelectedTempRecord(tempRec);
                    // Khi bấm vào thẻ tạm, mở ReviewSheet với dữ liệu rỗng, gắn file đính kèm là ảnh của thẻ tạm
                    const dummyRecord: CitizenRecord = {
                      receiptNumber: '',
                      residenceFileNumber: '',
                      barcode: '',
                      fullName: '',
                      fullNameNormalized: '',
                      nickname: '',
                      birthDate: '',
                      gender: '',
                      idNumber: '',
                      idNumber9: '',
                      ethnicity: '',
                      religion: '',
                      nationality: '',
                      birthPlace: '',
                      birthRegistration: '',
                      hometown: '',
                      permanentAddress: '',
                      temporaryAddress: '',
                      currentAddress: '',
                      occupation: '',
                      bloodType: '',
                      phoneNumber: '',
                      email: '',
                      familyMembers: [],
                      distinguishingMarks: '',
                      issueType: '',
                      issuingUnit: 'CA phường Tân An, TP Cần Thơ',
                      requestDigitalCard: false,
                      requestIntegrateOnCard: false,
                      requestIntegrateDigital: false,
                      requestVerifyOldId: false,
                      requestVerifyRevokedId: false,
                      requestDNACollection: false,
                      requestVoiceCollection: false,
                      attachedFiles: [{
                        id: tempRec.id!.toString(),
                        fileName: tempRec.fileName,
                        fileType: tempRec.fileType,
                        pageNumber: tempRec.pageNumber,
                        imageBlob: tempRec.imageBlob,
                        rawOcrText: '',
                        createdAt: new Date().toISOString()
                      }],
                      status: 'pending',
                      extractionConfidence: 100,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      note: ''
                    };
                    setSelectedRecord(dummyRecord);
                    setIsReviewOpen(true);
                  }}
                  onBatchDelete={handleBatchDeleteTemp}
                  onBatchProcess={handleBatchProcessTemp}
                />
              </div>
            )}
          </div>
          
          {/* Cột phải: Bảng chính và Bảng chờ duyệt */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
            {pendingConflicts.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-yellow-800">
                  Hồ sơ trùng lặp chờ xử lý ({pendingConflicts.length})
                </h3>
                <div className="bg-white rounded-md border shadow-sm divide-y">
                  {pendingConflicts.map(conflict => (
                    <div key={conflict.id} className="flex flex-wrap gap-4 items-center justify-between p-3 hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{conflict.parsedData.fullName || 'Chưa rõ tên'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: <span className="font-mono text-gray-700">{conflict.parsedData.idNumber}</span> • File: {conflict.newFileAttr.fileName}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedConflictId(conflict.id)}>
                        Xem & Giải quyết
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <CitizenTable 
              data={records} 
              onRowClick={(record) => {
                setSelectedTempRecord(null);
                setSelectedRecord(record);
                setIsReviewOpen(true);
              }}
              onExport={() => setIsExportOpen(true)}
              onDelete={handleDeleteRecord}
              onBatchDelete={handleBatchDelete}
              onBatchReOcr={handleBatchReOcr}
            />
          </div>
        </div>
      </main>

      <ReviewSheet 
        isOpen={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        record={selectedRecord}
        onSave={handleSaveReview}
        onCheckDuplicate={handleCheckDuplicate}
      />

      <ExportConfigDialog 
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onConfirm={handleExport}
      />

      <CompareDialog 
        isOpen={!!selectedConflictId || !!manualConflict}
        onClose={() => {
          if (selectedConflictId) setSelectedConflictId(null);
          if (manualConflict) setManualConflict(null);
        }}
        existingRecord={activeConflict?.existingRecord || manualConflict?.existingRecord || null}
        newRecord={activeConflict?.parsedData || manualConflict?.newRecord || null}
        onMerge={() => {
          if (activeConflict) {
            resolveConflict(activeConflict.id, 'merge');
            setSelectedConflictId(null);
          } else if (manualConflict) {
            handleResolveManualConflict('merge');
          }
        }}
        onAddFileOnly={() => {
          if (activeConflict) {
            resolveConflict(activeConflict.id, 'add_file_only');
            setSelectedConflictId(null);
          } else if (manualConflict) {
            handleResolveManualConflict('add_file_only');
          }
        }}
        onSkip={() => {
          if (activeConflict) {
            resolveConflict(activeConflict.id, 'skip');
            setSelectedConflictId(null);
          } else if (manualConflict) {
            setManualConflict(null);
          }
        }}
        onCreateNew={() => {
          if (activeConflict) {
            resolveConflict(activeConflict.id, 'create_new');
            setSelectedConflictId(null);
          } else if (manualConflict) {
            // Không cho tạo mới ở manual vì nếu tạo mới thì chỉ cần đổi ID là xong
            setManualConflict(null);
          }
        }}
        hideCreateNew={!!manualConflict}
      />

      <SettingsDialog 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
