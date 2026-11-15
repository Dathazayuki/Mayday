import type { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { branchRecord } from './facility-record.fixture.js';

function setup() {
  const repo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === 10 ? branchRecord() : null,
    ),
  };
  return { repo, service: new FacilitiesService(repo as unknown as FacilitiesRepository) };
}

describe('FacilitiesService.assertBranchExists', () => {
  it('chi nhánh tồn tại → không lỗi', async () => {
    const { service } = setup();
    await expect(service.assertBranchExists(10)).resolves.toBeUndefined();
  });

  it('chi nhánh không tồn tại → 2003 kèm field branch_id (HTTP 400)', async () => {
    const { service } = setup();
    await expect(service.assertBranchExists(99)).rejects.toMatchObject({
      code: '2003',
      data: { field: 'branch_id' },
      httpStatus: undefined,
    });
  });
});
