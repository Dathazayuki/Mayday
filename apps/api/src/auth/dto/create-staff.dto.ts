import type { CreateStaffRequest } from '@drmayday/shared';
import { IsDefined, IsInt, IsOptional } from 'class-validator';
import { SignupDto } from './signup.dto.js';

/**
 * POST /auth/admin/create-staff — Sheet tab "1.6 create_staff": các trường tài khoản như signup,
 * cộng vai trò và nơi công tác. Tồn tại/quan hệ cha–con của chúng do AuthService kiểm tra (2003).
 */
export class CreateStaffDto extends SignupDto implements CreateStaffRequest {
  @IsDefined()
  @IsInt()
  role_id: number;

  @IsDefined()
  @IsInt()
  branch_id: number;

  @IsDefined()
  @IsInt()
  department_id: number;

  @IsOptional() // "Có thể null nếu không có phòng cố định"
  @IsInt()
  room_id?: number | null;
}
