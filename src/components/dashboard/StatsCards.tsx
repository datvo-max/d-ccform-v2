import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface StatsCardsProps {
  total: number;
  verified: number;
  pending: number;
  errors: number;
}

export function StatsCards({ total, verified, pending, errors }: StatsCardsProps) {
  const stats = [
    { title: 'Tổng phiếu', value: total, icon: FileText, desc: 'Đã quét' },
    { title: 'Đã xác minh', value: verified, icon: CheckCircle2, desc: 'Dữ liệu chuẩn' },
    { title: 'Chờ xử lý', value: pending, icon: Clock, desc: 'Cần kiểm tra' },
    { title: 'Lỗi / Cảnh báo', value: errors, icon: AlertCircle, desc: 'Cần sửa' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.desc}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
