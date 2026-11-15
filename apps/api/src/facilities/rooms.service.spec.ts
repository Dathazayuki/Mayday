import type { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { branchRecord, roomRecord } from './facility-record.fixture.js';
import { RoomsService } from './rooms.service.js';

const NOT_FOUND = { code: '2003', httpStatus: 404 };

function setup() {
  const repo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === 10 || id === 11 ? branchRecord({ id }) : null,
    ),
    listRooms: vi.fn<FacilitiesRepository['listRooms']>().mockResolvedValue([roomRecord()]),
    getRoom: vi.fn<FacilitiesRepository['getRoom']>().mockResolvedValue(roomRecord()),
    createRoom: vi.fn<FacilitiesRepository['createRoom']>(async ({ name, branchId }) =>
      roomRecord({ name, branchId }),
    ),
    updateRoom: vi.fn<FacilitiesRepository['updateRoom']>(async (id, { name, branchId }) =>
      roomRecord({ id, name: name ?? 'Phòng 101', branchId: branchId ?? 10 }),
    ),
    deleteRoom: vi.fn<FacilitiesRepository['deleteRoom']>().mockResolvedValue(undefined),
  };
  const facilities = repo as unknown as FacilitiesRepository;
  return { repo, service: new RoomsService(facilities, new FacilitiesService(facilities)) };
}

describe('RoomsService (spec A, mục 5.4)', () => {
  it('list: lọc theo chi nhánh, id kiểu string', async () => {
    const { service, repo } = setup();
    await expect(service.list({ branch_id: 10 })).resolves.toEqual([
      { id: '30', name: 'Phòng 101', branch_id: '10' },
    ]);
    expect(repo.listRooms).toHaveBeenCalledWith(10);
  });

  it('get: id kiểu int; không tồn tại → 2003 / 404', async () => {
    const { service, repo } = setup();
    await expect(service.get(30)).resolves.toEqual({ id: 30, name: 'Phòng 101', branch_id: 10 });
    repo.getRoom.mockResolvedValue(null);
    await expect(service.get(99)).rejects.toMatchObject(NOT_FOUND);
  });

  describe('create', () => {
    it('chi nhánh không tồn tại → 2003 kèm field branch_id, không ghi', async () => {
      const { service, repo } = setup();
      await expect(service.create({ name: 'P', branch_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
      });
      expect(repo.createRoom).not.toHaveBeenCalled();
    });

    it('trả {id, name, branch_id} kiểu string (MT-34, MT-108)', async () => {
      const { service, repo } = setup();
      await expect(service.create({ name: 'Phòng 102', branch_id: 11 })).resolves.toStrictEqual({
        id: '30',
        name: 'Phòng 102',
        branch_id: '11',
      });
      expect(repo.createRoom).toHaveBeenCalledWith({ name: 'Phòng 102', branchId: 11 });
    });
  });

  describe('update', () => {
    it('body không có trường nào → 2001', async () => {
      const { service, repo } = setup();
      await expect(service.update(30, {})).rejects.toMatchObject({ code: '2001' });
      expect(repo.updateRoom).not.toHaveBeenCalled();
    });

    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(null);
      await expect(service.update(99, { name: 'X' })).rejects.toMatchObject(NOT_FOUND);
    });

    it('chuyển sang chi nhánh khác tự do (nhân viên không gắn với phòng)', async () => {
      const { service, repo } = setup();
      await expect(service.update(30, { branch_id: 11 })).resolves.toEqual({
        id: 30,
        name: 'Phòng 101',
        branch_id: 11,
      });
      expect(repo.updateRoom).toHaveBeenCalledWith(30, { name: undefined, branchId: 11 });
    });

    it('chi nhánh mới không tồn tại → 2003 kèm field branch_id', async () => {
      const { service, repo } = setup();
      await expect(service.update(30, { branch_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
      });
      expect(repo.updateRoom).not.toHaveBeenCalled();
    });

    it('chỉ đổi tên: không tra chi nhánh', async () => {
      const { service, repo } = setup();
      await service.update(30, { name: 'Phòng 103' });
      expect(repo.getBranch).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('không tồn tại → 2003 / 404, không xoá', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toMatchObject(NOT_FOUND);
      expect(repo.deleteRoom).not.toHaveBeenCalled();
    });

    it('xoá trực tiếp; phòng đã dùng ở phiên khám do hàng rào FK của repository chặn (409)', async () => {
      const { service, repo } = setup();
      await service.remove(30);
      expect(repo.deleteRoom).toHaveBeenCalledWith(30);
    });
  });
});
