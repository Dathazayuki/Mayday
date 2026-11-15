import {
  RECORD_TYPES,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type RecordType,
  type VisitCoreFields,
  type VisitData,
} from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { change, dateFromIso, decimalToNumber, isoDate } from '../prisma/db-values.js';
import { oneOf, type RecordLock, type RecordView } from './medical-record-mapping.js';

/**
 * Ánh xạ API ↔ CSDL thật của phiên khám (spec B, mục 3.5–3.8, 4.2, 4.6): `phienkham` +
 * `phienkhamcap`/`phienkhamman`, tên bác sĩ (`nguoi` qua `nhanvien`), tên phòng (`phongkham`). Tên bảng,
 * tên cột tiếng Việt chỉ nằm ở đây và trong visits.repository.ts (D10). Như medical-record-mapping.ts,
 * khối lâm sàng của bản ghi miền (core, acute, chronic) dùng thẳng kiểu của contract (D-B14); ngày dạng
 * `YYYY-MM-DD` vì service so ngày hẹn với ngày khám sau khi gộp với giá trị của request.
 */

// ---- Bản ghi miền ----

/** Phiên khám (spec B, mục 4.2). */
export interface VisitRecord {
  id: number;
  recordId: number;
  type: RecordType;
  /** lan_kham_thu. */
  number: number;
  /** ngay_kham. */
  date: string;
  doctorId: number;
  doctorName: string;
  /** null "khi chưa phân phòng" (SQL:1459, MT-115). */
  roomId: number | null;
  roomName: string | null;
  /** ngay_hen_tai_kham. */
  nextAppointmentDate: string | null;
  /** dan_do (#183): hiển thị cho bệnh nhân. */
  instructions: string | null;
  core: VisitCoreFields;
  /** Khác null khi CAP. */
  acute: AcuteVisitFields | null;
  /** Khác null khi MAN. */
  chronic: ChronicVisitFields | null;
}

/** Chủ hồ sơ và các phiên (GET /medical_records/:id/visits): bệnh nhân chỉ xem hồ sơ của mình. */
export interface RecordVisits {
  patientId: number;
  /** lan_kham_thu tăng dần. */
  visits: VisitRecord[];
}

/** Phần service quyết định khi mở phiên mới (tiếp nhận, thêm phiên; spec B, mục 6.2). */
export interface VisitStart {
  /** = người gọi (docs/04 #26 "Hệ thống tự sinh"). */
  doctorId: number;
  roomId: number | null;
  /** `YYYY-MM-DD`; mặc định hôm nay giờ Việt Nam (D-B23). */
  date: string;
}

/** Phiên mới: INSERT phienkham + subtype. API chỉ ghi khoá và cột của VisitStart; seed lâm sàng ghi thêm. */
export interface NewVisit extends VisitStart {
  recordId: number;
  type: RecordType;
  /** lan_kham_thu = MAX + 1 trong hồ sơ đã khoá (D-B2). */
  number: number;
  nextAppointmentDate: string | null;
  instructions: string | null;
  core: Partial<VisitCoreFields>;
  acute: Partial<AcuteVisitFields>;
  chronic: Partial<ChronicVisitFields>;
}

/** Thay đổi của PATCH /visits/:id (và dặn dò khi hoàn tất): chỉ khoá có mặt được ghi; null = xoá. */
export interface VisitChanges {
  date?: string;
  roomId?: number | null;
  nextAppointmentDate?: string | null;
  instructions?: string | null;
  core?: Partial<VisitCoreFields>;
  acute?: Partial<AcuteVisitFields>;
  chronic?: Partial<ChronicVisitFields>;
}

// ---- Hàng của CSDL ----

/** include của mọi lần đọc phiên: tên bác sĩ, tên phòng, hai bảng subtype (phienkham không có INTERVAL). */
export const VISIT_INCLUDE = {
  nhanvien: { select: { nguoi: { select: { ho_ten: true } } } },
  phongkham: { select: { ten_phong_kham: true } },
  phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham: true,
  phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham: true,
} satisfies Prisma.phienkhamInclude;

