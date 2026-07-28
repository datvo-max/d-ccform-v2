// src/services/barcodeService.ts
import { BrowserMultiFormatReader } from '@zxing/browser';

let reader: BrowserMultiFormatReader | null = null;

function getBarcodeReader() {
  if (!reader) {
    reader = new BrowserMultiFormatReader();
  }
  return reader;
}

/**
 * Đọc mã vạch từ một Blob hoặc File hình ảnh
 * @param imageBlob Blob hình ảnh hoặc File
 * @returns Text của barcode nếu tìm thấy, null nếu không tìm thấy
 */
export async function readBarcode(imageBlob: Blob): Promise<string | null> {
  try {
    const reader = getBarcodeReader();
    
    // Create an object URL for the image blob
    const imageUrl = URL.createObjectURL(imageBlob);
    
    // Decode from image URL
    const result = await reader.decodeFromImageUrl(imageUrl);
    
    // Revoke object URL to free memory
    URL.revokeObjectURL(imageUrl);
    
    return result.getText();
  } catch (error) {
    // Thường ném lỗi "NotFoundException" khi không tìm thấy barcode
    return null;
  }
}
