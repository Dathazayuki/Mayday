import { authStorage } from './auth-storage';

const session = {
  token: 'jwt-token',
  user: { user_id: '1', full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: '2' },
};

describe('authStorage', () => {
  it('trả null khi chưa đăng nhập', () => {
    expect(authStorage.load()).toBeNull();
    expect(authStorage.getToken()).toBeNull();
  });

  it('lưu rồi đọc lại phiên đăng nhập', () => {
    authStorage.save(session);
    expect(authStorage.load()).toEqual(session);
    expect(authStorage.getToken()).toBe('jwt-token');
  });

  it('xoá phiên khi đăng xuất', () => {
    authStorage.save(session);
    authStorage.clear();
    expect(authStorage.load()).toBeNull();
  });

  it('bỏ qua dữ liệu người dùng hỏng', () => {
    localStorage.setItem('drmayday.token', 'jwt-token');
    localStorage.setItem('drmayday.user', '{hong');
    expect(authStorage.load()).toBeNull();
  });
});
