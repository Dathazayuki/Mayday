import { FIELD_LIMITS } from './field-limits.js';

describe('FIELD_LIMITS (spec A, mục 5.2, 5.6)', () => {
  it('độ dài tối đa theo cột của CSDL thật; cột TEXT giữ giới hạn API', () => {
    expect(FIELD_LIMITS).toEqual({
      full_name: 150,
      role_name: 50,
      role_display_name: 100,
      permission_name: 100,
      branch_name: 150,
      room_name: 150,
      ethnic: 50,
      hamlet_address: 255,
      commune_address: 100,
      city_address: 100,
      health_insurance_number: 30,
      next_of_kin_name: 100,
    });
  });
});
