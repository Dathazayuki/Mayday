import { Injectable } from '@nestjs/common';
import type { CreateSectionRequest, SectionData, UpdateSectionRequest } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { toNewSection, toSectionChanges, toSectionData } from './template-mapping.js';
import { TemplatesRepository } from './templates.repository.js';

/** Section của mẫu phiếu (spec giai đoạn 3, mục 3.3). Mẫu không tồn tại → 4101; section → 4103. */
@Injectable()
export class SectionsService {
  constructor(private readonly templates: TemplatesRepository) {}

  async create(templateId: string, dto: CreateSectionRequest): Promise<SectionData> {
    if (!(await this.templates.templateExists(templateId))) throw new AppException('4101');
    return toSectionData(await this.templates.createSection(toNewSection(templateId, dto)));
  }

  async update(sectionId: number, dto: UpdateSectionRequest): Promise<SectionData> {
    requireChanges(dto);
    const section = await this.templates.updateSection(sectionId, toSectionChanges(dto));
    if (!section) throw new AppException('4103');
    return toSectionData(section);
  }

  /** Câu hỏi và lựa chọn của section bị CASCADE. */
  async remove(sectionId: number): Promise<void> {
    if (!(await this.templates.deleteSection(sectionId))) throw new AppException('4103');
  }
}
