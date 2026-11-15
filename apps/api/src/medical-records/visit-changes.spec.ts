import type { AppException } from '../common/app.exception.js';
import type { UpdateVisitDto } from './dto/visit.dto.js';
import { planVisitChanges, requireVisitChanges } from './visit-changes.js';
import { EMPTY_ACUTE_VISIT, EMPTY_CHRONIC_VISIT, visitRecord } from './visit.fixture.js';

const dto = (body: object) => body as UpdateVisitDto;

/** Mã và data của AppException mà `run` ném, hoặc null nếu không ném. */
function codeOf(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    const { code, data } = error as AppException;
    return { code, data };
  }
}

/** Phiên MAN đang có cờ phù vị trí khác bật kèm ghi rõ, hẹn 2026-12-13. */
const withOtherSite = visitRecord({
  nextAppointmentDate: '2026-12-13',
  chronic: {
    ...EMPTY_CHRONIC_VISIT,
    angioedema_other_site: true,
    angioedema_other_site_detail: 'Mu bàn chân',
  },
});

describe('requireVisitChanges (PATCH /visits/:id)', () => {
  it('body rỗng hoặc chỉ có khối rỗng → 2001; một trường (kể cả null) → qua', () => {
    expect(codeOf(() => requireVisitChanges(dto({})))).toEqual({ code: '2001', data: undefined });
    expect(codeOf(() => requireVisitChanges(dto({ chronic: {} })))).toMatchObject({ code: '2001' });
    expect(codeOf(() => requireVisitChanges(dto({ room_id: null })))).toBeNull();
    expect(codeOf(() => requireVisitChanges(dto({ acute: { has_wheals: true } })))).toBeNull();
  });
});

describe('planVisitChanges (sau khi khoá, D-B2)', () => {
  it('chỉ khoá được gửi; null = xoá; lõi và khối theo loại hồ sơ', () => {
    expect(
      planVisitChanges(
        visitRecord(),
        dto({
          visit_date: '2026-11-16',
          room_id: null,
          instructions: 'Uống thuốc đều',
          fever: true,
          chronic: { aas7_score: 12 },
        }),
      ),
    ).toEqual({
      date: '2026-11-16',
      roomId: null,
      instructions: 'Uống thuốc đều',
      core: { fever: true },
      acute: {},
      chronic: { aas7_score: 12 },
    });
    expect(
      planVisitChanges(
        visitRecord({ type: 'CAP', acute: EMPTY_ACUTE_VISIT, chronic: null }),
        dto({ acute: { vomiting_count: 2 } }),
      ),
    ).toEqual({ core: {}, acute: { vomiting_count: 2 }, chronic: {} });
  });

  it('khối lệch loại → 2003 kèm field: acute cho phiên MAN, chronic cho phiên CAP', () => {
    expect(
      codeOf(() => planVisitChanges(visitRecord(), dto({ acute: { has_wheals: true } }))),
    ).toEqual({ code: '2003', data: { field: 'acute' } });
    expect(
      codeOf(() =>
        planVisitChanges(
          visitRecord({ type: 'CAP', acute: EMPTY_ACUTE_VISIT, chronic: null }),
          dto({ chronic: { wheals_now: true } }),
        ),
      ),
    ).toEqual({ code: '2003', data: { field: 'chronic' } });
  });

  it('cặp phù vị trí khác ↔ ghi rõ (D-B14): tắt cờ xoá ghi rõ đang lưu; ghi rõ khi cờ tắt → 2003; bật cờ thiếu ghi rõ → 2001', () => {
    expect(
      planVisitChanges(withOtherSite, dto({ chronic: { angioedema_other_site: false } })).chronic,
    ).toEqual({ angioedema_other_site: false, angioedema_other_site_detail: null });
    expect(
      codeOf(() =>
        planVisitChanges(visitRecord(), dto({ chronic: { angioedema_other_site_detail: 'Tai' } })),
      ),
    ).toEqual({ code: '2003', data: { field: 'chronic.angioedema_other_site_detail' } });
    expect(
      codeOf(() =>
        planVisitChanges(visitRecord(), dto({ chronic: { angioedema_other_site: true } })),
      ),
    ).toEqual({ code: '2001', data: { field: 'chronic.angioedema_other_site_detail' } });
  });

  it('ngày hẹn ≥ ngày khám sau khi gộp (ck_phienkham_ngay_hen, SQL:427): hẹn mới sớm hơn ngày khám đang lưu → 2003; đổi ngày khám sau ngày hẹn đang lưu → 2003; xoá hẹn → qua', () => {
    expect(
      codeOf(() => planVisitChanges(visitRecord(), dto({ next_appointment_date: '2026-11-14' }))),
    ).toEqual({ code: '2003', data: { field: 'next_appointment_date' } });
    expect(
      codeOf(() => planVisitChanges(withOtherSite, dto({ visit_date: '2026-12-14' }))),
    ).toEqual({ code: '2003', data: { field: 'next_appointment_date' } });
    expect(
      planVisitChanges(
        withOtherSite,
        dto({ visit_date: '2026-12-14', next_appointment_date: null }),
      ),
    ).toMatchObject({ date: '2026-12-14', nextAppointmentDate: null });
    expect(
      planVisitChanges(visitRecord(), dto({ next_appointment_date: '2026-11-15' })),
    ).toMatchObject({ nextAppointmentDate: '2026-11-15' });
  });
});
