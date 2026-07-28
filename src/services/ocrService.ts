// src/services/ocrService.ts
// Dịch vụ OCR offline 100% sử dụng Tesseract.js và Regex Parser cho Mẫu CC01

'use client';

import { createWorker, createScheduler, type Scheduler } from 'tesseract.js';
import type { CitizenRecord, FamilyMember } from '@/types/citizen';
import { removeVietnameseTones } from '@/lib/utils/removeVietnameseTones';
import { removeTableLines } from '@/lib/utils/imageProcessor';

let schedulerPromise: Promise<Scheduler> | null = null;
let digitWorkerPromise: Promise<Tesseract.Worker> | null = null;

async function getDigitWorker() {
  if (!digitWorkerPromise) {
    digitWorkerPromise = (async () => {
      const worker = await createWorker('eng', 1, { logger: () => {} });
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7',
      });
      return worker;
    })();
  }
  return digitWorkerPromise;
}

// Khởi tạo Tesseract Scheduler với nhiều worker để chạy song song thực sự
async function getOcrScheduler(): Promise<Scheduler> {
  if (!schedulerPromise) {
    schedulerPromise = (async () => {
      const scheduler = createScheduler();
      // Sử dụng tối đa 4 workers hoặc bằng số luồng CPU hiện có (tùy điều kiện nào nhỏ hơn)
      const numWorkers = typeof navigator !== 'undefined' && navigator.hardwareConcurrency 
        ? Math.max(1, Math.min(navigator.hardwareConcurrency, 4))
        : 4;
      
      const workerPromises = Array.from({ length: numWorkers }).map(async () => {
        const worker = await createWorker('vie+eng', 1, {
          logger: () => {}, // Tắt log spam
        });
        scheduler.addWorker(worker);
      });
      
      await Promise.all(workerPromises);
      return scheduler;
    })();
  }
  return schedulerPromise;
}

export async function performOfflineOcr(imageSource: Blob | File | string): Promise<{
  text: string;
  confidence: number;
  parsedData: Partial<CitizenRecord>;
}> {
  try {
    // Chạy OCR cho toàn bộ form (không dùng removeTableLines trên ảnh gốc để bảo toàn nét chữ mỏng)
    const scheduler = await getOcrScheduler();
    const ret = await scheduler.addJob('recognize', imageSource);
    const rawText = ret.data.text || '';
    const confidence = Math.round(ret.data.confidence || 0);

    const parsedData = parseCc01Text(rawText);
    
    // Bước 3: Cắt ảnh và OCR chuyên sâu cho Số định danh
    try {
      const img = new Image();
      const url = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
      await new Promise((resolve) => { img.onload = resolve; img.src = url; });
      const imageWidth = img.width;
      const imageHeight = img.height;
      
      const preciseId = await extractIdNumberWithCropping(imageSource, ret, imageWidth, imageHeight);
      if (preciseId && preciseId.length === 12) {
        parsedData.idNumber = preciseId;
      }
      
      if (typeof imageSource !== 'string') URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi OCR cắt ảnh phụ:', err);
    }

    return { text: rawText, confidence, parsedData };
  } catch (err) {
    console.error('Lỗi nhận diện OCR Offline Tesseract:', err);
    throw new Error('Không thể nhận diện văn bản bằng OCR Offline.');
  }
}

