import type { roles } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RolesRepository } from './roles.repository.js';

const patient = { role_id: 2, name: 'patient' } as roles;

function setup() {
  const findUnique = vi.fn(async ({ where }: { where: { role_id?: number; name?: string } }) =>
    where.role_id === patient.role_id || where.name === patient.name ? patient : null,
  );
  const prisma = { db: { roles: { findUnique } } } as unknown as PrismaService;
  return { repo: new RolesRepository(prisma), findUnique };
}

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
    await expect(repo.findByName('khong-co')).resolves.toBeNull();
    await expect(repo.findByName('khong-co')).resolves.toBeNull();
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
