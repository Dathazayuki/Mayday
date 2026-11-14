import type { CreateRoomRequest, UpdateRoomRequest } from '@drmayday/shared';
import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { NameRule, TextRule } from './field-rules.js';

/** POST /rooms. */
export class CreateRoomDto implements CreateRoomRequest {
  @IsDefined()
  @NameRule()
  name: string;

  @IsOptional()
  @TextRule()
  description?: string;

  @IsDefined()
  @IsInt()
  department_id: number;
}

/** PUT /rooms/:id: ít nhất một trường; `description: null` xoá mô tả. */
export class UpdateRoomDto implements UpdateRoomRequest {
  @ValidateIf(isPresent)
  @NameRule()
  name?: string;

  @IsOptional()
  @TextRule()
  description?: string | null;

  @ValidateIf(isPresent)
  @IsInt()
  department_id?: number;
}

/** GET /rooms?department_id= (query luôn là chuỗi nên cần chuyển sang số). */
export class ListRoomsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  department_id?: number;
}
