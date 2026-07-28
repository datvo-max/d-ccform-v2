import { Loader2, CheckCircle2, XCircle, Clock, StopCircle, X, FileImage, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileQueueItem } from "@/hooks/useCitizenProcessor";

interface ProcessQueueProps {
  queue: FileQueueItem[];
  currentStep: string;
  progress: number;
  onCancel: () => void;
  onResume: () => void;
  onClose: () => void;
}

export function ProcessQueue({ queue, currentStep, progress, onCancel, onResume, onClose }: ProcessQueueProps) {
  if (!queue || queue.length === 0) return null;

  const isAllFinished = queue.every(q => ['completed', 'error'].includes(q.status));
  const isProcessing = queue.some(q => q.status === 'processing');
  const hasCancelled = queue.some(q => q.status === 'cancelled');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Chờ xử lý';
      case 'processing': return 'Đang xử lý';
      case 'completed': return 'Hoàn thành';
      case 'error': return 'Lỗi';
      case 'cancelled': return 'Đã huỷ';
      default: return 'Chờ xử lý';
    }
  };

  return (
    <div className="bg-card border p-5 rounded-md flex flex-col gap-4 shadow-sm animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {isProcessing && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
            <span className="text-sm font-semibold text-primary">{currentStep}</span>
          </div>
          <span className="text-xs text-muted-foreground">Tổng tiến độ: {Math.round(progress)}%</span>
        </div>
        
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Button variant="destructive" size="sm" onClick={onCancel} className="gap-2">
              <StopCircle className="w-4 h-4" /> Dừng xử lý
            </Button>
          ) : (
            <>
              {!isAllFinished && hasCancelled && (
                <Button variant="default" size="sm" onClick={onResume} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Tiếp tục
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
                <X className="w-4 h-4" /> {isAllFinished ? 'Đóng' : 'Xoá phiên'}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {!isAllFinished && (
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
           <div 
             className="h-full bg-primary transition-all duration-300 ease-out" 
             style={{ width: `${progress}%` }}
           />
        </div>
      )}

      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Chi tiết từng file ({queue.length})</h4>
        {queue.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 shrink-0 bg-secondary rounded flex items-center justify-center text-muted-foreground">
                {item.file.type === 'application/pdf' ? <FileType size={16} /> : <FileImage size={16} />}
              </div>
              <div className="flex-1 min-w-0 truncate">
                <p className="font-medium truncate" title={item.fileName}>{item.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    {getStatusIcon(item.status)}
                    {getStatusText(item.status)}
                  </span>
                  <span>•</span>
                  <span>
                    {item.processedImages} / {item.totalImages} ảnh
                  </span>
                  {item.error && (
                    <>
                      <span>•</span>
                      <span className="text-red-500">{item.error}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