export type VisitRow = Prisma.phienkhamGetPayload<{ include: typeof VISIT_INCLUDE }>;
type AcuteVisitRow = NonNullable<
  VisitRow['phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham']
>;
type ChronicVisitRow = NonNullable<
  VisitRow['phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham']
>;

/** Cột phienkham mà repository được ghi: bỏ identity và cột generated (spec A, mục 4.7; spike 3f). */
export type VisitColumns = Omit<
  Prisma.phienkhamUncheckedCreateInput,
  'ma_phien_kham' | 'ma_subtype_cap' | 'ma_subtype_man'
>;
/** Cột phienkhamcap; loai_benh_an là cột generated (SQL:511). */
export type AcuteVisitColumns = Omit<
  Prisma.phienkhamcapUncheckedCreateInput,
  'ma_phien_kham' | 'loai_benh_an'
>;
/** Cột phienkhamman; loai_benh_an là cột generated (SQL:534). */
export type ChronicVisitColumns = Omit<
  Prisma.phienkhammanUncheckedCreateInput,
  'ma_phien_kham' | 'loai_benh_an'
>;

// ---- Hàng CSDL → bản ghi miền ----

/** phienkhamcap (mục 3.6). */
function toAcuteVisit(row: AcuteVisitRow): AcuteVisitFields {
  return {
    skin_symptoms: row.trieu_chung_da,
    respiratory_symptoms: row.trieu_chung_ho_hap,
    respiratory_vs_usual: row.so_voi_thuong_ngay_ho_hap,
    circulatory_symptoms: row.trieu_chung_tuan_hoan,
    circulatory_vs_usual: row.so_voi_thuong_ngay_tuan_hoan,
    digestive_symptoms: row.trieu_chung_tieu_hoa,
    digestive_vs_usual: row.so_voi_thuong_ngay_tieu_hoa,
    has_wheals: row.co_san_phu,
    has_wheal_photo: row.co_anh_san_phu,
    vomiting_count: row.so_lan_non,
  };
}

/** phienkhamman (mục 3.7). */
function toChronicVisit(row: ChronicVisitRow): ChronicVisitFields {
  return {
    wheals_now: row.hien_tai_co_san_phu,
    wheal_trigger_context: row.hoan_canh_xuat_hien_san_phu,
    dominant_spontaneous: row.uu_the_ngau_nhien,
    spontaneous_weeks: decimalToNumber(row.thoi_gian_ngau_nhien_tuan),
    dominant_induced: row.uu_the_kich_thich,
    induced_weeks: decimalToNumber(row.thoi_gian_kich_thich_tuan),
    dominant_equal: row.uu_the_tuong_duong,
    dominant_unknown: row.uu_the_khong_ro,
    wheal_location: row.vi_tri_san_phu,
    wheal_aggravating_factor: row.yeu_to_lam_nang_sa_phu,
    angioedema_this_episode: row.trong_dot_co_phu_mach,
    angioedema_now: row.hien_tai_co_phu_mach,
    angioedema_trigger_context: row.hoan_canh_xuat_hien_phu_mach,
    angioedema_count: row.so_lan_phu_mach_dot_nay,
    angioedema_hospitalizations: row.so_lan_phu_mach_nang_phai_nhap_vien,
    angioedema_duration_with_meds: row.thoi_gian_ton_tai_phu_mach_co_dung_thuoc,
    angioedema_duration_without_meds: row.thoi_gian_ton_tai_phu_mach_khong_dung_thuoc,
    aas7_score: row.diem_aas7,
    angioedema_side: row.ben_phu_mach,
    angioedema_order_vs_wheals: row.thu_tu_xuat_hien_so_voi_san_phu,
    angioedema_interval: row.khoang_cach_xuat_hien,
    angioedema_last_week: row.phu_mach_1_tuan_gan_day,
    follow_up_diagnosis: row.chan_doan_tai_kham,
    angioedema_eyelid: row.phu_mi_mat,
    angioedema_tongue: row.phu_luoi,
    angioedema_lip: row.phu_moi,
    angioedema_face_other: row.phu_vung_mat_khac,
    angioedema_larynx: row.phu_thanh_quan,
    angioedema_hand: row.phu_ban_tay,
    angioedema_foot: row.phu_ban_chan,
    angioedema_genital: row.phu_sinh_duc,
    angioedema_other_site: row.phu_vi_tri_khac,
    angioedema_other_site_detail: row.phu_vi_tri_khac_ghi_ro,
  };
}

