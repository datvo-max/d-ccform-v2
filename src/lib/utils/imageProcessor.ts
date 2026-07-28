// src/lib/utils/imageProcessor.ts

/**
 * Xóa các đường kẻ ngang và dọc trong ảnh (thường là viền bảng biểu)
 * bằng cách duyệt qua các hàng và cột trên HTML5 Canvas.
 * Giúp OCR (Tesseract) không bị nhầm lẫn viền thành chữ 'l', 'I', '|', '1'.
 */
export async function removeTableLines(imageSource: Blob | File | string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('Không thể khởi tạo Canvas 2D context'));

      const width = img.width;
      const height = img.height;
      canvas.width = width;
      canvas.height = height;

      // Vẽ ảnh gốc lên canvas
      ctx.drawImage(img, 0, 0);

      // Lấy dữ liệu pixel
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Mảng cờ đánh dấu các pixel cần bị tô trắng
      const toErase = new Uint8Array(width * height);

      // Ngưỡng phân loại đen trắng (0: đen tuyệt đối, 255: trắng tuyệt đối)
      // Dùng 150 để bắt được các đường kẻ mờ
      const threshold = 150;

      // Helper: Kiểm tra độ dày (thickness) của nét
      const getThickness = (cx: number, cy: number, isVertical: boolean): number => {
        let count = 1;
        if (isVertical) {
          for (let i = 1; i <= 10; i++) {
            const nx = cx - i;
            if (nx < 0) break;
            const idx = (cy * width + nx) * 4;
            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (gray < threshold) count++; else break;
          }
          for (let i = 1; i <= 10; i++) {
            const nx = cx + i;
            if (nx >= width) break;
            const idx = (cy * width + nx) * 4;
            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (gray < threshold) count++; else break;
          }
        } else {
          for (let i = 1; i <= 10; i++) {
            const ny = cy - i;
            if (ny < 0) break;
            const idx = (ny * width + cx) * 4;
            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (gray < threshold) count++; else break;
          }
          for (let i = 1; i <= 10; i++) {
            const ny = cy + i;
            if (ny >= height) break;
            const idx = (ny * width + cx) * 4;
            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (gray < threshold) count++; else break;
          }
        }
        return count;
      };

      // 1. Xóa đường kẻ ngang
      // Chiều dài tối thiểu để coi là một đường kẻ ngang (ví dụ 100px hoặc 5% chiều rộng ảnh)
      const minHLen = Math.max(100, Math.floor(width * 0.05));
      for (let y = 0; y < height; y++) {
        let runStart = -1;
        let runLength = 0;
        
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

          if (gray < threshold) {
            if (runStart === -1) runStart = x;
            runLength++;
          } else {
            if (runLength > minHLen) {
              const cx1 = Math.floor(runStart + runLength * 0.25);
              const cx2 = Math.floor(runStart + runLength * 0.5);
              const cx3 = Math.floor(runStart + runLength * 0.75);
              const minThickness = Math.min(getThickness(cx1, y, false), getThickness(cx2, y, false), getThickness(cx3, y, false));
              
              // Nếu nét ngang có độ dày mỏng (<= 5px), coi là viền bảng và xoá
              if (minThickness <= 5) {
                for (let i = runStart; i < x; i++) {
                  toErase[y * width + i] = 1;
                }
              }
            }
            runStart = -1;
            runLength = 0;
          }
        }
        if (runLength > minHLen) {
          const cx1 = Math.floor(runStart + runLength * 0.25);
          const cx2 = Math.floor(runStart + runLength * 0.5);
          const cx3 = Math.floor(runStart + runLength * 0.75);
          const minThickness = Math.min(getThickness(cx1, y, false), getThickness(cx2, y, false), getThickness(cx3, y, false));
          if (minThickness <= 5) {
            for (let i = runStart; i < width; i++) {
              toErase[y * width + i] = 1;
            }
          }
        }
      }

      // 2. Xóa đường kẻ dọc
      // Chiều dài tối thiểu để coi là một đường kẻ dọc (bằng khoảng chiều cao của 1 ô text, 40px)
      const minVLen = Math.max(40, Math.floor(height * 0.02));
      for (let x = 0; x < width; x++) {
        let runStart = -1;
        let runLength = 0;
        
        for (let y = 0; y < height; y++) {
          const idx = (y * width + x) * 4;
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

          if (gray < threshold) {
            if (runStart === -1) runStart = y;
            runLength++;
          } else {
            if (runLength > minVLen) {
              const cy1 = Math.floor(runStart + runLength * 0.25);
              const cy2 = Math.floor(runStart + runLength * 0.5);
              const cy3 = Math.floor(runStart + runLength * 0.75);
              const minThickness = Math.min(getThickness(x, cy1, true), getThickness(x, cy2, true), getThickness(x, cy3, true));
              
              // Nếu nét dọc mỏng (<= 5px), đây là viền bảng -> Xoá
              // Nét > 5px khả năng cao là nét của số 1, số 4 -> Giữ lại
              if (minThickness <= 5) {
                for (let i = runStart; i < y; i++) {
                  toErase[i * width + x] = 1;
                }
              }
            }
            runStart = -1;
            runLength = 0;
          }
        }
        if (runLength > minVLen) {
          const cy1 = Math.floor(runStart + runLength * 0.25);
          const cy2 = Math.floor(runStart + runLength * 0.5);
          const cy3 = Math.floor(runStart + runLength * 0.75);
          const minThickness = Math.min(getThickness(x, cy1, true), getThickness(x, cy2, true), getThickness(x, cy3, true));
          if (minThickness <= 5) {
            for (let i = runStart; i < height; i++) {
              toErase[i * width + x] = 1;
            }
          }
        }
      }

      // 3. Áp dụng tô trắng các pixel đã đánh dấu
      for (let i = 0; i < toErase.length; i++) {
        if (toErase[i] === 1) {
          const idx = i * 4;
          data[idx] = 255;     // R
          data[idx + 1] = 255; // G
          data[idx + 2] = 255; // B
          // Giữ nguyên Alpha data[idx + 3]
        }
      }

      // Đưa dữ liệu trở lại Canvas
      ctx.putImageData(imgData, 0, 0);

      // Trả về dạng Blob để tương thích với input của Tesseract
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Lỗi khi xuất Canvas ra Blob'));
        }
      }, 'image/png');
    };

    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      img.src = objectUrl;
    }
  });
}