// Cắt vùng chứa 12 ô vuông của số định danh, xoá viền bằng hình học và OCR
async function extractIdNumberWithCropping(
  imageSource: Blob | File | string,
  ret: any,
  imageWidth: number,
  imageHeight: number
): Promise<string | undefined> {
  const normLines = ret.data.lines.map((l: any) => removeVietnameseTones(l.text).toLowerCase());
  const idLineIdx = normLines.findIndex((txt: string) => /dinh danh|so dinh danh|5\./.test(txt));
  
  if (idLineIdx === -1) return undefined;
  
  const idLine = ret.data.lines[idLineIdx];
  // Toạ độ bắt đầu sau chữ "Số định danh cá nhân:"
  const startX = idLine.bbox.x1 + 5; 
  const endX = imageWidth - (imageWidth * 0.05); // Chừa lề phải 5%
  const gridWidth = endX - startX;
  if (gridWidth < 100) return undefined;

  const startY = Math.max(0, idLine.bbox.y0 - 15);
  const endY = Math.min(imageHeight, idLine.bbox.y1 + 15);
  const gridHeight = endY - startY;

  // Chiều rộng mỗi ô vuông
  const boxWidth = gridWidth / 12;

  // Lấy 70% ở giữa mỗi ô (bỏ 15% viền các bên để không dính nét kẻ bảng)
  const cropMarginX = boxWidth * 0.15;
  const cropMarginY = gridHeight * 0.15;
  const sWidth = boxWidth - cropMarginX * 2;
  const sHeight = gridHeight - cropMarginY * 2;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  // Canvas mới sẽ chứa 12 chữ số xếp hàng ngang, cách nhau 5px
  const spacing = 10;
  canvas.width = 12 * (sWidth + spacing);
  canvas.height = sHeight + 20;

  // Tô nền trắng
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const url = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  await new Promise((resolve) => { img.onload = resolve; img.src = url; });

  // Vẽ phần tâm của 12 ô vào canvas mới
  for (let i = 0; i < 12; i++) {
    const sx = startX + i * boxWidth + cropMarginX;
    const sy = startY + cropMarginY;
    const dx = i * (sWidth + spacing);
    const dy = 10;
    
    ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, sWidth, sHeight);
  }

  const cleanBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(), 'image/png');
  });

  const worker = await getDigitWorker();
  const { data } = await worker.recognize(cleanBlob);
  
  const text = data.text.replace(/[^0-9]/g, '');
  if (typeof imageSource !== 'string') URL.revokeObjectURL(url);

  return text.length >= 12 ? text.substring(0, 12) : undefined;
}

export async function extractIdFromManualCrop(
  imageSource: Blob | File | string,
  cropRect: { x: number; y: number; width: number; height: number }
): Promise<string | undefined> {
  const { x: startX, y: startY, width: gridWidth, height: gridHeight } = cropRect;
  
  if (gridWidth < 50 || gridHeight < 10) return undefined;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  canvas.width = gridWidth;
  canvas.height = gridHeight;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const url = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
  await new Promise((resolve) => { img.onload = resolve; img.src = url; });

  // Vẽ nguyên phần người dùng đã khoanh (không chia 12 ô vì người dùng vẽ không đều)
  ctx.drawImage(img, startX, startY, gridWidth, gridHeight, 0, 0, gridWidth, gridHeight);

  const cleanBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(), 'image/png');
  });

  const worker = await getDigitWorker();
  const { data } = await worker.recognize(cleanBlob);
  
  const text = data.text.replace(/[^0-9]/g, '');
  if (typeof imageSource !== 'string') URL.revokeObjectURL(url);

  return text;
}

// Tiền xử lý text: loại bỏ ký tự nhiễu từ viền bảng biểu của form (|, Ì, J, +, v.v.)
function preprocessOcrText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        // Bỏ các ký tự viền bảng ở đầu/cuối dòng
        .replace(/^[\s|Ì!JL+\-=]+/, '')
        .replace(/[\s|]+$/, '')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

// Lấy phần SAU dấu hai chấm (:) trong một dòng
function afterColon(line: string, searchFromKw = ''): string {
  let searchFrom = 0;
  if (searchFromKw) {
    const kwIdx = line.toLowerCase().indexOf(searchFromKw.toLowerCase());
    if (kwIdx !== -1) searchFrom = kwIdx;
  }
  const idx = line.indexOf(':', searchFrom);
  if (idx === -1) return '';
  const val = line.substring(idx + 1).trim();
  // Loại bỏ số thứ tự và từ khoá mục tiếp theo gắn liền (ví dụ "Kinh 8.Tôn giáo" → "Kinh")
  return val.replace(/\s+\d{1,2}\.\s*\S.*$/, '').trim();
}

