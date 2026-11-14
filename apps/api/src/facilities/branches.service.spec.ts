import type { FacilitiesRepository } from './facilities.repository.js';
import { BranchesService } from './branches.service.js';
import { branchRecord } from './facility-record.fixture.js';

const NOT_FOUND = { code: '2003', httpStatus: 404 };
const CONFLICT = { code: '2003', httpStatus: 409 };

function setup() {
  const repo = {
    listBranches: vi.fn<FacilitiesRepository['listBranches']>().mockResolvedValue([branchRecord()]),
    getBranch: vi.fn<FacilitiesRepository['getBranch']>().mockResolvedValue(branchRecord()),
    createBranch: vi.fn<FacilitiesRepository['createBranch']>().mockResolvedValue(branchRecord()),
    updateBranch: vi.fn<FacilitiesRepository['updateBranch']>().mockResolvedValue(branchRecord()),
    deleteBranch: vi.fn<FacilitiesRepository['deleteBranch']>().mockResolvedValue(undefined),
    countDepartments: vi.fn<FacilitiesRepository['countDepartments']>().mockResolvedValue(0),
    countStaffs: vi.fn<FacilitiesRepository['countStaffs']>().mockResolvedValue(0),
  };
  return { repo, service: new BranchesService(repo as unknown as FacilitiesRepository) };
}

describe('BranchesService', () => {
  describe('list / get', () => {
    it('list: id kiểu string, không có thời gian', async () => {
      const { service } = setup();
      await expect(service.list()).resolves.toEqual([
        { id: '10', name: 'Chi nhánh Hà Nội', address: '1 Phố Huế', phone: '0912345678' },
      ]);
    });

    it('get: id kiểu int', async () => {
      const { service } = setup();
      await expect(service.get(10)).resolves.toMatchObject({ id: 10, name: 'Chi nhánh Hà Nội' });
    });

    it('get: không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getBranch.mockResolvedValue(null);
      await expect(service.get(99)).rejects.toMatchObject(NOT_FOUND);
    });
  });

  describe('create', () => {
    it('ghi name, address, phone và trả chi tiết (id int)', async () => {
      const { service, repo } = setup();
      const dto = { name: 'CN A', address: '2 Hai Bà Trưng', phone: '0912345678' };
      await expect(service.create(dto)).resolves.toMatchObject({ id: 10 });
      expect(repo.createBranch).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('body không có trường nào → 2001, không ghi', async () => {
      const { service, repo } = setup();
      await expect(service.update(10, {})).rejects.toMatchObject({ code: '2001' });
      expect(repo.updateBranch).not.toHaveBeenCalled();
    });

    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getBranch.mockResolvedValue(null);
      await expect(service.update(99, { name: 'X' })).rejects.toMatchObject(NOT_FOUND);
      expect(repo.updateBranch).not.toHaveBeenCalled();
    });

    it('ghi các trường gửi lên và trả chi tiết', async () => {
      const { service, repo } = setup();
      repo.updateBranch.mockResolvedValue(branchRecord({ name: 'Tên mới' }));
      await expect(service.update(10, { name: 'Tên mới' })).resolves.toMatchObject({
        id: 10,
        name: 'Tên mới',
      });
      expect(repo.updateBranch).toHaveBeenCalledWith(10, { name: 'Tên mới' });
    });
  });

  describe('remove', () => {
    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getBranch.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toMatchObject(NOT_FOUND);
      expect(repo.deleteBranch).not.toHaveBeenCalled();
    });

    it('còn khoa trực thuộc → 2003 / 409, không xoá', async () => {
      const { service, repo } = setup();
      repo.countDepartments.mockResolvedValue(2);
      await expect(service.remove(10)).rejects.toMatchObject(CONFLICT);
      expect(repo.countDepartments).toHaveBeenCalledWith(10);
      expect(repo.deleteBranch).not.toHaveBeenCalled();
    });

    it('còn nhân viên trực thuộc → 2003 / 409, không xoá', async () => {
      const { service, repo } = setup();
      repo.countStaffs.mockResolvedValue(1);
      await expect(service.remove(10)).rejects.toMatchObject(CONFLICT);
      expect(repo.countStaffs).toHaveBeenCalledWith({ branchId: 10 });
      expect(repo.deleteBranch).not.toHaveBeenCalled();
    });

    it('không còn khoa hay nhân viên → xoá', async () => {
      const { service, repo } = setup();
      await service.remove(10);
      expect(repo.deleteBranch).toHaveBeenCalledWith(10);
    });
  });
});
