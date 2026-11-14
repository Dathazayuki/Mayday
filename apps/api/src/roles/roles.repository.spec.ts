import { Prisma, type roles } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RolesRepository } from './roles.repository.js';

const patient = { role_id: 2, name: 'patient' } as roles;
const intern = { role_id: 10, name: 'intern', description: null, parent_role_id: 6 } as roles;

function setup() {
  const findUnique = vi.fn(async ({ where }: { where: { role_id?: number; name?: string } }) =>
    where.role_id === patient.role_id || where.name === patient.name ? patient : null,
  );
  const create = vi.fn().mockResolvedValue(intern);
  const prisma = { db: { roles: { findUnique, create } } } as unknown as PrismaService;
  return { repo: new RolesRepository(prisma), findUnique, create };
}

/** Lỗi thật Prisma 7 + adapter mariadb ném khi trùng `roles.name`. */
const duplicateName = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
  code: 'P2002',
  clientVersion: Prisma.prismaVersion.client,
  meta: {
    driverAdapterError: { cause: { constraint: { index: 'roles_name_key' } } },
  },
});

describe('RolesRepository (cache tên ↔ id)', () => {
  it('tra theo tên rồi theo id chỉ truy vấn CSDL một lần', async () => {
    const { repo, findUnique } = setup();
    await expect(repo.findByName('patient')).resolves.toBe(patient);
    await expect(repo.findByName('patient')).resolves.toBe(patient);
    await expect(repo.findById(2)).resolves.toBe(patient);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('không nhớ vai trò không tồn tại', async () => {
    const { repo, findUnique } = setup();
    await expect(repo.findByName('doctor')).resolves.toBeNull();
    await expect(repo.findByName('doctor')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('clearCache → truy vấn lại CSDL', async () => {
    const { repo, findUnique } = setup();
    await repo.findById(2);
    repo.clearCache();
    await repo.findById(2);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('RolesRepository.create', () => {
  const newRole = { name: 'intern', description: null, parentRoleId: 6 };

  it('ghi đúng cột, xoá cache (mọi thay đổi bảng roles)', async () => {
    const { repo, findUnique, create } = setup();
    await repo.findById(2);
    await expect(repo.create(newRole)).resolves.toBe(intern);
    expect(create).toHaveBeenCalledWith({
      data: { name: 'intern', description: null, parent_role_id: 6 },
    });
    await repo.findById(2);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('trùng tên → 2003 (409)', async () => {
    const { repo, create } = setup();
    create.mockRejectedValue(duplicateName);
    await expect(repo.create(newRole)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
  });
});