// Tìm dòng có keyword và trả về giá trị sau dấu ":"
function findValueByKeyword(
  lines: string[],
  keywords: string[],
  normLines: string[]
): string {
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const normLn = normLines[i];
    let matchedKw = '';
    const matched = keywords.some((kw) => {
      const normKw = removeVietnameseTones(kw).toLowerCase();
      if (/^\d+\./.test(kw)) {
        const escapedKw = kw.replace(/\./g, '\\.');
        const escapedNormKw = normKw.replace(/\./g, '\\.');
        const regex = new RegExp(`(^|\\D)${escapedKw}`, 'i');
        const normRegex = new RegExp(`(^|\\D)${escapedNormKw}`, 'i');
        if (regex.test(ln) || normRegex.test(normLn)) {
          matchedKw = kw;
          return true;
        }
      }
      if (ln.toLowerCase().includes(kw.toLowerCase()) || normLn.toLowerCase().includes(normKw)) {
        matchedKw = kw;
        return true;
      }
      return false;
    });
    if (matched) {
      const val = afterColon(ln, matchedKw);
      if (val && val.length > 0) return val;
      // Nếu không có dấu ":", lấy phần text còn lại trên dòng hiện tại sau khi loại bỏ số mục và từ khóa
      let remainder = ln.replace(/^\d+[\.\/\-]?\s*/, '');
      for (const kw of keywords) {
        const cleanKw = kw.replace(/^\d+[\.\/\-]?\s*/, '').replace(/[\.\^\$\*\+\?\(\)\[\]\{\}\|\\]/g, '\\$&');
        if (cleanKw.length > 1) {
          const regexKw = new RegExp(cleanKw, 'ig');
          remainder = remainder.replace(regexKw, '').trim();
        }
      }
      remainder = remainder.replace(/^[\:\.\-\s]+/, '').trim();
      if (remainder && remainder.length > 1 && !/^\d{1,2}\./.test(remainder)) {
        return remainder;
      }
      // Nếu không có dấu ":", thử lấy dòng kề tiếp theo
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next && !next.match(/^\d{1,2}\./) && !next.includes(':')) {
          return next;
        }
      }
    }
  }
  return '';
}

