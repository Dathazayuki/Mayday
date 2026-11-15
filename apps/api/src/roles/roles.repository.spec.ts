import type { vaitro } from '../generated/prisma/client.js';
import { uniqueViolation } from '../prisma/prisma-error.fixture.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RolesRepository } from './roles.repository.js';

const at = new Date('2026-11-15T01:00:00.000Z');
const PATIENT: vaitro = {
  ma_vai_tro: 4n,
  ten_vai_tro: 'benh_nhan',
  ten_hien_thi: 'Bệnh nhân',
  mo_ta_vai_tro: null,
  thoi_diem_tao: at,
  thoi_diem_cap_nhat: at,
};
const INTERN: vaitro = {
  ...PATIENT,
  ma_vai_tro: 5n,
  ten_vai_tro: 'thuc_tap',
  ten_hien_thi: 'Thực tập',
};

function setup() {
  const findUnique = vi.fn(
    async ({ where }: { where: { ma_vai_tro?: bigint; ten_vai_tro?: string } }) =>
      where.ma_vai_tro === 4n || where.ten_vai_tro === 'benh_nhan' ? PATIENT : null,
  );
  const create = vi.fn().mockResolvedValue(INTERN);
  const findMany = vi.fn().mockResolvedValue([PATIENT, INTERN]);
  const prisma = { db: { vaitro: { findUnique, create, findMany } } } as unknown as PrismaService;
  return { repo: new RolesRepository(prisma), findUnique, create, findMany };
}

describe('RolesRepository (cache tên ↔ id)', () => {
  it('tra theo tên rồi theo id chỉ truy vấn CSDL một lần; trả bản ghi miền', async () => {
    const { repo, findUnique } = setup();
    const role = { id: 4, name: 'benh_nhan', displayName: 'Bệnh nhân', description: null };
    await expect(repo.findByName('benh_nhan')).resolves.toEqual(role);
    await expect(repo.findByName('benh_nhan')).resolves.toEqual(role);
    await expect(repo.findById(4)).resolves.toEqual(role);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { ten_vai_tro: 'benh_nhan' } });
  });

  it('không nhớ vai trò không tồn tại', async () => {
    const { repo, findUnique } = setup();
    await expect(repo.findById(99)).resolves.toBeNull();
    await expect(repo.findById(99)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findUnique).toHaveBeenCalledWith({ where: { ma_vai_tro: 99n } });
  });

  it('clearCache → truy vấn lại CSDL', async () => {
    const { repo, findUnique } = setup();
    await repo.findById(4);
    repo.clearCache();
    await repo.findById(4);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('list theo ma_vai_tro tăng dần', async () => {
    const { repo, findMany } = setup();
    await expect(repo.list()).resolves.toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { ma_vai_tro: 'asc' } });
  });
});

describe('RolesRepository.create', () => {
  const newRole = { name: 'thuc_tap', displayName: 'Thực tập', description: null };

  it('ghi đúng cột, xoá cache', async () => {
    const { repo, findUnique, create } = setup();
    await repo.findById(4);
    await expect(repo.create(newRole)).resolves.toMatchObject({ id: 5, name: 'thuc_tap' });
    expect(create).toHaveBeenCalledWith({
      data: { ten_vai_tro: 'thuc_tap', ten_hien_thi: 'Thực tập', mo_ta_vai_tro: null },
    });
    await repo.findById(4);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('trùng uq_vai_tro_ten → 2003 (409)', async () => {
    const { repo, create } = setup();
    create.mockRejectedValue(uniqueViolation('uq_vai_tro_ten'));
    await expect(repo.create(newRole)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
  });
});
