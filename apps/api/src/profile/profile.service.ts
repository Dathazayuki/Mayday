import { Injectable, Logger } from '@nestjs/common';
import { PATIENT_EDITABLE_FIELDS, type ProfileData } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { isBlank } from '../common/text.js';
import { requireRoleId } from '../users/require-role-id.js';
import { isPatient, toProfileData, type UserRecord } from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly users: UsersRepository) {}

  async get(userId: number): Promise<ProfileData> {
    const { user, roleId } = await this.findUser(userId);
    return toProfileData(user, roleId);
  }

  /**
   * Kiểm tra theo thứ tự: có ít nhất 1 trường (2001) → full_name không trống (2003) → người dùng tồn
   * tại (3007) → nhân viên không gửi trường của bệnh nhân (2003); xong mới ghi. Trả hồ sơ sau khi ghi.
   */
  async update(userId: number, dto: UpdateProfileDto): Promise<ProfileData> {
    requireChanges(dto);
    // null lọt qua @IsOptional() của DTO; họ tên trống hay null đều không hợp lệ.
    if (dto.full_name === null || isBlank(dto.full_name)) {
      throw new AppException('2003', { field: 'full_name' });
    }

    const { user, roleId } = await this.findUser(userId);
    if (!isPatient(user)) {
      const patientField = PATIENT_EDITABLE_FIELDS.find((field) => dto[field] !== undefined);
      if (patientField) throw new AppException('2003', { field: patientField });
    }
    return toProfileData(await this.users.updateProfile(userId, dto), roleId);
  }

  /** Người dùng của token: không còn tồn tại → 3007; thiếu bản ghi staffs/patients → 9901. */
  private async findUser(userId: number): Promise<{ user: UserRecord; roleId: number }> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    return { user, roleId: requireRoleId(user, this.logger) };
  }
}