// Bóc tách bảng thành viên gia đình (mục 20) từ văn bản OCR
function parseFamilyMembers(lines: string[], normLines: string[]): FamilyMember[] {
  const family: FamilyMember[] = [];

  let startIdx = 0;
  let endIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const norm = normLines[i].toLowerCase();
    if (norm.includes('20.') && (norm.includes('thong tin ve cha') || norm.includes('cha, me') || norm.includes('dai dien') || norm.includes('vo, chong'))) {
      startIdx = i;
    } else if (startIdx > 0 && ((norm.includes('21.') && norm.includes('dac diem')) || (norm.includes('22.') && norm.includes('loai cap')) || norm.includes('cam đoan') || norm.includes('cam doan'))) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === 0) startIdx = Math.floor(lines.length / 3);

  const relPatterns = [
    { regex: /^(?:\d+[\.\/\-]?\s*)?(?:Cha|Cha đẻ|Cha de)\b/i, label: 'Cha' },
    { regex: /^(?:\d+[\.\/\-]?\s*)?(?:Mẹ|Mẹ đẻ|Me de|Me)\b/i, label: 'Mẹ' },
    { regex: /^(?:\d+[\.\/\-]?\s*)?(?:Vợ\s*\/\s*Chồng|Vợ|Chồng|Vo\s*\/\s*Chong|Vo|Chong)\b/i, label: 'Vợ/Chồng' },
    { regex: /^(?:\d+[\.\/\-]?\s*)?(?:Con|Con đẻ|Con de)\b/i, label: 'Con' },
    { regex: /^(?:\d+[\.\/\-]?\s*)?(?:Người đại diện hợp pháp|Nguoi dai dien hop phap|Đại diện hợp pháp|Dai dien hop phap)\b/i, label: 'Người đại diện hợp pháp' },
    { regex: /^(?:\d+[\.\/\-]?\s*)?(?:Người được đại diện hợp pháp|Nguoi duoc dai dien hop phap|Được đại diện hợp pháp|Duoc dai dien hop phap)\b/i, label: 'Người được đại diện hợp pháp' },
  ];

  let isRowByRow = false;
  for (let i = startIdx; i < endIdx; i++) {
    const ln = lines[i].trim();
    const normLn = normLines[i].trim();
    for (const item of relPatterns) {
      const m = ln.match(item.regex) || normLn.match(item.regex);
      if (m) {
        const remainder = ln.substring(m[0].length).replace(/^[\:\.\-\s]+/, '').trim();
        if (remainder.length > 4 || /\d{9,12}/.test(remainder)) {
          isRowByRow = true;
          break;
        }
      }
    }
    if (isRowByRow) break;
  }

  if (isRowByRow) {
    let i = startIdx;
    while (i < endIdx) {
      const ln = lines[i].trim();
      const normLn = normLines[i].trim();

      let matchedRel: string | null = null;
      let remainder = ln;

      for (const item of relPatterns) {
        const m = ln.match(item.regex) || normLn.match(item.regex);
        if (m) {
          matchedRel = item.label;
          remainder = ln.substring(m[0].length).replace(/^[\:\.\-\s]+/, '').trim();
          break;
        }
      }

      if (matchedRel) {
        const snippets: string[] = [];
        if (remainder) snippets.push(remainder);

        let j = i + 1;
        while (j < endIdx) {
          const nextLn = lines[j].trim();
          const nextNorm = normLines[j].trim();
          const isNextRel = relPatterns.some(p => p.regex.test(nextLn) || p.regex.test(nextNorm));
          if (isNextRel || /^(?:21|22)\.\s*/.test(nextLn)) {
            break;
          }
          if (nextLn && !/^(?:họ và tên|quốc tịch|số cmnd|số cccd|số định danh|mối quan hệ|stt)/i.test(nextLn)) {
            snippets.push(nextLn);
          }
          j++;
        }

        let combinedText = snippets.join(' ').replace(/(\d)\s+(?=\d)/g, '$1');
        let idNumber = '';
        let idNumber9 = '';
        let nationality = 'Việt Nam';

        const cccdMatch = combinedText.match(/\b(\d{12})\b/);
        if (cccdMatch) {
          idNumber = cccdMatch[1];
          combinedText = combinedText.replace(idNumber, ' ');
        }

        const cmndMatch = combinedText.match(/\b(\d{9})\b/);
        if (cmndMatch) {
          idNumber9 = cmndMatch[1];
          combinedText = combinedText.replace(idNumber9, ' ');
        }

        if (/việt nam|viet nam|vn\b/i.test(combinedText)) {
          nationality = 'Việt Nam';
          combinedText = combinedText.replace(/việt nam|viet nam|vn\b/gi, ' ');
        }

        let fullName = combinedText
          .replace(/[\|\:\;\-\_\,\.\(\)]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        fullName = fullName.replace(/^(?:họ và tên|họ tên|chữ đệm|quốc tịch|cccd|cmnd|số định danh)\b/gi, '').trim();

        if (fullName || idNumber || idNumber9) {
          family.push({
            fullName: fullName.toUpperCase(),
            relationship: matchedRel,
            nationality,
            idNumber9,
            idNumber,
          });
        }

        i = j - 1;
      }
      i++;
    }
  } else {
    const foundRels: string[] = [];
    const foundNames: string[] = [];
    const foundCCCDs: string[] = [];
    const foundCMNDs: string[] = [];

    for (let i = startIdx; i < endIdx; i++) {
      const ln = lines[i].trim();
      const normLn = normLines[i].trim();
      if (!ln || /^(?:20\.|họ và tên|quốc tịch|số cmnd|số cccd|số định danh|mối quan hệ|stt)/i.test(ln)) continue;
      if (/việt nam|viet nam|vn\b/i.test(ln) && ln.length < 15) continue;

      let isRelLine = false;
      for (const item of relPatterns) {
        if (item.regex.test(ln) || item.regex.test(normLn)) {
          foundRels.push(item.label);
          isRelLine = true;
          break;
        }
      }
      if (isRelLine) continue;

      const cleanNum = ln.replace(/\s+/g, '');
      const cccdM = cleanNum.match(/\b(\d{12})\b/);
      if (cccdM) {
        foundCCCDs.push(cccdM[1]);
        continue;
      }
      const cmndM = cleanNum.match(/\b(\d{9})\b/);
      if (cmndM) {
        foundCMNDs.push(cmndM[1]);
        continue;
      }

      let nameCandidate = ln.replace(/[\|\:\;\-\_\,\.\(\)]+/g, ' ').replace(/\s+/g, ' ').trim();
      nameCandidate = nameCandidate.replace(/^(?:họ và tên|họ tên|chữ đệm|quốc tịch|cccd|cmnd|số định danh)\b/gi, '').trim();
      if (nameCandidate.length > 2 && !/^\d+$/.test(nameCandidate)) {
        foundNames.push(nameCandidate.toUpperCase());
      }
    }

    const count = Math.max(foundNames.length, foundCCCDs.length, foundCMNDs.length);
    for (let k = 0; k < count; k++) {
      const rel = foundRels[k] || (k === 0 ? 'Cha' : k === 1 ? 'Mẹ' : k === 2 ? 'Vợ/Chồng' : 'Con');
      const fullName = foundNames[k] || '';
      const idNumber = foundCCCDs[k] || '';
      const idCMND = foundCMNDs[k] || '';

      if (fullName || idNumber || idCMND) {
        family.push({
          fullName,
          relationship: rel,
          nationality: 'Việt Nam',
          idNumber,
          idNumber9: idCMND,
        });
      }
    }
  }

  return family;
}

