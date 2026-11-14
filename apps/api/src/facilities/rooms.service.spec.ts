import type { FacilitiesRepository } from './facilities.repository.js';
import { roomRecord } from './facility-record.fixture.js';
import { RoomsService } from './rooms.service.js';

const NOT_FOUND = { code: '2003', httpStatus: 404 };
const CONFLICT = { code: '2003', httpStatus: 409 };

function setup() {
  const repo = {
    listRooms: vi.fn<FacilitiesRepository['listRooms']>().mockResolvedValue([roomRecord()]),
    getRoom: vi.fn<FacilitiesRepository['getRoom']>().mockResolvedValue(roomRecord()),
    createRoom: vi.fn<FacilitiesRepository['createRoom']>().mockResolvedValue(roomRecord()),
    updateRoom: vi.fn<FacilitiesRepository['updateRoom']>().mockResolvedValue(roomRecord()),
    deleteRoom: vi.fn<FacilitiesRepository['deleteRoom']>().mockResolvedValue(undefined),
    findDepartment: vi
      .fn<FacilitiesRepository['findDepartment']>()
      .mockResolvedValue({ id: 21, branch_id: 10 }),
    countStaffs: vi.fn<FacilitiesRepository['countStaffs']>().mockResolvedValue(0),
  };
  return { repo, service: new RoomsService(repo as unknown as FacilitiesRepository) };
}

describe('RoomsService', () => {
  describe('list / get', () => {
    it('list: id và department_id kiểu string; không lọc → undefined', async () => {
      const { service, repo } = setup();
      await expect(service.list({})).resolves.toEqual([
        {
          id: '30',
          name: 'Phòng 101',
          department_id: '20',
          description: null,
          created_at: '2026-11-15T01:02:03.000Z',
        },
      ]);
      expect(repo.listRooms).toHaveBeenCalledWith(undefined);
    });

    it('list: lọc theo department_id', async () => {
      const { service, repo } = setup();
      await service.list({ department_id: 20 });
      expect(repo.listRooms).toHaveBeenCalledWith(20);
    });

    it('get: id kiểu int, department_id null khi khoa đã bị xoá', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(roomRecord({ department_id: null }));
      await expect(service.get(30)).resolves.toMatchObject({ id: 30, department_id: null });
    });

    it('get: không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(null);
      await expect(service.get(99)).rejects.toMatchObject(NOT_FOUND);
    });
  });

  describe('create', () => {
    it('department_id không tồn tại → 2003 kèm field, không ghi', async () => {
      const { service, repo } = setup();
      repo.findDepartment.mockResolvedValue(null);
      await expect(service.create({ name: 'P', department_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'department_id' },
        httpStatus: undefined,
      });
      expect(repo.createRoom).not.toHaveBeenCalled();
    });

    it('trả object với id và department_id kiểu string (MT-34)', async () => {
      const { service, repo } = setup();
      await expect(service.create({ name: 'Phòng 101', department_id: 20 })).resolves.toEqual({
        id: '30',
        name: 'Phòng 101',
        department_id: '20',
        description: null,
        created_at: '2026-11-15T01:02:03.000Z',
      });
      expect(repo.createRoom).toHaveBeenCalledWith({ name: 'Phòng 101', department_id: 20 });
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

    it('đổi sang khoa không tồn tại → 2003 kèm field', async () => {
      const { service, repo } = setup();
      repo.findDepartment.mockResolvedValue(null);
      await expect(service.update(30, { department_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'department_id' },
      });
      expect(repo.updateRoom).not.toHaveBeenCalled();
    });

    it('đổi khoa khi phòng còn nhân viên → 2003, không ghi', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(2);
      await expect(service.update(30, { department_id: 21 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'department_id' },
      });
      expect(repo.countStaffs).toHaveBeenCalledWith({ roomId: 30 });
      expect(repo.updateRoom).not.toHaveBeenCalled();
    });

    it('đổi khoa khi phòng không còn nhân viên → ghi', async () => {
      const { service, repo } = setup();
      await service.update(30, { department_id: 21 });
      expect(repo.updateRoom).toHaveBeenCalledWith(30, { department_id: 21 });
    });

    it('department_id không đổi → không tra khoa và nhân viên', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(2);
      await service.update(30, { name: 'Tên mới', department_id: 20 });
      expect(repo.findDepartment).not.toHaveBeenCalled();
      expect(repo.countStaffs).not.toHaveBeenCalled();
      expect(repo.updateRoom).toHaveBeenCalledWith(30, { name: 'Tên mới', department_id: 20 });
    });

    it('phòng chưa thuộc khoa (department_id NULL) gán khoa mới → ghi', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(roomRecord({ department_id: null }));
      await service.update(30, { department_id: 21 });
      expect(repo.updateRoom).toHaveBeenCalledWith(30, { department_id: 21 });
    });
  });

  describe('remove', () => {
    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toMatchObject(NOT_FOUND);
      expect(repo.deleteRoom).not.toHaveBeenCalled();
    });

    it('còn nhân viên → 2003 / 409, không xoá', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(1);
      await expect(service.remove(30)).rejects.toMatchObject(CONFLICT);
      expect(repo.countStaffs).toHaveBeenCalledWith({ roomId: 30 });
      expect(repo.deleteRoom).not.toHaveBeenCalled();
    });

    it('không còn nhân viên → xoá', async () => {
      const { service, repo } = setup();
      await service.remove(30);
      expect(repo.deleteRoom).toHaveBeenCalledWith(30);
    });
  });
});
