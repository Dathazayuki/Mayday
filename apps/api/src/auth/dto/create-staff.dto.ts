import type { CreateStaffRequest } from '@drmayday/shared';
import { IsDefined, IsOptional } from 'class-validator';
import { IdRule } from '../../common/id.js';
import { SignupDto } from './signup.dto.js';

/**
 * POST /auth/admin/create-staff — Sheet tab "1.6 create_staff": các trường tài khoản như signup,
 * cộng vai trò và nơi công tác. Vai trò do AuthService kiểm tra, nơi công tác (tồn tại, quan hệ
 * cha–con) do FacilitiesService kiểm tra; sai → 2003.
 */
export class CreateStaffDto extends SignupDto implements CreateStaffRequest {
  @IsDefined()
  @IdRule()
  role_id: number;

  @IsDefined()
  @IdRule()
  branch_id: number;

  @IsDefined()
  @IdRule()
  department_id: number;

  @IsOptional() // "Có thể null nếu không có phòng cố định"
  @IdRule()
  room_id?: number | null;
}
