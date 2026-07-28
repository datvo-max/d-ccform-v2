'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Download, Trash2, Plus, Columns, ChevronDown, CheckSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import type { CitizenRecord } from '@/types/citizen';

interface CitizenTableProps {
  data: CitizenRecord[];
  onRowClick: (citizen: CitizenRecord) => void;
  onExport: () => void;
  onDelete: (id: number) => void;
  onBatchDelete?: (ids: number[]) => void;
  onBatchReOcr?: (ids: number[]) => void;
}

export function CitizenTable({ data, onRowClick, onExport, onDelete, onBatchDelete, onBatchReOcr }: CitizenTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

  // Trạng thái chọn hàng loạt
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState({
    idNumber: true,
    phoneNumber: true,
    fullName: true,
    birthDate: true,
    gender: true,
    permanentAddress: true,
    currentAddress: false,
    status: true,
    actions: true,
  });

  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  // Lọc và sắp xếp dữ liệu
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(
        item => item.fullName?.toLowerCase().includes(lowerSearch) ||
          item.idNumber?.includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      const statusKey = filterStatus === 'verified' ? 'verified' : filterStatus === 'pending' ? 'pending' : 'error';
      if (filterStatus === 'pending') {
        result = result.filter(item => item.status !== 'verified');
      } else {
        result = result.filter(item => item.status === filterStatus);
      }
    }

    result.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [data, searchTerm, filterStatus, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize) || 1;
  const currentData = filteredAndSortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc chắn muốn xoá hồ sơ này? Hành động này không thể hoàn tác.')) {
      onDelete(id);
    }
  };

  const handleReOcr = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (onBatchReOcr) {
      onBatchReOcr([id]);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === currentData.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set<number>();
      currentData.forEach(item => {
        if (item.id) newSelected.add(item.id);
      });
      setSelectedIds(newSelected);
    }
  };

  const handleToggleSelectRow = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xoá ${selectedIds.size} hồ sơ đã chọn? Hành động này không thể hoàn tác.`)) {
      if (onBatchDelete) {
        onBatchDelete(Array.from(selectedIds));
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleBatchReOcrClick = () => {
    if (selectedIds.size === 0) return;
    if (onBatchReOcr) {
      onBatchReOcr(Array.from(selectedIds));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm họ tên, số ĐDCN..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="verified">Đã duyệt</option>
            <option value="pending">Chưa duyệt</option>
          </select>

          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="newest">Quét gần đây</option>
            <option value="oldest">Cũ nhất</option>
          </select>

          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)} className="gap-2">
              <Columns className="h-4 w-4" /> Cột hiển thị <ChevronDown className="h-3 w-3" />
            </Button>
            {isColumnDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 md:left-auto md:right-0 bg-popover text-popover-foreground border shadow-md rounded-md p-2 z-10 w-48 flex flex-col gap-2">
                {Object.entries({
                  idNumber: 'Số ĐDCN',
                  phoneNumber: 'Số điện thoại',
                  fullName: 'Họ và Tên',
                  birthDate: 'Ngày Sinh',
                  gender: 'Giới Tính',
                  permanentAddress: 'Thường trú',
                  currentAddress: 'Hiện tại',
                  status: 'Trạng Thái',
                  actions: 'Thao tác'
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns[key as keyof typeof visibleColumns]}
                      onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                      className="rounded border-gray-300"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
          {isSelectionMode && selectedIds.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleBatchReOcrClick} className="gap-2">
                <RefreshCw className="h-4 w-4" /> OCR lại đã chọn ({selectedIds.size})
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBatchDeleteClick} className="gap-2">
                <Trash2 className="h-4 w-4" /> Xoá đã chọn ({selectedIds.size})
              </Button>
            </>
          )}
          <Button
            variant={isSelectionMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedIds(new Set()); // Huỷ chọn khi tắt
            }}
            className="gap-2"
          >
            <CheckSquare className="h-4 w-4" /> {isSelectionMode ? 'Huỷ chọn' : 'Chế độ chọn'}
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" /> Xuất Excel
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { }}>
            <Plus className="h-4 w-4" /> Nhập thủ công
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto bg-card">
        <Table className="min-w-[800px] w-full table-fixed">
          <TableHeader>
            <TableRow>
              {isSelectionMode && (
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === currentData.length && currentData.length > 0}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </TableHead>
              )}
              <TableHead className="w-12 text-center">STT</TableHead>
              {visibleColumns.idNumber && <TableHead className="w-[140px]">Số ĐDCN</TableHead>}
              {visibleColumns.phoneNumber && <TableHead className="w-[120px]">SĐT</TableHead>}
              {visibleColumns.fullName && <TableHead className="w-[180px]">Họ và Tên</TableHead>}
              {visibleColumns.birthDate && <TableHead className="w-[100px]">Ngày Sinh</TableHead>}
              {visibleColumns.gender && <TableHead className="w-[100px]">Giới Tính</TableHead>}
              {visibleColumns.permanentAddress && <TableHead className="w-[200px]">Thường trú</TableHead>}
              {visibleColumns.currentAddress && <TableHead className="w-[200px]">Hiện tại</TableHead>}
              {visibleColumns.status && <TableHead className="w-[120px]">Trạng Thái</TableHead>}
              {visibleColumns.actions && <TableHead className="w-[80px] text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSelectionMode ? 11 : 10} className="h-32 text-center text-muted-foreground">
                  Chưa có dữ liệu phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              currentData.map((item, idx) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onRowClick(item)}
                >
                  {isSelectionMode && (
                    <TableCell className="text-center" onClick={(e) => handleToggleSelectRow(e, item.id!)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id!)}
                        onChange={() => { }} // Handle on parent TD click
                        className="w-4 h-4 cursor-pointer pointer-events-none"
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-center">{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                  {visibleColumns.idNumber && <TableCell className="font-medium truncate">{item.idNumber}</TableCell>}
                  {visibleColumns.phoneNumber && <TableCell className="truncate">{item.phoneNumber}</TableCell>}
                  {visibleColumns.fullName && <TableCell className="truncate font-semibold" title={item.fullName}>{item.fullName}</TableCell>}
                  {visibleColumns.birthDate && <TableCell className="truncate">{item.birthDate}</TableCell>}
                  {visibleColumns.gender && <TableCell className="truncate">{item.gender}</TableCell>}
                  {visibleColumns.permanentAddress && <TableCell className="truncate" title={item.permanentAddress}>{item.permanentAddress}</TableCell>}
                  {visibleColumns.currentAddress && <TableCell className="truncate" title={item.currentAddress}>{item.currentAddress}</TableCell>}
                  {visibleColumns.status && (
                    <TableCell>
                      <Badge variant={item.status === 'verified' ? 'default' : 'secondary'}>
                        {item.status === 'verified' ? 'Đã duyệt' : 'Chờ duyệt'}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.actions && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="OCR lại"
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={(e) => handleReOcr(e, item.id!)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Xoá hồ sơ"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(e, item.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            className="h-8 rounded border border-input bg-transparent px-2 py-1 text-sm shadow-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>/ {filteredAndSortedData.length} kết quả</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <span>Trang {currentPage} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