export function toVisitRecord(row: VisitRow): VisitRecord {
  const acute = row.phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham;
  const chronic = row.phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham;
  return {
    id: fromDbId(row.ma_phien_kham),
    recordId: fromDbId(row.ma_ho_so),
    type: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    number: row.lan_kham_thu,
    date: isoDate(row.ngay_kham),
    doctorId: fromDbId(row.ma_bac_si),
    doctorName: row.nhanvien.nguoi.ho_ten,
    roomId: row.ma_phong_kham === null ? null : fromDbId(row.ma_phong_kham),
    roomName: row.phongkham?.ten_phong_kham ?? null,
    nextAppointmentDate: isoDate(row.ngay_hen_tai_kham),
    instructions: row.dan_do,
    core: {
      visit_kind: row.loai_phien_kham,
      serum_stored: row.luu_huyet_thanh,
      fever: row.sot,
      fever_temperature_c: decimalToNumber(row.sot_nhiet_do_c),
      visit_summary: row.tom_tat_buoi_kham,
      next_plan: row.huong_xu_tri_lan_sau,
    },
    acute: acute && toAcuteVisit(acute),
    chronic: chronic && toChronicVisit(chronic),
  };
}

// ---- Bản ghi miền → cột ghi ----

/** Lõi của phienkham (mục 3.5) trừ ngày khám, phòng, ngày hẹn, dặn dò (ghi riêng). */
function visitCoreColumns(fields: Partial<VisitCoreFields>) {
  return {
    loai_phien_kham: fields.visit_kind,
    luu_huyet_thanh: fields.serum_stored,
    sot: fields.fever,
    sot_nhiet_do_c: fields.fever_temperature_c,
    tom_tat_buoi_kham: fields.visit_summary,
    huong_xu_tri_lan_sau: fields.next_plan,
  } satisfies Partial<VisitColumns>;
}

export function acuteVisitColumns(fields: Partial<AcuteVisitFields>) {
  return {
    trieu_chung_da: fields.skin_symptoms,
    trieu_chung_ho_hap: fields.respiratory_symptoms,
    so_voi_thuong_ngay_ho_hap: fields.respiratory_vs_usual,
    trieu_chung_tuan_hoan: fields.circulatory_symptoms,
    so_voi_thuong_ngay_tuan_hoan: fields.circulatory_vs_usual,
    trieu_chung_tieu_hoa: fields.digestive_symptoms,
    so_voi_thuong_ngay_tieu_hoa: fields.digestive_vs_usual,
    co_san_phu: fields.has_wheals,
    co_anh_san_phu: fields.has_wheal_photo,
    so_lan_non: fields.vomiting_count,
  } satisfies AcuteVisitColumns;
}

