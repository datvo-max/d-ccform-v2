// src/services/pdfService.ts
// Chuyển đổi trang PDF thành ảnh Canvas/Blob để gửi cho OCR

'use client';

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    // Cấu hình worker cdn cho trình duyệt
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

// Chuyển trang PDF thành Blob ảnh PNG
export async function pdfPageToBlob(
  file: File,
  pageNumber: number = 1,
  scale: number = 2.0  // Scale 2x để đảm bảo độ phân giải đủ cho OCR
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  );

  page.cleanup();
  await (pdf as any).destroy();

  return { blob, dataUrl, width: viewport.width, height: viewport.height };
}

// Lấy số trang của file PDF
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  await (pdf as any).destroy();
  return numPages;
}

// Chuyển toàn bộ trang PDF thành mảng Blob
export async function pdfToBlobs(
  file: File,
  scale: number = 2.0
): Promise<Array<{ blob: Blob; dataUrl: string; pageNumber: number }>> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  
  const results = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png')
    );

    page.cleanup();
    results.push({ blob, dataUrl, width: viewport.width, height: viewport.height, pageNumber: i });
  }
  
  await (pdf as any).destroy();
  return results;
}

// Tải tài liệu PDF 1 lần
export async function loadPdfDocument(file: File) {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  return await pdfjs.getDocument({ data: arrayBuffer }).promise;
}

// Trích xuất 1 trang PDF thành ảnh và dọn dẹp bộ nhớ ngay lập tức
export async function extractPdfPageToBlob(
  pdf: any,
  pageNumber: number,
  scale: number = 2.0
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  );

  // Giải phóng bộ nhớ khổng lồ của Canvas và Page
  canvas.width = 0;
  canvas.height = 0;
  page.cleanup();

  return { blob, dataUrl, width: viewport.width, height: viewport.height };
}

// Lưu trữ ảnh hồ sơ chất lượng cao
export async function createThumbnail(file: File): Promise<Blob> {
  if (file.type === 'application/pdf') {
    const { blob } = await pdfPageToBlob(file, 1, 2.0);
    return blob;
  } else {
    // File ảnh: Nếu dưới 10MB giữ nguyên Blob gốc
    if (file.size <= 10 * 1024 * 1024) {
      return file;
    }
    // Resize về tối đa 2400px
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 2400;
        let width = img.width;
        let height = img.height;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = width * ratio;
          height = height * ratio;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.92);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }
}

// Chuyển File ảnh thành dataURL (base64)
export async function imageFileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
