import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';
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
import { inProgressRecord, medicalRecord } from './medical-record.fixture.js';
import {
  DOCTOR_ROLE,
  allowedActions,
  assertAssignedDoctor,
  assertCanAccept,
  assertCanAddVisit,
  assertCanCancel,
  assertCanEdit,
  assertOwnRecord,
  assertPatientBody,
  recordState,
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

describe('assertCanEdit, nhánh nhân viên (bảng 6.1, hàng "Sửa hồ sơ")', () => {
  it.each(['draft', 'pending'] as const)(
    '%s: nhân viên có quyền sửa được (MT-113: draft cũng sửa được)',
    (status) => {
      expect(codeOf(() => assertCanEdit(nurseCaller(), state(status)))).toBeNull();
    },
  );

  it('đang khám: chỉ bác sĩ phụ trách (bác sĩ của phiên đầu, D-B6); người khác → 3105', () => {
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('in_progress', DOCTOR_ID)))).toBeNull();
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID)))).toBe(
      '3105',
    );
    expect(codeOf(() => assertCanEdit(nurseCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '3105',
    );
    expect(codeOf(() => assertCanEdit(adminCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '3105',
    );
  });

  it('completed → 4003, cancelled → 4009, kể cả với bác sĩ phụ trách (ô trạng thái trước người làm)', () => {
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('completed', DOCTOR_ID)))).toBe('4003');
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('cancelled', DOCTOR_ID)))).toBe('4009');
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
      'tên vai trò null (vai trò bị đổi tên) dù đủ quyền: không tiếp nhận, không xoá',
      doctorCaller({ roleName: null }),
      state('pending'),
      ['edit', 'cancel'],
    ],
    [
      'tên vai trò null, bác sĩ phụ trách đang khám: chỉ sửa hồ sơ, không phiên, không chốt, không huỷ',
      doctorCaller({ roleName: null }),
      state('in_progress', DOCTOR_ID),
      ['edit'],
    ],
    [
      'bệnh nhân, hồ sơ của mình chờ tiếp nhận: sửa phần tự khai, tự huỷ (D-B30, D-B32)',
      patientCaller(),
      state('pending'),
      ['edit', 'cancel'],
    ],
    [
      'bệnh nhân, hồ sơ nháp của mình (MT-113)',
      patientCaller(),
      state('draft'),
      ['edit', 'cancel'],
    ],
    [
      'bệnh nhân, hồ sơ của mình đã tiếp nhận: chỉ đọc',
      patientCaller(),
      state('in_progress', DOCTOR_ID),
      [],
    ],
    ['bệnh nhân, hồ sơ của mình hoàn tất', patientCaller(), state('completed', DOCTOR_ID), []],
    ['bệnh nhân, hồ sơ của mình đã huỷ', patientCaller(), state('cancelled'), []],
    [
      'bệnh nhân, hồ sơ chờ tiếp nhận của người khác',
      patientCaller(),
      state('pending', null, OTHER_PATIENT_ID),
      [],
    ],
  ])('%s → %j', (_title, caller, record, expected) => {
    expect(allowedActions(caller, record)).toEqual(expected);
  });
});

describe('assertCanAccept (bảng 6.1, hàng "Tiếp nhận"; mục 6.3)', () => {
  it('chờ tiếp nhận, bác sĩ đã phân công → qua', () => {
    expect(codeOf(() => assertCanAccept(doctorCaller(), state('pending')))).toBeNull();
  });

  it.each(['draft', 'completed', 'cancelled'] as const)(
    '%s → 4004 (MT-113: nháp không tiếp nhận được)',
    (status) => {
      expect(codeOf(() => assertCanAccept(doctorCaller(), state(status, DOCTOR_ID)))).toBe('4004');
    },
  );

  it('đang khám: bác sĩ phụ trách là người khác → 4005 (test case medrec07); là chính người gọi → 4004', () => {
    expect(
      codeOf(() => assertCanAccept(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID))),
    ).toBe('4005');
    expect(codeOf(() => assertCanAccept(doctorCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '4004',
    );
  });

  it('chưa có dòng nhanvien → 3101 (MT-106), xét sau ô trạng thái', () => {
    const unassigned = doctorCaller({ hasStaffRow: false });
    expect(codeOf(() => assertCanAccept(unassigned, state('pending')))).toBe('3101');
    expect(codeOf(() => assertCanAccept(unassigned, state('in_progress', OTHER_DOCTOR_ID)))).toBe(
      '4005',
    );
  });
});

describe('assertAssignedDoctor, assertCanAddVisit (thêm/sửa phiên, hoàn tất, huỷ bằng PUT)', () => {
  it.each(['visit', 'complete', 'cancel_in_progress'] as const)(
    '%s: đang khám, bác sĩ phụ trách → qua; bác sĩ khác, điều dưỡng → 3105; nháp, chờ tiếp nhận, đã huỷ → 4009; hoàn tất → 4003',
    (transition) => {
      const run = (caller: Caller, record: RecordState) =>
        codeOf(() => assertAssignedDoctor(caller, record, transition));
      expect(run(doctorCaller(), state('in_progress', DOCTOR_ID))).toBeNull();
      expect(run(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID))).toBe('3105');
      expect(run(nurseCaller(), state('in_progress', DOCTOR_ID))).toBe('3105');
      expect(run(doctorCaller(), state('draft'))).toBe('4009');
      expect(run(doctorCaller(), state('pending'))).toBe('4009');
      expect(run(doctorCaller(), state('cancelled', DOCTOR_ID))).toBe('4009');
      expect(run(doctorCaller(), state('completed', DOCTOR_ID))).toBe('4003');
    },
  );

  it('assertCanAddVisit: thêm điều kiện có dòng nhanvien (3101), xét sau bác sĩ phụ trách (3105)', () => {
    expect(
      codeOf(() => assertCanAddVisit(doctorCaller(), state('in_progress', DOCTOR_ID))),
    ).toBeNull();
    expect(
      codeOf(() =>
        assertCanAddVisit(doctorCaller({ hasStaffRow: false }), state('in_progress', DOCTOR_ID)),
      ),
    ).toBe('3101');
    expect(
      codeOf(() =>
        assertCanAddVisit(
          doctorCaller({ hasStaffRow: false }),
          state('in_progress', OTHER_DOCTOR_ID),
        ),
      ),
    ).toBe('3105');
    expect(codeOf(() => assertCanAddVisit(doctorCaller(), state('completed', DOCTOR_ID)))).toBe(
      '4003',
    );
  });
});

