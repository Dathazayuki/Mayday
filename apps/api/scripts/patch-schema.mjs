// Sửa prisma/schema.prisma do `prisma db pull` sinh ra (spec A, mục 3.4; spike mục 2), để
// `prisma generate` chạy được và Prisma không ghi vào cột do CSDL tự điền. Chạy lại sau mỗi lần pull:
// `pnpm --filter @drmayday/api db:pull`. Không tìm thấy chỗ cần sửa thì ném lỗi: nhóm DB đã đổi schema.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './entry-point.mjs';

export const SCHEMA_HEADER =
  '// Sinh bằng `pnpm --filter @drmayday/api db:pull` từ `prisma/vendor/mayday-database`. Không sửa tay.';

/** 6 bảng subtype: khoá chính và cột `loai_*` generated mà FK ghép của bảng cha trỏ tới. */
const SUBTYPE_MODELS = {
  benhanmaydaycap: ['ma_ho_so', 'loai_benh_an'],
  benhanmaydayman: ['ma_ho_so', 'loai_benh_an'],
  phienkhamcap: ['ma_phien_kham', 'loai_benh_an'],
  phienkhamman: ['ma_phien_kham', 'loai_benh_an'],
  ketquacanlamsangcap: ['ma_ket_qua_can_lam_sang', 'loai_ket_qua_can_lam_sang'],
  ketquacanlamsangman: ['ma_ket_qua_can_lam_sang', 'loai_ket_qua_can_lam_sang'],
};

function schemaChanged(what) {
  return new Error(
    `patch-schema: ${what}. Nhóm DB đã đổi schema: xem lại apps/api/scripts/patch-schema.mjs.`,
  );
}

/** [đầu, cuối) của khối `model <name> {`: từ chữ `model` tới ngay trước dòng `}` đóng khối. */
function modelRange(text, model) {
  const start = text.search(new RegExp(`^model ${model} \\{$`, 'm'));
  if (start < 0) throw schemaChanged(`không thấy model ${model}`);
  const end = text.indexOf('\n}', start);
  if (end < 0) throw schemaChanged(`model ${model} thiếu dấu } đóng khối`);
  return [start, end];
}

function patchSubtype(body, model, [primaryKey, kindColumn]) {
  const field = new RegExp(`^([ \\t]+${kindColumn}[ \\t]+String\\?)([^\\n]*)$`, 'm');
  const match = field.exec(body);
  if (!match) throw schemaChanged(`không thấy trường ${model}.${kindColumn}`);
  // Bước 2: cột generated không nhận giá trị ghi tường minh (428C9, spike 2.2) → bỏ default literal.
  const attributes = match[2].replace(/[ \t]*@default\("(?:CAP|MAN)"\)/, '').trimEnd();
  let patched = body.replace(field, `${match[1]}${attributes}`);
  // Bước 1: quan hệ 1-1 qua FK ghép cần unique ở phía định nghĩa (P1012, spike 2.1). Chỉ khai báo
  // cho Prisma, không đổi CSDL (khoá chính đã bảo đảm duy nhất).
  const unique = `@@unique([${primaryKey}, ${kindColumn}])`;
  if (!patched.includes(unique)) patched = `${patched}\n\n  ${unique}`;
  return patched;
}

export function patchSchema(input) {
  let text = input.replace(/\r\n/g, '\n');
  if (text.startsWith(`${SCHEMA_HEADER}\n`)) text = text.slice(SCHEMA_HEADER.length + 1);
  for (const [model, columns] of Object.entries(SUBTYPE_MODELS)) {
    const [start, end] = modelRange(text, model);
    text =
      text.slice(0, start) + patchSubtype(text.slice(start, end), model, columns) + text.slice(end);
  }
  // Bước 3 (D1): giờ tạo bản ghi do CSDL ghi, cùng đồng hồ với trigger cập nhật; Prisma không gửi
  // cột có default dbgenerated.
  // Chạy lại trên file đã sửa thì không còn now() nhưng đã có dbgenerated: không phải lỗi.
  if (
    !text.includes('@default(now())') &&
    !text.includes('@default(dbgenerated("CURRENT_TIMESTAMP"))')
  )
    throw schemaChanged('không thấy @default(now())');
  text = text.replaceAll('@default(now())', '@default(dbgenerated("CURRENT_TIMESTAMP"))');
  // Bước 4: chú thích đầu file.
  return `${SCHEMA_HEADER}\n${text}`;
}

if (isEntryPoint(import.meta.url)) {
  const schemaPath = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  writeFileSync(schemaPath, patchSchema(readFileSync(schemaPath, 'utf8')));
  console.log('Đã sửa prisma/schema.prisma theo spec A, mục 3.4.');
}
