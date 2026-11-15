import { Injectable, Logger } from '@nestjs/common';
import { PATIENT_EDITABLE_FIELDS, type ProfileData } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import { toProfileData, type ShapedUser } from '../users/user-mapping.js';
import { requireShape } from '../users/user-shape.js';
import { UsersRepository } from '../users/users.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

/** GET/PUT /profile (spec A, mục 5.3): dạng dữ liệu theo vai trò (D4). */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly users: UsersRepository) {}

  async get(userId: number): Promise<ProfileData> {
    return toProfileData(await this.findUser(userId));
  }

  /**
   * Kiểm tra theo thứ tự: có ít nhất 1 trường (2001) → full_name không trống (2003) → tài khoản tồn
   * tại (3007) → nhân viên không gửi trường của bệnh nhân (2003); xong mới ghi.
   */
  async update(userId: number, dto: UpdateProfileDto): Promise<ProfileData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const user = await this.findUser(userId);
    if (user.shape === 'staff') {
      const patientField = PATIENT_EDITABLE_FIELDS.find((field) => dto[field] !== undefined);
      if (patientField) throw new AppException('2003', { field: patientField });
    }
    const updated = await this.users.updateProfile(userId, dto);
    if (!updated) throw new AppException('3007');
    return toProfileData(requireShape(updated, this.logger));
  }

  /** Không còn tài khoản → 3007; vai trò benh_nhan thiếu dòng benhnhan → 9901 (MT-112). */
  private async findUser(userId: number): Promise<ShapedUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    return requireShape(user, this.logger);
  }
}
