import { JwtService } from '@nestjs/jwt';
import { isRevokedBy, issuedAtFor } from './revocation.js';

const seconds = (iso: string) => Date.parse(iso) / 1000;
/** Mốc thu hồi: taikhoan.thoi_diem_cap_nhat do trigger ghi. */
const MARK = new Date('2026-11-15T08:00:00.400Z');

describe('mốc thu hồi token (spec A, mục 6.2, D8)', () => {
  it('iat * 1000 < mốc → bị thu hồi; iat * 1000 ≥ mốc → còn hiệu lực', () => {
    expect(isRevokedBy(seconds('2026-11-15T08:00:00.000Z'), MARK)).toBe(true);
    expect(isRevokedBy(seconds('2026-11-15T08:00:01.000Z'), MARK)).toBe(false);
    expect(
      isRevokedBy(seconds('2026-11-15T08:00:00.000Z'), new Date('2026-11-15T08:00:00.000Z')),
    ).toBe(false);
  });

  it('đăng nhập trong cùng giây, sau thay đổi: làm tròn lên → token mới không bị thu hồi', () => {
    const iat = issuedAtFor(Date.parse('2026-11-15T08:00:00.700Z'), MARK);
    expect(iat).toBe(seconds('2026-11-15T08:00:01.000Z'));
    expect(isRevokedBy(iat, MARK)).toBe(false);
  });

  it('mốc đã cũ: iat là giây hiện tại (làm tròn xuống)', () => {
    expect(issuedAtFor(Date.parse('2026-11-15T09:30:00.900Z'), MARK)).toBe(
      seconds('2026-11-15T09:30:00.000Z'),
    );
  });

  it('đồng hồ CSDL nhanh hơn API: iat lấy theo mốc nên token mới vẫn dùng được', () => {
    const iat = issuedAtFor(Date.parse('2026-11-15T07:59:58.000Z'), MARK);
    expect(isRevokedBy(iat, MARK)).toBe(false);
  });

  it('jsonwebtoken dùng iat có sẵn trong payload và tính exp từ đó', async () => {
    const jwt = new JwtService({
      secret: 'jwt-secret-cho-unit-test-du-32-ky-tu!!',
      signOptions: { expiresIn: 3600 },
    });
    const token = await jwt.signAsync({ sub: '1', role_id: '1', jti: 'jti-1', iat: 1_900_000_000 });
    expect(jwt.decode(token)).toMatchObject({ iat: 1_900_000_000, exp: 1_900_003_600 });
  });
});
