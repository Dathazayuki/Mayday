import { SectionsService } from './sections.service.js';
import { sectionRecord } from './template-record.fixture.js';
import type { TemplatesRepository } from './templates.repository.js';

function setup() {
  const repo = {
    templateExists: vi.fn<TemplatesRepository['templateExists']>().mockResolvedValue(true),
    createSection: vi.fn<TemplatesRepository['createSection']>().mockResolvedValue(sectionRecord()),
    updateSection: vi.fn<TemplatesRepository['updateSection']>().mockResolvedValue(sectionRecord()),
    deleteSection: vi.fn<TemplatesRepository['deleteSection']>().mockResolvedValue(true),
  };
  return { repo, service: new SectionsService(repo as unknown as TemplatesRepository) };
}

describe('SectionsService', () => {
  describe('create', () => {
    it('mẫu không tồn tại → 4101, không ghi', async () => {
      const { service, repo } = setup();
      repo.templateExists.mockResolvedValue(false);
      await expect(service.create('TMPL_X', { title: 'A', order: '1' })).rejects.toMatchObject({
        code: '4101',
      });
      expect(repo.templateExists).toHaveBeenCalledWith('TMPL_X');
      expect(repo.createSection).not.toHaveBeenCalled();
    });

    it('ghi section vào mẫu và trả data (mọi trường string)', async () => {
      const { service, repo } = setup();
      await expect(
        service.create('TMPL_URT', { title: 'Thông tin chung', order: '1', filled_by: 'patient' }),
      ).resolves.toEqual({
        section_id: '7',
        template_id: 'TMPL_URT',
        title: 'Thông tin chung',
        order: '1',
        is_required: '0',
        filled_by: 'patient',
      });
      expect(repo.createSection).toHaveBeenCalledWith({
        template_id: 'TMPL_URT',
        title: 'Thông tin chung',
        order: 1,
        is_required: undefined,
        filled_by: 'patient',
      });
    });
  });

  describe('update', () => {
    it('body không có trường nào → 2001, không ghi', async () => {
      const { service, repo } = setup();
      await expect(service.update(7, {})).rejects.toMatchObject({ code: '2001' });
      expect(repo.updateSection).not.toHaveBeenCalled();
    });

    it('không tồn tại → 4103', async () => {
      const { service, repo } = setup();
      repo.updateSection.mockResolvedValue(null);
      await expect(service.update(99, { title: 'B' })).rejects.toMatchObject({ code: '4103' });
    });

    it('ghi các trường gửi lên và trả data', async () => {
      const { service, repo } = setup();
      repo.updateSection.mockResolvedValue(sectionRecord({ order: 3, is_required: true }));
      await expect(service.update(7, { order: 3, is_required: '1' })).resolves.toMatchObject({
        order: '3',
        is_required: '1',
      });
      expect(repo.updateSection).toHaveBeenCalledWith(7, {
        title: undefined,
        order: 3,
        is_required: true,
        filled_by: undefined,
      });
    });
  });

  describe('remove', () => {
    it('xoá section (câu hỏi, lựa chọn CASCADE)', async () => {
      const { service, repo } = setup();
      await service.remove(7);
      expect(repo.deleteSection).toHaveBeenCalledWith(7);
    });

    it('không tồn tại → 4103', async () => {
      const { service, repo } = setup();
      repo.deleteSection.mockResolvedValue(false);
      await expect(service.remove(99)).rejects.toMatchObject({ code: '4103' });
    });
  });
});
