import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hash dạng bcrypt cost 10 ($2…$10$), verify đúng mật khẩu', async () => {
    const hash = await passwords.hash('matkhau123');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(passwords.verify('matkhau123', hash)).resolves.toBe(true);
  });

  it('verify sai mật khẩu → false', async () => {
    const hash = await passwords.hash('matkhau123');
    await expect(passwords.verify('matkhau124', hash)).resolves.toBe(false);
  });
});