// Bóc tách toàn bộ phiếu CC01 từ text OCR thô
function parseCc01Text(rawText: string): Partial<CitizenRecord> {
  const result: Partial<CitizenRecord> = {};

  const text = preprocessOcrText(rawText);
  const lines = text.split('\n').filter(Boolean);
  const normLines = lines.map((l) => removeVietnameseTones(l));
  const normText = removeVietnameseTones(text);

  // ─── Số phiếu thu nhận & Số hồ sơ cư trú ────────────────────────────────────
  // 1. Số phiếu thu nhận (receiptNumber)
  // 2. Số hồ sơ cư trú (residenceFileNumber)
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const ln = lines[i];
    // Số hồ sơ: XXXXX-XXXXXX
    const fileIdMatch = ln.match(/\b(\d{5,8}[\-\/]\d{4,8})\b/);
    if (fileIdMatch && !result.residenceFileNumber) {
      result.residenceFileNumber = fileIdMatch[1];
    }
    // Barcode OCR fallback: nếu thư viện quét barcode thất bại, OCR có thể đọc được dải số trên cùng
    if (!result.receiptNumber) {
      const chunksMatch = ln.match(/(\d{8,12})\s+\d{4,8}\s+\d{4,8}/);
      if (chunksMatch) result.receiptNumber = chunksMatch[1];
    }
  }

  // ─── Số định danh cá nhân idNumber (12 số) ────────────────────────────────────
  {
    // Do số định danh nằm trong bảng 12 ô, OCR hay nhận nhầm viền ô thành l, I, |, !, Ì...
    // Nhận nhầm số thành chữ: O/o/Q -> 0, S/s -> 5, B/b -> 8, Z/z -> 2
    const matchStart = normText.match(/dinh danh ca nhan|so dinh danh|dinh danh|5\./i);
    
    const extractId = (rawSubstr: string): string | null => {
      // Cắt bỏ phần nhãn "Số định danh cá nhân:" nếu có
      let content = rawSubstr;
      const colonIdx = content.indexOf(':');
      if (colonIdx !== -1) {
        content = content.substring(colonIdx + 1);
      } else {
        // Cố gắng tìm chữ "danh" hoặc "nhan" rồi cắt
        const danhMatch = content.match(/danh|nhan|nhân/i);
        if (danhMatch && danhMatch.index) {
          content = content.substring(danhMatch.index + danhMatch[0].length);
        }
      }

      // 1. Xóa TẤT CẢ các ký tự không phải chữ/số (để loại bỏ viền bảng: [ ] | ! : . , { } - _ \ /)
      let cleaned = content.replace(/[^a-zA-Z0-9]/g, '');

      // 2. Map TẤT CẢ các chữ cái có thể bị nhận nhầm từ số
      const mapped = cleaned
        .replace(/[OoQqCcDd]/g, '0')
        .replace(/[lIi]/g, '1')
        .replace(/[Zz]/g, '2')
        .replace(/[Jj]/g, '3')
        .replace(/[Aa]/g, '4')
        .replace(/[Ss]/g, '5')
        .replace(/[EeGg]/g, '6')
        .replace(/[Tt\?]/g, '7')
        .replace(/[Bb]/g, '8')
        .replace(/[Pp]/g, '9');

      // 3. Xóa những chữ cái không thể map (để lại số)
      const digitsOnly = mapped.replace(/[^0-9]/g, '');

      // 4. Tìm chuỗi 12 số
      // Ưu tiên chuỗi bắt đầu bằng 0 (CCCD thật)
      const normalMatch = digitsOnly.match(/(0\d{11})/);
      if (normalMatch) return normalMatch[1];

      // Nếu không có, chấp nhận chuỗi 12 số bất kỳ (thường là dữ liệu test giả)
      const any12Match = digitsOnly.match(/(\d{12})/);
      if (any12Match) return any12Match[1];

      return null;
    };

    if (matchStart) {
      // Lấy đoạn văn bản GỐC (text) chứa khoảng trắng và viền để độ chính xác cao hơn
      const substr = text.substring(matchStart.index || 0, (matchStart.index || 0) + 200);
      result.idNumber = extractId(substr) || undefined;
    }

    // Fallback toàn bộ văn bản
    if (!result.idNumber) {
      result.idNumber = extractId(text) || undefined;
    }
  }

  // ─── Họ và tên ────────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Họ, chữ đệm', 'Ho, chu dem', '1. Ho', '1.Ho'], normLines);
    if (val && val.length > 2) {
      const cleanName = val.replace(/[\-—]+.*$/, '').trim();
      result.fullName = cleanName.toUpperCase();
      result.fullNameNormalized = removeVietnameseTones(result.fullName);
    }
    if (!result.fullName) {
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const ln = lines[i];
        if (/PHIẾU|CĂN CƯỚC|THÔNG TIN|BỘ CÔNG AN|CỘNG HÒA|THU NHẬN|TT |AUT/i.test(ln)) continue;
        if (/^[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸ\s]{5,40}$/.test(ln)) {
          result.fullName = ln.trim();
          result.fullNameNormalized = removeVietnameseTones(result.fullName);
          break;
        }
      }
    }
  }

  // ─── Ngày tháng năm sinh ──────────────────────────────────────────────────
  {
    const m = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/) ||
              text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/);
    if (m) result.birthDate = m[1].replace(/[\-\.]/g, '/');
  }

  // ─── Giới tính ───────────────────────────────────────────────────────────
  {
    const normLine429 = normText;
    const nuMatch = normLine429.match(/(?:gioi tinh|gigi tinh|4\.)\s*:?\s*nu\b/i);
    const namMatch = normLine429.match(/(?:gioi tinh|gigi tinh|4\.)\s*:?\s*nam\b/i);

    if (nuMatch || /Nữ/.test(text)) {
      result.gender = 'Nữ';
    } else if (namMatch || /(?:4\.)\s*:?\s*Nam/.test(text)) {
      result.gender = 'Nam';
    }
    if (!result.gender) {
      if (/Nữ|Nu\b/.test(text)) result.gender = 'Nữ';
      else if (/\bNam\b/.test(text) && !/Tên\s*gọi\s*khác|địa nam|Thành phố|Quận|Huyện/i.test(text.split('Nam')[0].slice(-30))) {
        result.gender = 'Nam';
      }
    }
  }

  // ─── Dân tộc ─────────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Dân tộc', 'Dan toc', '7.', '7.Dan'], normLines);
    result.ethnicity = val || 'Kinh';
  }

  // ─── Tôn giáo ────────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Tôn giáo', 'Ton giao', '8.', '8.Ton'], normLines);
    result.religion = val || 'Không';
  }

  // ─── Nơi đăng ký khai sinh ───────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Nơi đăng ký khai sinh', 'Noi dang ky khai sinh', '11.', '11.Noi', '11. Nơi', 'khai sinh'], normLines);
    if (val) result.birthRegistration = val;
  }

  // ─── Quê quán ────────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Quê quán', 'Que quan', '12.', '12.Que', '12.Quê', '12. Quê', 'Quê quán:'], normLines);
    if (val) result.hometown = val;
  }

  // ─── Nơi thường trú ──────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Nơi thường trú', 'Noi thuong tru', '13.', '13.Noi'], normLines);
    if (val) result.permanentAddress = val;
  }

  // ─── Nơi tạm trú ─────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Nơi tạm trú', 'Noi tam tru', '14.'], normLines);
    if (val) result.temporaryAddress = val;
  }

  // ─── Nơi ở hiện tại ──────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Nơi ở hiện tại', 'Noi o hien tai', '15.', '15.Noi'], normLines);
    if (val) result.currentAddress = val;
  }

  // ─── Nghề nghiệp ─────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Nghề nghiệp', 'Nghe nghiep', '16.'], normLines);
    if (val) result.occupation = val.replace(/\s+\d{2,}\s*\.\s*Nhóm máu.*/i, '').trim();
  }

  // ─── Số điện thoại ───────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['thuê bao di động', 'thue bao di dong', '18.'], normLines);
    const phoneNum = val.match(/\d{9,11}/);
    if (phoneNum) {
      result.phoneNumber = phoneNum[0];
    } else {
      const m = text.match(/\b(0[35789]\d{8})\b/);
      if (m) result.phoneNumber = m[1];
    }
  }

  // ─── Đặc điểm nhận dạng ──────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Đặc điểm nhận dạng', 'Dac diem nhan dang', '21.'], normLines);
    if (val) result.distinguishingMarks = val;
  }

  // ─── Loại cấp ────────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Loại cấp', 'Loai cap', '22.'], normLines);
    if (/đổi|doi/i.test(val)) result.issueType = 'Cấp đổi';
    else if (/lại|lai/i.test(val)) result.issueType = 'Cấp lại';
    else if (/mới|moi/i.test(val)) result.issueType = 'Cấp mới';
  }

  // ─── Đơn vị lập ──────────────────────────────────────────────────────────
  {
    const val = findValueByKeyword(lines, ['Đơn vị lập', 'Don vi lap', '23.'], normLines);
    if (val) result.issuingUnit = val.replace(/^["'\s]+|["'\s]+$/g, '');
  }

  result.nationality = 'Việt Nam';
  result.familyMembers = []; // parseFamilyMembers(lines, normLines); // Tạm thời để thủ công

  // Xử lý viết tắt "Như trên", "nt"
  if (result.hometown && /như trên|nhu tren|nt\b|như khai sinh|nhu khai sinh|như ndkks|nhu ndkks|như\s*$/i.test(result.hometown)) {
    if (result.birthRegistration) {
      result.hometown = result.birthRegistration;
    }
  }
  if (!result.hometown && result.birthRegistration && (/12\.[^\n]*như trên|12\.[^\n]*nt\b/i.test(text) || /quê quán[^\n]*như trên|que quan[^\n]*nhu tren/i.test(text))) {
    result.hometown = result.birthRegistration;
  }

  if (result.currentAddress && /như trên|nhu tren|nt\b|như thường trú|nhu thuong tru|như nơi|nhu noi|như\s*$/i.test(result.currentAddress)) {
    if (result.permanentAddress) {
      result.currentAddress = result.permanentAddress;
    }
  }

  return result;
}
