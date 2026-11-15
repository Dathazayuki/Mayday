import type { MedicalRecordAction, MedicalRecordStatus } from '@drmayday/shared';
import {
  DOCTOR_ID,
  OTHER_DOCTOR_ID,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  adminCaller,
  doctorCaller,
  nurseCaller,
  patientCaller,
} from './caller.fixture.js';
import {
  allowedActions,
  assertOwnRecord,
  assertStaffCanEdit,
  requireStaffPermission,
  requireStaffWriter,
  type Caller,
  type RecordPermission,
  type RecordState,
} from './record-access.js';

const state = (
  status: MedicalRecordStatus,
  assignedDoctorId: number | null = null,
  patientId = PATIENT_ID,
): RecordState => ({ patientId, status, assignedDoctorId });

const only = (...permissions: RecordPermission[]) => new Set(permissions);

/** Mã của AppException mà `run` ném, hoặc null nếu không ném. */
function codeOf(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'không phải AppException';
  }
}

describe('record-access: đọc, ghi (spec B, mục 6.3, 7.2)', () => {
  it('requireStaffPermission: nhân viên thiếu quyền → 3101; có quyền, admin, bệnh nhân → qua', () => {
    expect(
      codeOf(() =>
        requireStaffPermission(nurseCaller({ permissions: only() }), 'view_medical_records'),
      ),
    ).toBe('3101');
    expect(codeOf(() => requireStaffPermission(nurseCaller(), 'examine_medical_records'))).toBe(
      '3101',
    );
    expect(codeOf(() => requireStaffPermission(nurseCaller(), 'view_medical_records'))).toBeNull();
    expect(
      codeOf(() => requireStaffPermission(adminCaller(), 'manage_medical_records')),
    ).toBeNull();
    expect(
      codeOf(() => requireStaffPermission(patientCaller(), 'view_medical_records')),
    ).toBeNull();
  });

  it('requireStaffWriter: bệnh nhân → 3101 (nhánh tự khai làm ở B6); nhân viên theo quyền', () => {
    expect(codeOf(() => requireStaffWriter(patientCaller(), 'manage_medical_records'))).toBe(
      '3101',
    );
    expect(codeOf(() => requireStaffWriter(nurseCaller(), 'manage_medical_records'))).toBeNull();
    expect(
      codeOf(() =>
        requireStaffWriter(
          nurseCaller({ permissions: only('view_medical_records') }),
          'manage_medical_records',
        ),
      ),
    ).toBe('3101');
  });

  it('assertOwnRecord: bệnh nhân xem hồ sơ người khác → 3106; của mình, nhân viên → qua (D-B21)', () => {
    expect(codeOf(() => assertOwnRecord(patientCaller(), OTHER_PATIENT_ID))).toBe('3106');
    expect(codeOf(() => assertOwnRecord(patientCaller(), PATIENT_ID))).toBeNull();
    expect(codeOf(() => assertOwnRecord(nurseCaller(), OTHER_PATIENT_ID))).toBeNull();
  });
});

describe('assertStaffCanEdit (bảng 6.1, hàng "Sửa hồ sơ")', () => {
  it.each(['draft', 'pending'] as const)(
    '%s: nhân viên có quyền sửa được (MT-113: draft cũng sửa được)',
    (status) => {
      expect(codeOf(() => assertStaffCanEdit(nurseCaller(), state(status)))).toBeNull();
    },
  );

  it('đang khám: chỉ bác sĩ phụ trách (bác sĩ của phiên đầu, D-B6); người khác → 3105', () => {
    expect(
      codeOf(() => assertStaffCanEdit(doctorCaller(), state('in_progress', DOCTOR_ID))),
    ).toBeNull();
    expect(
      codeOf(() => assertStaffCanEdit(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID))),
    ).toBe('3105');
    expect(codeOf(() => assertStaffCanEdit(nurseCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '3105',
    );
    expect(codeOf(() => assertStaffCanEdit(adminCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '3105',
    );
  });

  it('completed → 4003, cancelled → 4009, kể cả với bác sĩ phụ trách (ô trạng thái trước người làm)', () => {
    expect(codeOf(() => assertStaffCanEdit(doctorCaller(), state('completed', DOCTOR_ID)))).toBe(
      '4003',
    );
    expect(codeOf(() => assertStaffCanEdit(doctorCaller(), state('cancelled', DOCTOR_ID)))).toBe(
      '4009',
    );
  });
});

describe('allowedActions (spec B, mục 6.4, 7.5)', () => {
  it.each<[string, Caller, RecordState, MedicalRecordAction[]]>([
    [
      'bác sĩ đã phân công, hồ sơ chờ tiếp nhận',
      doctorCaller(),
      state('pending'),
      ['edit', 'accept', 'cancel'],
    ],
    [
      'bác sĩ chưa phân công (không có nhanvien, MT-106): không tiếp nhận',
      doctorCaller({ hasStaffRow: false }),
      state('pending'),
      ['edit', 'cancel'],
    ],
    [
      'bác sĩ bị thu hồi examine_medical_records: không tiếp nhận',
      doctorCaller({ permissions: only('view_medical_records', 'manage_medical_records') }),
      state('pending'),
      ['edit', 'cancel'],
    ],
    [
      'bác sĩ, hồ sơ nháp: tiếp nhận là 4004 (MT-113)',
      doctorCaller(),
      state('draft'),
      ['edit', 'cancel'],
    ],
    [
      'bác sĩ phụ trách, đang khám',
      doctorCaller(),
      state('in_progress', DOCTOR_ID),
      ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
    ],
    [
      'bác sĩ phụ trách nhưng mất dòng nhanvien: sửa phiên được, không thêm phiên',
      doctorCaller({ hasStaffRow: false }),
      state('in_progress', DOCTOR_ID),
      ['edit', 'edit_visits', 'complete', 'cancel'],
    ],
    ['bác sĩ khác, đang khám (3105)', doctorCaller(), state('in_progress', OTHER_DOCTOR_ID), []],
    ['bác sĩ phụ trách, hoàn tất (4003)', doctorCaller(), state('completed', DOCTOR_ID), []],
    ['bác sĩ phụ trách, đã huỷ (4009)', doctorCaller(), state('cancelled', DOCTOR_ID), []],
    [
      'điều dưỡng, chờ tiếp nhận (Lễ tân, MT-128)',
      nurseCaller(),
      state('pending'),
      ['edit', 'cancel'],
    ],
    ['điều dưỡng, đang khám', nurseCaller(), state('in_progress', DOCTOR_ID), []],
    [
      'admin, chờ tiếp nhận: không tiếp nhận (route chỉ cho bac_si, 3103)',
      adminCaller(),
      state('pending'),
      ['edit', 'cancel', 'delete'],
    ],
    ['admin, đang khám (3105)', adminCaller(), state('in_progress', DOCTOR_ID), ['delete']],
    ['admin, hoàn tất', adminCaller(), state('completed', DOCTOR_ID), ['delete']],
    [
      'vai trò tạo thêm chỉ có view_medical_records',
      nurseCaller({ roleName: 'le_tan', permissions: only('view_medical_records') }),
      state('pending'),
      [],
    ],
    [
      'bệnh nhân, hồ sơ của mình đang chờ (B6 thêm edit, cancel)',
      patientCaller(),
      state('pending'),
      [],
    ],
  ])('%s → %j', (_title, caller, record, expected) => {
    expect(allowedActions(caller, record)).toEqual(expected);
  });
});
