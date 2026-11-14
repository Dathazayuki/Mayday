import { DepartmentsService } from './departments.service.js';
import type { FacilitiesRepository } from './facilities.repository.js';
import { departmentRecord } from './facility-record.fixture.js';

const NOT_FOUND = { code: '2003', httpStatus: 404 };
const CONFLICT = { code: '2003', httpStatus: 409 };

function setup() {
  const repo = {
    listDepartments: vi
      .fn<FacilitiesRepository['listDepartments']>()
      .mockResolvedValue([departmentRecord()]),
    getDepartment: vi
      .fn<FacilitiesRepository['getDepartment']>()
      .mockResolvedValue(departmentRecord()),
    createDepartment: vi
      .fn<FacilitiesRepository['createDepartment']>()
      .mockResolvedValue(departmentRecord()),
    updateDepartment: vi
      .fn<FacilitiesRepository['updateDepartment']>()
      .mockResolvedValue(departmentRecord()),
    deleteDepartment: vi
      .fn<FacilitiesRepository['deleteDepartment']>()
      .mockResolvedValue(undefined),
    findBranch: vi.fn<FacilitiesRepository['findBranch']>().mockResolvedValue({ id: 11 }),
    countStaffs: vi.fn<FacilitiesRepository['countStaffs']>().mockResolvedValue(0),
  };
  return { repo, service: new DepartmentsService(repo as unknown as FacilitiesRepository) };
}

describe('DepartmentsService', () => {
  describe('list / get', () => {
    it('list: id và branch_id kiểu string; không lọc → undefined', async () => {
      const { service, repo } = setup();
      await expect(service.list({})).resolves.toEqual([
        { id: '20', name: 'Khoa Nội', branch_id: '10', description: 'Nội tổng hợp' },
      ]);
      expect(repo.listDepartments).toHaveBeenCalledWith(undefined);
    });

    it('list: lọc theo branch_id', async () => {
      const { service, repo } = setup();
      await service.list({ branch_id: 10 });
      expect(repo.listDepartments).toHaveBeenCalledWith(10);
    });

    it('get: id và branch_id kiểu int', async () => {
      const { service } = setup();
      await expect(service.get(20)).resolves.toMatchObject({ id: 20, branch_id: 10 });
    });

    it('get: không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getDepartment.mockResolvedValue(null);
      await expect(service.get(99)).rejects.toMatchObject(NOT_FOUND);
    });
  });

  describe('create', () => {
    it('branch_id không tồn tại → 2003 kèm field, không ghi', async () => {
      const { service, repo } = setup();
      repo.findBranch.mockResolvedValue(null);
      await expect(service.create({ name: 'Khoa', branch_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
        httpStatus: undefined,
      });
      expect(repo.createDepartment).not.toHaveBeenCalled();
    });

    it('trả object với id và branch_id kiểu string (MT-34)', async () => {
      const { service, repo } = setup();
      await expect(service.create({ name: 'Khoa Nội', branch_id: 10 })).resolves.toEqual({
        id: '20',
        name: 'Khoa Nội',
        branch_id: '10',
        description: 'Nội tổng hợp',
        created_at: '2026-11-15T01:02:03.000Z',
      });
      expect(repo.createDepartment).toHaveBeenCalledWith({ name: 'Khoa Nội', branch_id: 10 });
    });
  });

  describe('update', () => {
    it('body không có trường nào → 2001', async () => {
      const { service, repo } = setup();
      await expect(service.update(20, {})).rejects.toMatchObject({ code: '2001' });
      expect(repo.updateDepartment).not.toHaveBeenCalled();
    });

    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getDepartment.mockResolvedValue(null);
      await expect(service.update(99, { name: 'X' })).rejects.toMatchObject(NOT_FOUND);
    });

    it('đổi sang chi nhánh không tồn tại → 2003 kèm field', async () => {
      const { service, repo } = setup();
      repo.findBranch.mockResolvedValue(null);
      await expect(service.update(20, { branch_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
      });
      expect(repo.updateDepartment).not.toHaveBeenCalled();
    });

    it('đổi chi nhánh khi khoa còn nhân viên → 2003, không ghi', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(3);
      await expect(service.update(20, { branch_id: 11 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
      });
      expect(repo.countStaffs).toHaveBeenCalledWith({ departmentId: 20 });
      expect(repo.updateDepartment).not.toHaveBeenCalled();
    });

    it('đổi chi nhánh khi khoa không còn nhân viên → ghi', async () => {
      const { service, repo } = setup();
      await service.update(20, { branch_id: 11 });
      expect(repo.updateDepartment).toHaveBeenCalledWith(20, { branch_id: 11 });
    });

    it('branch_id không đổi → không tra chi nhánh và nhân viên', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(3);
      await service.update(20, { name: 'Tên mới', branch_id: 10 });
      expect(repo.findBranch).not.toHaveBeenCalled();
      expect(repo.countStaffs).not.toHaveBeenCalled();
      expect(repo.updateDepartment).toHaveBeenCalledWith(20, { name: 'Tên mới', branch_id: 10 });
    });

    it('xoá mô tả bằng null; trả chi tiết (id int)', async () => {
      const { service, repo } = setup();
      repo.updateDepartment.mockResolvedValue(departmentRecord({ description: null }));
      await expect(service.update(20, { description: null })).resolves.toMatchObject({
        id: 20,
        description: null,
      });
    });
  });

  describe('remove', () => {
    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getDepartment.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toMatchObject(NOT_FOUND);
      expect(repo.deleteDepartment).not.toHaveBeenCalled();
    });

    it('còn nhân viên → 2003 / 409, không xoá', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(1);
      await expect(service.remove(20)).rejects.toMatchObject(CONFLICT);
      expect(repo.countStaffs).toHaveBeenCalledWith({ departmentId: 20 });
      expect(repo.deleteDepartment).not.toHaveBeenCalled();
    });

    it('không còn nhân viên → xoá (phòng chuyển department_id = NULL nhờ FK)', async () => {
      const { service, repo } = setup();
      await service.remove(20);
      expect(repo.deleteDepartment).toHaveBeenCalledWith(20);
    });
  });
});
