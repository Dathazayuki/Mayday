import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { QuestionData, SectionData } from '@drmayday/shared';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { CreateQuestionDto } from './dto/question.dto.js';
import { UpdateSectionDto } from './dto/section.dto.js';
import { QuestionsService } from './questions.service.js';
import { SectionsService } from './sections.service.js';
import { MANAGE_TEMPLATES } from './template-permission.js';

/**
 * Sheet sec02, sec03 và ques01 (spec giai đoạn 3, mục 3.3–3.4): mọi API đều ghi nên cần quyền
 * manage_templates.
 */
@ApiTags('templates')
@ApiBearerAuth()
@RequirePermission(MANAGE_TEMPLATES)
@Controller('templates/sections')
export class SectionsController {
  constructor(
    private readonly sections: SectionsService,
    private readonly questions: QuestionsService,
  ) {}

  @Put(':id')
  update(
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdateSectionDto,
  ): Promise<SectionData> {
    return this.sections.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', parseIdPipe()) id: number): Promise<Record<string, never>> {
    await this.sections.remove(id);
    return {};
  }

  @Post(':section_id/questions')
  @ResponseCode('1001')
  createQuestion(
    @Param('section_id', parseIdPipe('section_id')) sectionId: number,
    @Body() dto: CreateQuestionDto,
  ): Promise<QuestionData> {
    return this.questions.create(sectionId, dto);
  }
}
