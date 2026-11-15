import { IntersectionType } from '@nestjs/swagger';
import type { CreateStaffRequest } from '@drmayday/shared';
import { IsDefined } from 'class-validator';
import { IdRule } from '../../common/id.js';
import { PlacementDto } from '../../facilities/dto/placement.dto.js';
import { SignupDto } from './signup.dto.js';

/**
 * POST /auth/admin/create-staff — Sheet tab "1.6 create_staff": các trường tài khoản như signup,
 * cộng vai trò và nơi công tác. Vai trò do AuthService kiểm tra, nơi công tác (tồn tại, quan hệ
 * cha–con) do FacilitiesService kiểm tra; sai → 2003.
 */
export class CreateStaffDto
  extends IntersectionType(SignupDto, PlacementDto)
  implements CreateStaffRequest
{
  @IsDefined()
  @IdRule()
  role_id: number;
}
