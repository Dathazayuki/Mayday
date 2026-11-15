import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';
import { SectionsController } from './sections.controller.js';
import { SectionsService } from './sections.service.js';
import { TemplatesController } from './templates.controller.js';
import { TemplatesRepository } from './templates.repository.js';
import { TemplatesService } from './templates.service.js';

/** Mẫu phiếu khám động (spec giai đoạn 3): templates, sections, questions. */
@Module({
  controllers: [TemplatesController, SectionsController, QuestionsController],
  providers: [TemplatesRepository, TemplatesService, SectionsService, QuestionsService],
})
export class TemplatesModule {}
