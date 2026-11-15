import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  SectionData,
  TemplateData,
  TemplateDetailData,
  TemplateSummary,
} from '@drmayday/shared';
import type { Paginated } from '../common/paginated.js';
import { parseCodePipe } from '../common/parse-code.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { CODE_TEMPLATE_MAX_LENGTH } from './dto/field-rules.js';
import { CreateSectionDto } from './dto/section.dto.js';
import { CreateTemplateDto, ListTemplatesQuery, UpdateTemplateDto } from './dto/template.dto.js';
import { SectionsService } from './sections.service.js';
import { MANAGE_TEMPLATES } from './template-permission.js';
import { TemplatesService } from './templates.service.js';

const templateCodePipe = (field?: string) => parseCodePipe(CODE_TEMPLATE_MAX_LENGTH, field);

/**
 * Sheet tmpl01–05 và sec01 (spec giai đoạn 3, mục 3.2–3.3): GET cho mọi người đã đăng nhập, API ghi
 * cần quyền manage_templates. `:id` là code_template.
 */
@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly sections: SectionsService,
  ) {}

  @Post()
  @RequirePermission(MANAGE_TEMPLATES)
  @ResponseCode('1001')
  create(@Body() dto: CreateTemplateDto): Promise<TemplateData> {
    return this.templates.create(dto);
  }

  // Khai báo trước GET :id để "all" không bị hiểu là code_template.
  @Get('all')
  list(@Query() query: ListTemplatesQuery): Promise<Paginated<TemplateSummary>> {
    return this.templates.list(query);
  }

  @Get(':id')
  get(@Param('id', templateCodePipe()) code: string): Promise<TemplateDetailData> {
    return this.templates.get(code);
  }

  @Put(':id')
  @RequirePermission(MANAGE_TEMPLATES)
  update(
    @Param('id', templateCodePipe()) code: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<TemplateData> {
    return this.templates.update(code, dto);
  }

  @Delete(':id')
  @RequirePermission(MANAGE_TEMPLATES)
  async remove(@Param('id', templateCodePipe()) code: string): Promise<Record<string, never>> {
    await this.templates.remove(code);
    return {};
  }

  @Post(':template_id/sections')
  @RequirePermission(MANAGE_TEMPLATES)
  @ResponseCode('1001')
  createSection(
    @Param('template_id', templateCodePipe('template_id')) templateId: string,
    @Body() dto: CreateSectionDto,
  ): Promise<SectionData> {
    return this.sections.create(templateId, dto);
  }
}
