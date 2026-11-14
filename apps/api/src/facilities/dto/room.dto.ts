import type { CreateRoomRequest, UpdateRoomRequest } from '@drmayday/shared';
import { IsDefined, IsOptional, ValidateIf } from 'class-validator';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { NonBlankTextRule, TextRule } from './field-rules.js';

/** POST /rooms. */
export class CreateRoomDto implements CreateRoomRequest {
  @IsDefined()
  @NonBlankTextRule()
  name: string;

  @IsOptional()
  @TextRule()
  description?: string;

  @IsDefined()
  @IdRule()
  department_id: number;
}

/** PUT /rooms/:id: ít nhất một trường; `description: null` xoá mô tả. */
export class UpdateRoomDto implements UpdateRoomRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule()
  name?: string;

  @IsOptional()
  @TextRule()
  description?: string | null;

  @ValidateIf(isPresent)
  @IdRule()
  department_id?: number;
}

/** GET /rooms?department_id= (vắng hoặc rỗng = không lọc). */
export class ListRoomsQuery {
  @IdQuery()
  department_id?: number;
}
