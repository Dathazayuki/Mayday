import { Body, Controller, Delete, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { QuestionData } from '@drmayday/shared';
import { parseCodePipe } from '../common/parse-code.pipe.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { QUESTION_ID_MAX_LENGTH } from './dto/field-rules.js';
import { UpdateQuestionDto } from './dto/question.dto.js';
import { QuestionsService } from './questions.service.js';
import { MANAGE_TEMPLATES } from './template-permission.js';

const questionIdPipe = () => parseCodePipe(QUESTION_ID_MAX_LENGTH);

/** Sheet ques02, ques03 (spec giai đoạn 3, mục 3.4): cần manage_templates. `:id` là question_id. */
@ApiTags('templates')
@ApiBearerAuth()
@RequirePermission(MANAGE_TEMPLATES)
@Controller('templates/questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Put(':id')
  update(
    @Param('id', questionIdPipe()) id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<QuestionData> {
    return this.questions.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', questionIdPipe()) id: string): Promise<Record<string, never>> {
    await this.questions.remove(id);
    return {};
  }
}
