import { Settings, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import packageJson from '../../../package.json';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg leading-tight">D-CCForm V2</h1>
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                v{packageJson.version}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Quản lý Phiếu thu nhận căn cước</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onSettingsClick}>
            <Settings size={20} />
          </Button>
        </div>
      </div>
    </header>
  );
}
