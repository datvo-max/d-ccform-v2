import { db } from './db';


// Crypto functions
async function getPasswordKey(password: string) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("d-ccform-v2-salt-secure-2024"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export type ProgressCallback = (percent: number, message: string) => boolean | void;

export async function exportDatabase(
  password?: string,
  onProgress?: ProgressCallback
): Promise<{ blob: Blob, isEncrypted: boolean }> {
  // Chỉ import thư viện trên client (browser) để tránh lỗi "self is not defined" khi Next.js render trên server
  if (typeof window !== 'undefined') {
    await import('dexie-export-import');
  }

  // Export Dexie database to a Blob (JSON format inside)
  const blob = await db.export({
    numRowsPerChunk: 50,
    progressCallback: (progress) => {
      const percent = progress.totalRows ? Math.round((progress.completedRows / progress.totalRows) * 100) : 0;
      const result = onProgress?.(percent, `Đang xuất dữ liệu (${progress.completedRows}/${progress.totalRows})`);
      if (result === false) return false;
      return true;
    }
  });
  
  if (!password) {
    onProgress?.(100, "Hoàn tất!");
    return { blob, isEncrypted: false };
  }

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunk size
  const key = await getPasswordKey(password);
  
  const chunks: BlobPart[] = [];
  // Add magic header to identify chunked format
  chunks.push(new TextEncoder().encode("DCCB2"));

  const fileSize = blob.size;
  let offset = 0;

  while (offset < fileSize) {
    const slice = blob.slice(offset, offset + CHUNK_SIZE);
    const arrayBuffer = await slice.arrayBuffer();
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      arrayBuffer
    );
    
    // Store size of this encrypted chunk (4 bytes)
    const sizeBuffer = new Uint32Array([encryptedBuffer.byteLength]);
    
    chunks.push(iv);
    chunks.push(sizeBuffer);
    chunks.push(encryptedBuffer);
    
    offset += CHUNK_SIZE;
    const percent = Math.min(100, Math.round((offset / fileSize) * 100));
    const result = onProgress?.(percent, `Đang mã hóa dữ liệu... ${percent}%`);
    if (result === false) throw new Error("Đã hủy tiến trình sao lưu.");
  }

  const resultBlob = new Blob(chunks, { type: "application/octet-stream" });
  onProgress?.(100, "Hoàn tất!");
  return { blob: resultBlob, isEncrypted: true };
}

export async function importDatabase(
  file: File, 
  password?: string,
  onProgress?: ProgressCallback
): Promise<void> {
  // Chỉ import thư viện trên client (browser) để tránh lỗi "self is not defined"
  if (typeof window !== 'undefined') {
    await import('dexie-export-import');
  }

  let blobToImport: Blob = file;

  if (password) {
    if (file.name.endsWith('.json')) {
      throw new Error("File backup này không được mã hóa (đuôi .json). Vui lòng XÓA TRỐNG ô mật khẩu và thử lại.");
    }

    try {
      const key = await getPasswordKey(password);
      
      const magicBuffer = await file.slice(0, 5).arrayBuffer();
      const magicString = new TextDecoder().decode(magicBuffer);

      if (magicString === "DCCB2") {
        // Định dạng mới: Chunked encryption
        const decryptedChunks: BlobPart[] = [];
        let offset = 5;
        const fileSize = file.size;

        while (offset < fileSize) {
           const ivBuffer = await file.slice(offset, offset + 12).arrayBuffer();
           offset += 12;

           const sizeBuffer = await file.slice(offset, offset + 4).arrayBuffer();
           const encryptedSize = new Uint32Array(sizeBuffer)[0];
           offset += 4;

           const encryptedChunk = await file.slice(offset, offset + encryptedSize).arrayBuffer();
           offset += encryptedSize;

           const decryptedBuffer = await window.crypto.subtle.decrypt(
             { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
             key,
             encryptedChunk
           );
           decryptedChunks.push(decryptedBuffer);
           
           const percent = Math.min(100, Math.round((offset / fileSize) * 100));
           const result = onProgress?.(percent, `Đang giải mã dữ liệu... ${percent}%`);
           if (result === false) throw new Error("Đã hủy tiến trình khôi phục.");
        }
        blobToImport = new Blob(decryptedChunks, { type: "application/json" });
      } else {
        // Định dạng cũ: Toàn bộ file chung 1 khối
        const arrayBuffer = await file.arrayBuffer();
        
        const iv = arrayBuffer.slice(0, 12);
        const encryptedData = arrayBuffer.slice(12);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: new Uint8Array(iv)
          },
          key,
          encryptedData
        );
        blobToImport = new Blob([decryptedBuffer], { type: "application/json" });
      }
    } catch (e) {
      throw new Error("Sai mật khẩu hoặc file backup đã bị hỏng!");
    }
  } else {
    if (file.name.endsWith('.dccbackup')) {
      throw new Error("File backup này được bảo vệ bằng mật khẩu (đuôi .dccbackup). Vui lòng NHẬP MẬT KHẨU để khôi phục.");
    }
    // Nếu file được mã hoá nhưng người dùng không nhập mật khẩu, import sẽ báo lỗi JSON không hợp lệ
    // Có thể kiểm tra bằng cách đọc text xem có phải là JSON không.
    const sampleText = await file.slice(0, 10).text();
    if (!sampleText.startsWith('{') && !sampleText.startsWith('[')) {
      throw new Error("File có thể đã được mã hoá. Vui lòng nhập mật khẩu để khôi phục.");
    }
  }

  try {
    await db.import(blobToImport, {
      clearTablesBeforeImport: true,
      progressCallback: (progress) => {
         const percent = progress.totalRows ? Math.round((progress.completedRows / progress.totalRows) * 100) : 0;
         const result = onProgress?.(percent, `Đang khôi phục cơ sở dữ liệu (${progress.completedRows}/${progress.totalRows})`);
         if (result === false) return false;
         return true;
      }
    });
    onProgress?.(100, "Khôi phục thành công!");
  } catch (err: any) {
    throw new Error(err.message || "Lỗi không xác định khi import.");
  }
}
