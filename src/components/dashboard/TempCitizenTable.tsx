'use client';

import { useState, useMemo } from 'react';
import { Trash2, Play, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { TempCitizenRecord } from '@/types/citizen';
import { toast } from 'sonner';

interface TempCitizenTableProps {
  data: TempCitizenRecord[];
  onRowClick: (record: TempCitizenRecord) => void;
  onBatchProcess: (ids: number[]) => void;
  onBatchDelete: (ids: number[]) => void;
}

export function TempCitizenTable({ data, onRowClick, onBatchProcess, onBatchDelete }: TempCitizenTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const totalPages = Math.ceil(data.length / pageSize) || 1;
  const currentData = useMemo(() => {
    return data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [data, currentPage, pageSize]);

  // Chọn tất cả trên trang hiện tại
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSet = new Set(selectedIds);
      currentData.forEach(d => newSet.add(d.id as number));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      currentData.forEach(d => newSet.delete(d.id as number));
      setSelectedIds(newSet);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleProcessSelected = () => {
    if (selectedIds.size === 0) return;
    onBatchProcess(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xoá ${selectedIds.size} thẻ này khỏi bảng tạm?`)) {
      onBatchDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="flex flex-col h-[500px] border rounded-md bg-white shadow-sm overflow-hidden">
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Bảng tạm ({data.length})</h3>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={handleDeleteSelected}>
                <Trash2 className="w-3 h-3 mr-1" /> Xoá ({selectedIds.size})
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleProcessSelected}>
                <Play className="w-3 h-3 mr-1" /> Quét ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {data.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Không có thẻ nào trong bảng tạm.
          </div>
        ) : (
          <div className="divide-y flex-1 overflow-y-auto">
            <div className="flex items-center gap-3 p-2 px-3 bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b">
              <Checkbox
                checked={currentData.length > 0 && currentData.every(d => selectedIds.has(d.id as number))}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-xs font-medium text-gray-500">Chọn tất cả trang này</span>
            </div>

            {currentData.map((record) => {
              const isSelected = selectedIds.has(record.id as number);
              return (
                <div
                  key={record.id}
                  className={`flex items-center gap-3 p-2 px-3 cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => onRowClick(record)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(record.id as number, checked as boolean)}
                    />
                  </div>

                  <div className="w-10 h-10 bg-gray-200 rounded shrink-0 overflow-hidden flex items-center justify-center">
                    {/* Bảng tạm chứa hình lớn chưa crop, nên thu nhỏ hoặc hiển thị icon */}
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" title={record.fileName}>
                      {record.fileName}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      ID: {record.id} {record.pageNumber ? `(Trang ${record.pageNumber})` : ''} • {(record.imageBlob.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {data.length > 0 && (
        <div className="border-t p-2 flex items-center justify-between bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs border rounded p-1 bg-white outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>

            <span className="text-xs font-medium mx-1">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-7 h-7"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
