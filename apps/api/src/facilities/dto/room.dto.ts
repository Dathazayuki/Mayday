import { FIELD_LIMITS, type CreateRoomRequest, type UpdateRoomRequest } from '@drmayday/shared';
import { IsDefined, ValidateIf } from 'class-validator';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { NonBlankTextRule } from './field-rules.js';

/** POST /rooms: phòng thuộc thẳng chi nhánh; không còn description, department_id (MT-108). */
export class CreateRoomDto implements CreateRoomRequest {
  @IsDefined()
  @NonBlankTextRule(FIELD_LIMITS.room_name)
  name: string;

  @IsDefined()
  @IdRule()
  branch_id: number;
}

/** PUT /rooms/:id: ít nhất một trường (RoomsService kiểm tra, 2001). */
export class UpdateRoomDto implements UpdateRoomRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule(FIELD_LIMITS.room_name)
  name?: string;

  @ValidateIf(isPresent)
  @IdRule()
  branch_id?: number;
}

/** GET /rooms?branch_id= (vắng hoặc rỗng = không lọc). */
export class ListRoomsQuery {
  @IdQuery()
  branch_id?: number;
}
