import { Logger, type INestApplication } from '@nestjs/common';
import type { MedicalRecordData } from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createTestApp,
  resetData,
  setRecordStatus,
  signIn,
  type SeedResult,
  type TestUser,
  type TestUserKind,
} from './helpers.js';

type Method = 'get' | 'post' | 'patch';

const DENIED = { code: '3101', message: 'Permission denied' };
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Bệnh nhân tự khai (spec B, D-B30 → D-B32; mục 6.1, 6.3, 6.4, 12.2): nhánh bệnh nhân của
 * POST /medical_records, PATCH /medical_records/:id, PATCH /medical_records/:id/status. Bệnh nhân không
 * cần dòng quyền nào: quyền của bệnh nhân là quyền sở hữu hồ sơ (mục 7.2).
 */
describe('Bệnh nhân tự khai qua /medical_records (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let doctor: TestUser;
  let patient: TestUser;
  let otherPatient: TestUser;

  const api = (method: Method, path: string, by: TestUser) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  const selfReport = (body: Record<string, unknown>, by: TestUser = patient) =>
    api('post', '/medical_records', by).send(body);
  /** Hồ sơ `by` tự khai (201), trả data. */
  const selfReported = async (
    body: Record<string, unknown> = { record_type: 'MAN' },
    by: TestUser = patient,
  ) => (await selfReport(body, by).expect(201)).body.data as MedicalRecordData;
  const edit = (id: number, body: Record<string, unknown>, by: TestUser = patient) =>
    api('patch', `/medical_records/${id}`, by).send(body);
  const accept = (id: number) => api('post', `/medical_records/${id}/accept`, doctor).send({});
  /** Dòng hosobenhan đọc thẳng (không qua API) để kiểm CSDL. */
  const rowOf = (id: number) =>
    prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(id) } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
    doctor = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
    otherPatient = await user(seed.roles.benh_nhan, '0922222222', 'TRẦN VĂN BÌNH', 'patient');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medical_records: bệnh nhân tự khai (D-B30)', () => {
    it('CAP của chính mình: 201/1001, pending (D-B4), first_visit_at NULL (D-B9), đúng một dòng subtype; patient_id của người khác trong body bị bỏ qua (medrec03); dạng bệnh nhân kèm edit, cancel', async () => {
      const res = await selfReport({
        record_type: 'CAP',
        patient_id: otherPatient.id,
        self_report: { referral_diagnosis: 'Mày đay cấp', onset_weeks: 1.5 },
      }).expect(201);
      expect(res.body).toMatchObject({
        code: '1001',
        data: {
          patient_id: patient.id,
          record_type: 'CAP',
          status: 'pending',
          first_visit_at: null,
          self_report: {
            referral_diagnosis: 'Mày đay cấp',
            initial_clinic_diagnosis: null,
            onset_weeks: 1.5,
            disease_manifestation: null,
          },
          details: null,
          allowed_actions: ['edit', 'cancel'],
        },
      });
      const row = await rowOf(res.body.data.medical_record_id as number);
      expect([Number(row.ma_benh_nhan), row.trang_thai, row.thoi_diem_kham_lan_dau]).toEqual([
        patient.id,
        'pending',
        null,
      ]);
      expect([await prisma.benhanmaydaycap.count(), await prisma.benhanmaydayman.count()]).toEqual([
        1, 0,
      ]);
    });

    it('MAN: biểu hiện bệnh ghi vào benhanmaydayman; chỉ gửi record_type cũng tạo được (mọi ô tự khai không bắt buộc)', async () => {
      const man = await selfReported({
        record_type: 'MAN',
        self_report: { disease_manifestation: 'San phu + phu mach' },
      });
      expect(man.self_report.disease_manifestation).toBe('San phu + phu mach');
      expect((await prisma.benhanmaydayman.findFirstOrThrow()).bieu_hien_qua_trinh_benh).toBe(
        'San phu + phu mach',
      );
      const bare = await selfReported({ record_type: 'MAN' });
      expect(bare.self_report).toEqual({
        referral_diagnosis: null,
        initial_clinic_diagnosis: null,
        onset_weeks: null,
        disease_manifestation: null,
      });
      expect(await prisma.benhanmaydayman.count()).toBe(2);
    });

    it.each<[string, Record<string, unknown>]>([
      ['first_visit_at', { record_type: 'MAN', first_visit_at: '2026-11-15T08:30:00+07:00' }],
      ['trường lõi', { record_type: 'MAN', family_history: 'Khong' }],
      ['khối chronic', { record_type: 'MAN', chronic: { main_diagnosis: 'CSU' } }],
      [
        'khối acute (3101 trước khối lệch loại)',
        { record_type: 'MAN', acute: { hospitalized: true } },
      ],
    ])('gửi %s → 403/3101, không ghi gì', async (_title, body) => {
      expect((await selfReport(body).expect(403)).body).toEqual(DENIED);
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it.each<[string, Record<string, unknown>, string, string]>([
      [
        'biểu hiện bệnh cho hồ sơ CAP',
        { record_type: 'CAP', self_report: { disease_manifestation: 'Chi san phu' } },
        '2003',
        'self_report.disease_manifestation',
      ],
      [
        'số tuần âm (ValidationPipe, trước nhánh bệnh nhân)',
        { record_type: 'CAP', self_report: { onset_weeks: -1 } },
        '2003',
        'self_report.onset_weeks',
      ],
      ['thiếu record_type', { self_report: { onset_weeks: 1 } }, '2001', 'record_type'],
    ])('%s → 400/%s (%s), không ghi gì', async (_title, body, code, field) => {
      expect((await selfReport(body).expect(400)).body).toMatchObject({ code, data: { field } });
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('tài khoản benh_nhan thiếu dòng benhnhan → 500/9901, có log (MT-112), không ghi gì', async () => {
      const orphan = await user(seed.roles.benh_nhan, '0933333333', 'SAI LỆCH', 'none');
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      expect((await selfReport({ record_type: 'MAN' }, orphan).expect(500)).body.code).toBe('9901');
      expect(error.mock.calls.map(([message]) => String(message)).join('\n')).toContain(
        'không có dòng benhnhan',
      );
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('bác sĩ thấy hồ sơ tự khai ở danh sách chờ tiếp nhận, first_visit_at null, tiếp nhận được (spec B, mục 8.5)', async () => {
      const { medical_record_id: id } = await selfReported();
      const res = await api('get', '/medical_records/all?status=pending', doctor).expect(200);
      expect(res.body.data).toEqual([
        expect.objectContaining({
          medical_record_id: id,
          patient_id: patient.id,
          first_visit_at: null,
          allowed_actions: ['edit', 'accept', 'cancel'],
        }),
      ]);
    });
  });

  describe('PATCH /medical_records/:id: bệnh nhân sửa phần tự khai (D-B30)', () => {
    it('chờ tiếp nhận: 200/1000, chỉ trường gửi đổi, chuỗi rỗng = xoá; MAN ghi biểu hiện bệnh; dạng bệnh nhân', async () => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'MAN',
        self_report: { referral_diagnosis: 'Mày đay', onset_weeks: 6 },
      });
      const res = await edit(id, {
        self_report: {
          referral_diagnosis: '',
          initial_clinic_diagnosis: 'Mày đay mạn',
          disease_manifestation: 'Chi phu mach',
        },
      }).expect(200);
      expect(res.body).toMatchObject({
        code: '1000',
        data: {
          status: 'pending',
          self_report: {
            referral_diagnosis: null,
            initial_clinic_diagnosis: 'Mày đay mạn',
            onset_weeks: 6,
            disease_manifestation: 'Chi phu mach',
          },
          details: null,
          allowed_actions: ['edit', 'cancel'],
        },
      });
      const row = await rowOf(id);
      expect([row.chan_doan_tuyen_truoc, row.chan_doan_ban_dau_phong_kham]).toEqual([
        null,
        'Mày đay mạn',
      ]);
      expect((await prisma.benhanmaydayman.findFirstOrThrow()).bieu_hien_qua_trinh_benh).toBe(
        'Chi phu mach',
      );
    });

    it('hồ sơ nháp của mình (đặt thẳng, MT-113) → 200, vẫn nháp', async () => {
      const { medical_record_id: id } = await selfReported();
      await setRecordStatus(prisma, id, 'draft');
      await edit(id, { self_report: { onset_weeks: 2 } }).expect(200);
      expect((await rowOf(id)).trang_thai).toBe('draft');
    });

    it('hồ sơ của người khác → 403/3106, kể cả khi gửi trường của nhân viên (3106 xét trước); không ghi gì', async () => {
      const { medical_record_id: id } = await selfReported(
        { record_type: 'MAN', self_report: { onset_weeks: 6 } },
        otherPatient,
      );
      for (const body of [{ self_report: { onset_weeks: 8 } }, { family_history: 'Co' }]) {
        expect((await edit(id, body).expect(403)).body.code).toBe('3106');
      }
      expect(Number((await rowOf(id)).thoi_gian_khoi_phat_tuan)).toBe(6);
    });

    it.each<[string, Record<string, unknown>]>([
      ['trường lõi', { family_history: 'Khong' }],
      ['first_visit_at', { first_visit_at: null }],
      ['khối chronic', { chronic: { main_diagnosis: 'CSU' } }],
      [
        'self_report kèm trường lõi',
        { self_report: { onset_weeks: 8 }, treated_before_visit: true },
      ],
    ])('gửi %s → 403/3101, không ghi gì', async (_title, body) => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
      });
      expect((await edit(id, body).expect(403)).body).toEqual(DENIED);
      const row = await rowOf(id);
      expect([Number(row.thoi_gian_khoi_phat_tuan), row.tien_su_gia_dinh]).toEqual([6, null]);
    });

    it('CAP: biểu hiện bệnh → 400/2003 (field self_report.disease_manifestation)', async () => {
      const { medical_record_id: id } = await selfReported({ record_type: 'CAP' });
      expect(
        (await edit(id, { self_report: { disease_manifestation: 'Chi san phu' } }).expect(400))
          .body,
      ).toMatchObject({ code: '2003', data: { field: 'self_report.disease_manifestation' } });
    });

    it('sau khi bác sĩ tiếp nhận: bệnh nhân → 403/3101 (chỉ đọc), allowed_actions [], first_visit_at = lúc tiếp nhận (D-B9); bác sĩ phụ trách vẫn sửa được phần tự khai (D-B31)', async () => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'CAP',
        self_report: { onset_weeks: 1 },
      });
      await accept(id).expect(200);
      expect((await edit(id, { self_report: { onset_weeks: 2 } }).expect(403)).body).toEqual(
        DENIED,
      );
      const seen = (await api('get', `/medical_records/${id}`, patient).expect(200)).body
        .data as MedicalRecordData;
      expect(seen).toMatchObject({
        status: 'in_progress',
        allowed_actions: [],
        self_report: { onset_weeks: 1 },
      });
      expect(seen.first_visit_at).toMatch(ISO_DATE_TIME);
      await edit(id, { self_report: { onset_weeks: 3 } }, doctor).expect(200);
      expect(Number((await rowOf(id)).thoi_gian_khoi_phat_tuan)).toBe(3);
    });

    it('hoàn tất → 409/4003; đã huỷ → 400/4009 (ô trạng thái trước người làm)', async () => {
      const { medical_record_id: done } = await selfReported();
      await setRecordStatus(prisma, done, 'completed');
      expect((await edit(done, { self_report: { onset_weeks: 2 } }).expect(409)).body.code).toBe(
        '4003',
      );
      const { medical_record_id: gone } = await selfReported();
      await setRecordStatus(prisma, gone, 'cancelled');
      expect((await edit(gone, { self_report: { onset_weeks: 2 } }).expect(400)).body.code).toBe(
        '4009',
      );
    });
  });
});
