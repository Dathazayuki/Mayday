import { Injectable } from '@nestjs/common';
import type {
  CreateTemplateRequest,
  TemplateData,
  TemplateDetailData,
  TemplateSummary,
  UpdateTemplateRequest,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { requireChanges } from '../common/require-changes.js';
import type { ListTemplatesQuery } from './dto/template.dto.js';
import {
  fromFlag,
  toNewTemplate,
  toTemplateChanges,
  toTemplateData,
  toTemplateDetail,
  toTemplateSummary,
} from './template-mapping.js';
import { TemplatesRepository } from './templates.repository.js';

/** Mẫu phiếu (spec giai đoạn 3, mục 3.2). Không tìm thấy → 4101; trùng code_template → 4102. */
@Injectable()
export class TemplatesService {
  constructor(private readonly templates: TemplatesRepository) {}

  /** Một trang mẫu phiếu (code_template tăng dần); `total` đếm mọi mẫu khớp bộ lọc. */
  async list(query: ListTemplatesQuery): Promise<Paginated<TemplateSummary>> {
    const page = await this.templates.listTemplates(
      { isActive: fromFlag(query.is_active) },
      pageWindow(query),
    );
    return new Paginated(page.items.map(toTemplateSummary), page.total);
  }

  async get(code: string): Promise<TemplateDetailData> {
    const tree = await this.templates.getTemplateTree(code);
    if (!tree) throw new AppException('4101');
    return toTemplateDetail(tree);
  }

  /** Trùng code_template → 4102 (TemplatesRepository). */
  async create(dto: CreateTemplateRequest): Promise<TemplateData> {
    return toTemplateData(await this.templates.createTemplate(toNewTemplate(dto)));
  }

  async update(code: string, dto: UpdateTemplateRequest): Promise<TemplateData> {
    requireChanges(dto);
    const template = await this.templates.updateTemplate(code, toTemplateChanges(dto));
    if (!template) throw new AppException('4101');
    return toTemplateData(template);
  }

  /**
   * Section, câu hỏi và lựa chọn bị CASCADE. Mẫu đang được bệnh án dùng (4105) kiểm tra thêm ở giai
   * đoạn 4, khi có bảng medical_records.
   */
  async remove(code: string): Promise<void> {
    if (!(await this.templates.deleteTemplate(code))) throw new AppException('4101');
  }
}