describe('assertCanCancel, nhánh nhân viên (PATCH /:id/status; bảng 6.1, hàng "Huỷ")', () => {
  it.each(['draft', 'pending'] as const)('%s: nhân viên có quyền huỷ được (MT-113)', (status) => {
    expect(codeOf(() => assertCanCancel(nurseCaller(), state(status)))).toBeNull();
  });

  it('đang khám: chỉ bác sĩ phụ trách; bác sĩ khác, điều dưỡng, admin → 3105', () => {
    expect(
      codeOf(() => assertCanCancel(doctorCaller(), state('in_progress', DOCTOR_ID))),
    ).toBeNull();
    for (const caller of [
      doctorCaller({ userId: OTHER_DOCTOR_ID }),
      nurseCaller(),
      adminCaller(),
    ]) {
      expect(codeOf(() => assertCanCancel(caller, state('in_progress', DOCTOR_ID)))).toBe('3105');
    }
  });

  it('hoàn tất → 4003; đã huỷ → 4009 (kể cả với bác sĩ phụ trách)', () => {
    expect(codeOf(() => assertCanCancel(doctorCaller(), state('completed', DOCTOR_ID)))).toBe(
      '4003',
    );
    expect(codeOf(() => assertCanCancel(doctorCaller(), state('cancelled', DOCTOR_ID)))).toBe(
      '4009',
    );
  });
});

describe('nhánh bệnh nhân: sửa phần tự khai, tự huỷ (D-B30, D-B32; bảng 6.1, mục 6.3)', () => {
  const checks = [
    ['assertCanEdit', assertCanEdit],
    ['assertCanCancel', assertCanCancel],
  ] as const;

  it.each(checks)(
    '%s: hồ sơ của mình ở nháp, chờ tiếp nhận → qua; đang khám → 3101 (chỉ đọc); hoàn tất → 4003; đã huỷ → 4009',
    (_name, check) => {
      const run = (record: RecordState) => codeOf(() => check(patientCaller(), record));
      expect(run(state('draft'))).toBeNull();
      expect(run(state('pending'))).toBeNull();
      expect(run(state('in_progress', DOCTOR_ID))).toBe('3101');
      expect(run(state('completed', DOCTOR_ID))).toBe('4003');
      expect(run(state('cancelled'))).toBe('4009');
    },
  );

  it.each(checks)(
    '%s: hồ sơ của người khác → 3106 ở mọi trạng thái, xét trước ô trạng thái (mục 6.3)',
    (_name, check) => {
      for (const status of MEDICAL_RECORD_STATUSES) {
        expect(
          codeOf(() => check(patientCaller(), state(status, DOCTOR_ID, OTHER_PATIENT_ID))),
        ).toBe('3106');
      }
    },
  );
});

describe('assertPatientBody: bệnh nhân chỉ gửi khối tự khai (D-B30, spec B mục 5.6)', () => {
  it.each<object>([
    {},
    { record_type: 'CAP', self_report: { onset_weeks: 1 } },
    { record_type: 'MAN', patient_id: OTHER_PATIENT_ID },
    { self_report: { referral_diagnosis: null }, first_visit_at: undefined, chronic: undefined },
  ])('%j → qua (khoá có giá trị undefined là không gửi; patient_id bị bỏ qua)', (body) => {
    expect(codeOf(() => assertPatientBody(body))).toBeNull();
  });

  it.each<object>([
    { first_visit_at: null },
    { family_history: 'Co' },
    { self_report: { onset_weeks: 1 }, treated_before_visit: false },
    { acute: {} },
    { chronic: { main_diagnosis: 'CSU' } },
  ])('%j → 3101', (body) => {
    expect(codeOf(() => assertPatientBody(body))).toBe('3101');
  });
});

describe('recordState, DOCTOR_ROLE (dùng chung cho danh sách và Tổng quan)', () => {
  it('recordState: chủ hồ sơ, trạng thái, bác sĩ phụ trách (D-B6) của hồ sơ ở mức tổng quan', () => {
    expect(recordState(inProgressRecord(OTHER_DOCTOR_ID))).toEqual({
      patientId: PATIENT_ID,
      status: 'in_progress',
      assignedDoctorId: OTHER_DOCTOR_ID,
    });
    expect(recordState(medicalRecord())).toEqual({
      patientId: PATIENT_ID,
      status: 'pending',
      assignedDoctorId: null,
    });
  });

  it('DOCTOR_ROLE là vai trò bac_si của các route khám (spec B, mục 7.2)', () => {
    expect(DOCTOR_ROLE).toBe('bac_si');
  });
});
