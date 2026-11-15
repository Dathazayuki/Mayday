import { AppException } from '../common/app.exception.js';
import { Paginated } from '../common/paginated.js';
import { sectionRecord, templateRecord } from './template-record.fixture.js';
import type { TemplatesRepository } from './templates.repository.js';
import { TemplatesService } from './templates.service.js';

function setup() {
  const repo = {
    listTemplates: vi
      .fn<TemplatesRepository['listTemplates']>()
      .mockResolvedValue({ items: [templateRecord()], total: 1 }),
    getTemplateTree: vi
      .fn<TemplatesRepository['getTemplateTree']>()
      .mockResolvedValue({ ...templateRecord(), template_sections: [] }),
    createTemplate: vi
      .fn<TemplatesRepository['createTemplate']>()
      .mockResolvedValue(templateRecord()),
    updateTemplate: vi
      .fn<TemplatesRepository['updateTemplate']>()
      .mockResolvedValue(templateRecord()),
    deleteTemplate: vi.fn<TemplatesRepository['deleteTemplate']>().mockResolvedValue(true),
  };
  return { repo, service: new TemplatesService(repo as unknown as TemplatesRepository) };
}

describe('TemplatesService', () => {
  describe('list', () => {
    it('trang mẫu phiếu kèm total; is_active vắng = không lọc', async () => {
      const { service, repo } = setup();
      repo.listTemplates.mockResolvedValue({ items: [templateRecord()], total: 41 });
      const result = await service.list({ page: 3, limit: 20 });
      expect(result).toBeInstanceOf(Paginated);
      expect(result).toMatchObject({
        total: 41,
        items: [{ code_template: 'TMPL_URT', is_active: '1' }],
      });
      expect(repo.listTemplates).toHaveBeenCalledWith(
        { isActive: undefined },
        { skip: 40, take: 20 },
      );
    });

    it('lọc is_active "0" → mẫu ngừng dùng', async () => {
      const { service, repo } = setup();
      await service.list({ page: 1, limit: 20, is_active: '0' });
      expect(repo.listTemplates).toHaveBeenCalledWith({ isActive: false }, { skip: 0, take: 20 });
    });
  });

  describe('get', () => {
    it('trả cây mẫu phiếu', async () => {
      const { service, repo } = setup();
      repo.getTemplateTree.mockResolvedValue({
        ...templateRecord(),
        template_sections: [{ ...sectionRecord(), questions: [] }],
      });
      await expect(service.get('TMPL_URT')).resolves.toMatchObject({
        code_template: 'TMPL_URT',
        sections: [{ section_id: '7', questions: [] }],
      });
      expect(repo.getTemplateTree).toHaveBeenCalledWith('TMPL_URT');
    });

    it('không tồn tại → 4101', async () => {
      const { service, repo } = setup();
      repo.getTemplateTree.mockResolvedValue(null);
      await expect(service.get('TMPL_X')).rejects.toMatchObject({ code: '4101' });
    });
  });

  describe('create', () => {
    it('ghi mẫu (mặc định do CSDL đặt) và trả chi tiết', async () => {
      const { service, repo } = setup();
      await expect(
        service.create({ code_template: 'TMPL_URT', name: 'Phiếu khám mề đay' }),
      ).resolves.toMatchObject({ code_template: 'TMPL_URT', version: '1.0', is_active: '1' });
      expect(repo.createTemplate).toHaveBeenCalledWith({
        code_template: 'TMPL_URT',
        name: 'Phiếu khám mề đay',
        description: null,
        version: undefined,
        is_active: undefined,
      });
    });

    it('trùng code_template → 4102 (repository báo)', async () => {
      const { service, repo } = setup();
      repo.createTemplate.mockRejectedValue(new AppException('4102'));
      await expect(service.create({ code_template: 'TMPL_URT', name: 'X' })).rejects.toMatchObject({
        code: '4102',
      });
    });
  });

  describe('update', () => {
    it('body không có trường nào → 2001, không ghi', async () => {
      const { service, repo } = setup();
      await expect(service.update('TMPL_URT', {})).rejects.toMatchObject({ code: '2001' });
      expect(repo.updateTemplate).not.toHaveBeenCalled();
    });

    it('không tồn tại → 4101', async () => {
      const { service, repo } = setup();
      repo.updateTemplate.mockResolvedValue(null);
      await expect(service.update('TMPL_X', { name: 'Y' })).rejects.toMatchObject({ code: '4101' });
    });

    it('ghi các trường gửi lên (is_active "0" → false) và trả chi tiết có description', async () => {
      const { service, repo } = setup();
      repo.updateTemplate.mockResolvedValue(templateRecord({ is_active: false }));
      await expect(service.update('TMPL_URT', { is_active: '0' })).resolves.toMatchObject({
        is_active: '0',
        description: 'Khám lần đầu',
      });
      expect(repo.updateTemplate).toHaveBeenCalledWith('TMPL_URT', {
        name: undefined,
        description: undefined,
        version: undefined,
        is_active: false,
      });
    });
  });

  describe('remove', () => {
    it('xoá mẫu (section, câu hỏi, lựa chọn CASCADE)', async () => {
      const { service, repo } = setup();
      await service.remove('TMPL_URT');
      expect(repo.deleteTemplate).toHaveBeenCalledWith('TMPL_URT');
    });

    it('không tồn tại → 4101', async () => {
      const { service, repo } = setup();
      repo.deleteTemplate.mockResolvedValue(false);
      await expect(service.remove('TMPL_X')).rejects.toMatchObject({ code: '4101' });
    });
  });
});
