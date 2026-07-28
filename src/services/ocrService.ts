// src/services/ocrService.ts
// Dịch vụ OCR offline 100% sử dụng Tesseract.js và Regex Parser cho Mẫu CC01

'use client';

import { createWorker, type Worker } from 'tesseract.js';
import type { CitizenRecord, FamilyMember } from '@/types/citizen';
import { removeVietnameseTones } from '@/lib/utils/removeVietnameseTones';

let workerPromise: Promise<Worker> | null = null;

// Khởi tạo Tesseract Worker một lần duy nhất
async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('vie+eng', 1, {
        logger: () => {}, // Tắt log spam
      });
      return worker;
    })();
  }
  return workerPromise;
}

// Chạy OCR trên ảnh (dạng Blob, File, hoặc DataURL)
export async function performOfflineOcr(imageSource: Blob | File | string): Promise<{
  text: string;
  confidence: number;
  parsedData: Partial<CitizenRecord>;
}> {
  try {
    const worker = await getOcrWorker();
    const ret = await worker.recognize(imageSource);
    const rawText = ret.data.text || '';
    const confidence = Math.round(ret.data.confidence || 0);

    const parsedData = parseCc01Text(rawText);
    return { text: rawText, confidence, parsedData };
  } catch (err) {
    console.error('Lỗi nhận diện OCR Offline Tesseract:', err);
    throw new Error('Không thể nhận diện văn bản bằng OCR Offline.');
  }
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
    // Cách tốt nhất là tìm từ khóa, lấy một đoạn văn bản sau đó, gọt bỏ mọi thứ không phải số.
    const matchStart = normText.match(/dinh danh ca nhan|so dinh danh|dinh danh|5\./i);
    if (matchStart) {
      // Lấy 100 ký tự sau từ khóa
      const substr = normText.substring(matchStart.index || 0, (matchStart.index || 0) + 150);
      // Giữ lại số và chữ O/o (do hay nhầm 0 thành O)
      const digitsOnly = substr.replace(/[^0-9Oo]/g, '').replace(/[Oo]/g, '0');
      // ID luôn bắt đầu bằng 0 và có đúng 12 số
      const match12 = digitsOnly.match(/(0\d{11})/);
      if (match12) {
        result.idNumber = match12[1];
      }
    }

    // Fallback nếu không tìm thấy dựa trên từ khóa (quét toàn bộ văn bản)
    if (!result.idNumber) {
      // Dùng text gốc (có dấu) để phòng hờ
      const digitsOnly = text.replace(/[^0-9Oo]/g, '').replace(/[Oo]/g, '0');
      const allMatches = [...digitsOnly.matchAll(/(0\d{11})/g)];
      // Nếu có nhiều số 12 chữ số, ưu tiên số đầu tiên tìm được
      if (allMatches.length > 0) {
        result.idNumber = allMatches[0][1];
      }
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