export function chronicVisitColumns(fields: Partial<ChronicVisitFields>) {
  return {
    hien_tai_co_san_phu: fields.wheals_now,
    hoan_canh_xuat_hien_san_phu: fields.wheal_trigger_context,
    uu_the_ngau_nhien: fields.dominant_spontaneous,
    thoi_gian_ngau_nhien_tuan: fields.spontaneous_weeks,
    uu_the_kich_thich: fields.dominant_induced,
    thoi_gian_kich_thich_tuan: fields.induced_weeks,
    uu_the_tuong_duong: fields.dominant_equal,
    uu_the_khong_ro: fields.dominant_unknown,
    vi_tri_san_phu: fields.wheal_location,
    yeu_to_lam_nang_sa_phu: fields.wheal_aggravating_factor,
    trong_dot_co_phu_mach: fields.angioedema_this_episode,
    hien_tai_co_phu_mach: fields.angioedema_now,
    hoan_canh_xuat_hien_phu_mach: fields.angioedema_trigger_context,
    so_lan_phu_mach_dot_nay: fields.angioedema_count,
    so_lan_phu_mach_nang_phai_nhap_vien: fields.angioedema_hospitalizations,
    thoi_gian_ton_tai_phu_mach_co_dung_thuoc: fields.angioedema_duration_with_meds,
    thoi_gian_ton_tai_phu_mach_khong_dung_thuoc: fields.angioedema_duration_without_meds,
    diem_aas7: fields.aas7_score,
    ben_phu_mach: fields.angioedema_side,
    thu_tu_xuat_hien_so_voi_san_phu: fields.angioedema_order_vs_wheals,
    khoang_cach_xuat_hien: fields.angioedema_interval,
    phu_mach_1_tuan_gan_day: fields.angioedema_last_week,
    chan_doan_tai_kham: fields.follow_up_diagnosis,
    phu_mi_mat: fields.angioedema_eyelid,
    phu_luoi: fields.angioedema_tongue,
    phu_moi: fields.angioedema_lip,
    phu_vung_mat_khac: fields.angioedema_face_other,
    phu_thanh_quan: fields.angioedema_larynx,
    phu_ban_tay: fields.angioedema_hand,
    phu_ban_chan: fields.angioedema_foot,
    phu_sinh_duc: fields.angioedema_genital,
    phu_vi_tri_khac: fields.angioedema_other_site,
    phu_vi_tri_khac_ghi_ro: fields.angioedema_other_site_detail,
  } satisfies ChronicVisitColumns;
}

/**
 * INSERT phienkham (D-B1): loai_benh_an = loại của hồ sơ đã khoá (FK ghép SQL:418–419); không gửi cột
 * generated.
 */
export function newVisitToDb(visit: NewVisit) {
  return {
    ma_ho_so: toDbId(visit.recordId),
    loai_benh_an: visit.type,
    ma_bac_si: toDbId(visit.doctorId),
    ma_phong_kham: change(visit.roomId, toDbId),
    ngay_kham: dateFromIso(visit.date),
    lan_kham_thu: visit.number,
    ngay_hen_tai_kham: change(visit.nextAppointmentDate, dateFromIso),
    dan_do: visit.instructions,
    ...visitCoreColumns(visit.core),
  } satisfies VisitColumns;
}

/** UPDATE phienkham của PATCH /visits/:id: chỉ cột có trường được gửi; bác sĩ, số lần, hồ sơ không sửa. */
export function visitChangesToDb(changes: VisitChanges) {
  return {
    ngay_kham: changes.date === undefined ? undefined : dateFromIso(changes.date),
    ma_phong_kham: change(changes.roomId, toDbId),
    ngay_hen_tai_kham: change(changes.nextAppointmentDate, dateFromIso),
    dan_do: changes.instructions,
    ...visitCoreColumns(changes.core ?? {}),
  } satisfies Partial<VisitColumns>;
}

/**
 * Phiên mới của API (tiếp nhận, thêm phiên; spec B, mục 6.2): lan_kham_thu = MAX + 1 đọc sau khi khoá
 * (D-B2), loại theo hồ sơ, chưa có trường lâm sàng.
 */
export function startVisit(lock: RecordLock, start: VisitStart): NewVisit {
  return {
    ...start,
    recordId: lock.id,
    type: lock.type,
    number: lock.maxVisitNumber + 1,
    nextAppointmentDate: null,
    instructions: null,
    core: {},
    acute: {},
    chronic: {},
  };
}

// ---- Bản ghi miền → contract ----

/** Phần tử của GET /medical_records/:id/visits, data của POST và PATCH; bệnh nhân nhận `details: null` (D-B21). */
export function toVisitData(visit: VisitRecord, view: RecordView): VisitData {
  return {
    visit_id: visit.id,
    medical_record_id: visit.recordId,
    visit_number: visit.number,
    visit_date: visit.date,
    doctor_id: visit.doctorId,
    doctor_name: visit.doctorName,
    room_id: visit.roomId,
    room_name: visit.roomName,
    next_appointment_date: visit.nextAppointmentDate,
    instructions: visit.instructions,
    details:
      view === 'patient' ? null : { ...visit.core, acute: visit.acute, chronic: visit.chronic },
  };
}
