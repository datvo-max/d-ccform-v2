import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "D-CCForm V2",
  description: "Quản lý Phiếu thu nhận hồ sơ căn cước",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased font-sans">
        {children}
        <Toaster position="bottom-right" richColors duration={3000} expand={true} visibleToasts={10} />
      </body>
    </html>
  );
}
