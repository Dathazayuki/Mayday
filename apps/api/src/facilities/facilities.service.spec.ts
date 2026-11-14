import type { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import type { Placement } from './placement.js';

// Cơ sở vật chất giả: chi nhánh 10 có khoa 20 (phòng 30); chi nhánh 11 có khoa 21 (phòng 31);
// phòng 32 chưa thuộc khoa nào.
const BRANCH_ID = 10;
const DEPARTMENT_ID = 20;
const ROOM_ID = 30;
const OTHER_BRANCH_DEPARTMENT_ID = 21;
const OTHER_DEPARTMENT_ROOM_ID = 31;
const UNASSIGNED_ROOM_ID = 32;
const BRANCHES = [{ id: BRANCH_ID }, { id: 11 }];
const DEPARTMENTS = [
  { id: DEPARTMENT_ID, branch_id: BRANCH_ID },
  { id: OTHER_BRANCH_DEPARTMENT_ID, branch_id: 11 },
];
const ROOMS = [
  { id: ROOM_ID, department_id: DEPARTMENT_ID },
  { id: OTHER_DEPARTMENT_ROOM_ID, department_id: OTHER_BRANCH_DEPARTMENT_ID },
  { id: UNASSIGNED_ROOM_ID, department_id: null },
];

function findIn<T extends { id: number }>(rows: T[]) {
  return async (id: number) => rows.find((row) => row.id === id) ?? null;
}

function setup() {
  const repo = {
    findBranch: vi.fn<FacilitiesRepository['findBranch']>(findIn(BRANCHES)),
    findDepartment: vi.fn<FacilitiesRepository['findDepartment']>(findIn(DEPARTMENTS)),
    findRoom: vi.fn<FacilitiesRepository['findRoom']>(findIn(ROOMS)),
  };
  return { repo, service: new FacilitiesService(repo as unknown as FacilitiesRepository) };
}

describe('FacilitiesService.assertPlacement', () => {
  const placement: Placement = {
    branchId: BRANCH_ID,
    departmentId: DEPARTMENT_ID,
    roomId: ROOM_ID,
  };

  it.each<[string, Partial<Placement>, string]>([
    ['chi nhánh không tồn tại', { branchId: 99 }, 'branch_id'],
    ['khoa không tồn tại', { departmentId: 99 }, 'department_id'],
    ['khoa thuộc chi nhánh khác', { departmentId: OTHER_BRANCH_DEPARTMENT_ID }, 'department_id'],
    ['phòng không tồn tại', { roomId: 99 }, 'room_id'],
    ['phòng thuộc khoa khác', { roomId: OTHER_DEPARTMENT_ROOM_ID }, 'room_id'],
    ['phòng chưa thuộc khoa nào', { roomId: UNASSIGNED_ROOM_ID }, 'room_id'],
  ])('%s → 2003 (data.field = %s)', async (_name, override, field) => {
    const { service } = setup();
    await expect(service.assertPlacement({ ...placement, ...override })).rejects.toMatchObject({
      code: '2003',
      data: { field },
    });
  });

  it('chi nhánh, khoa, phòng khớp nhau → qua', async () => {
    const { service } = setup();
    await expect(service.assertPlacement(placement)).resolves.toBeUndefined();
  });

  it('không có phòng (roomId null) → qua, không tra phòng', async () => {
    const { service, repo } = setup();
    await expect(service.assertPlacement({ ...placement, roomId: null })).resolves.toBeUndefined();
    expect(repo.findRoom).not.toHaveBeenCalled();
  });
});
