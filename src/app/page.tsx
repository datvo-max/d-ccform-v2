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
import type { CitizenRecord } from "@/types/citizen";
import { useCitizenProcessor, ConflictResolution } from "@/hooks/useCitizenProcessor";
import { exportToExcel } from "@/services/exportService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lấy thông báo toast ra
export default function DashboardPage() {
  const records = useLiveQuery(() => db.citizens.toArray(), []) || [];
  
  // States for dialogs
  const [selectedRecord, setSelectedRecord] = useState<CitizenRecord | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [manualConflict, setManualConflict] = useState<{
    existingRecord: CitizenRecord;
    newRecord: CitizenRecord;
  } | null>(null);
  
  const { processFiles, resumeProcessing, reprocessRecords, resolveConflict, pendingConflicts, isProcessing, progress, currentStep, fileQueue, cancelProcessing, finishProcessing } = useCitizenProcessor();
  
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const activeConflict = pendingConflicts.find(c => c.id === selectedConflictId);
  
  const total = records.length;
  const verified = records.filter(r => r.status === 'verified').length;
  const pending = records.filter(r => r.status === 'pending').length;
  const errors = records.filter(r => r.status === 'error').length;

  const handleProcessFiles = async (files: File[]) => {
    await processFiles(files);
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
    // Cập nhật record, set status thành verified
    try {
      const dataToSave = { ...updatedRecord };
      if (dataToSave.fullName) {
        dataToSave.fullName = dataToSave.fullName.toUpperCase();
      }
      
      await db.citizens.update(updatedRecord.id!, {
        ...dataToSave,
        status: 'verified',
        updatedAt: new Date().toISOString()
      });
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
      
      // Xoá record tạm sau khi đã gộp
      await db.citizens.delete(currentRec.id!);
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
            setSelectedRecord(record);
            setIsReviewOpen(true);
          }}
          onExport={() => setIsExportOpen(true)}
          onDelete={handleDeleteRecord}
          onBatchDelete={handleBatchDelete}
          onBatchReOcr={handleBatchReOcr}
        />
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
