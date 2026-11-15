import { Injectable, Logger } from '@nestjs/common';
import type { PatientData, PatientSearchItem } from '@drmayday/shared';
import { PasswordService } from '../auth/password.service.js';
import { AppException } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { requireChanges } from '../common/require-changes.js';
import { requirePatientRoleId } from '../roles/patient-role.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import { UsersRepository } from '../users/users.repository.js';
import type { CreatePatientDto, SearchPatientsQuery, UpdatePatientDto } from './dto/patient.dto.js';
import {
  toPatientData,
  toPatientSearchItem,
  type BirthYearRange,
  type PatientRecord,
} from './patient-mapping.js';
import { PatientsRepository } from './patients.repository.js';

/**
 * Luật năm của docpat01: hai giá trị bằng nhau, hoặc một bên là 0 hoặc vắng → đúng năm đó; cả hai khác
 * 0 mà min_year > max_year → 2003. Cả hai vắng hoặc 0 → không lọc.
 */
function birthYearRange(minYear = 0, maxYear = 0): BirthYearRange | undefined {
  if (minYear === 0 && maxYear === 0) return undefined;
  if (minYear === 0 || maxYear === 0) {
    const year = minYear || maxYear;
    return { from: year, to: year };
  }
  if (minYear > maxYear) throw new AppException('2003', { field: 'min_year' });
  return { from: minYear, to: maxYear };
}

/**
 * Bệnh nhân (spec B, mục 5.2): docpat01–02 và GET/PUT /doctor/patients/:id. Bệnh nhân = nguoi có dòng
 * benhnhan (D-B16); người không có dòng benhnhan (nhân viên, admin) → 3007.
 */
@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly patients: PatientsRepository,
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly passwords: PasswordService,
  ) {}

  /** Luật năm (2003) → tìm theo D-B17; `total` đếm mọi bệnh nhân khớp bộ lọc. */
  async search(query: SearchPatientsQuery): Promise<Paginated<PatientSearchItem>> {
    const filter = {
      keyword: query.keyword,
      gender: query.gender,
      birthYears: birthYearRange(query.min_year, query.max_year),
    };
    const page = await this.patients.search(filter, pageWindow(query));
    return new Paginated(page.items.map(toPatientSearchItem), page.total);
  }

  async get(patientId: number): Promise<PatientData> {
    return toPatientData(await this.findPatient(patientId));
  }

  /**
   * Kiểm tra theo thứ tự: số đã là tên đăng nhập (3006) → vai trò benh_nhan có trong CSDL (9901). Ghi
   * nguoi + benhnhan + taikhoan vai trò benh_nhan trong một nested create (D-B16, MT-119).
   */
  async create(dto: CreatePatientDto): Promise<PatientData> {
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const roleId = await requirePatientRoleId(this.roles, this.logger);
    const { full_name, phone, password, gender, ...profile } = dto;
    const patient = await this.patients.create(
      {
        fullName: full_name,
        phone,
        passwordHash: await this.passwords.hash(password),
        gender: gender ?? null,
        roleId,
      },
      profile,
    );
    return toPatientData(patient);
  }

  /**
   * Luật của PUT /profile: ít nhất 1 trường (2001) → full_name không trống (2003) → là bệnh nhân (3007).
   * Không đổi số điện thoại, không chạm taikhoan.
   */
  async update(patientId: number, dto: UpdatePatientDto): Promise<PatientData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const updated = await this.patients.update(patientId, dto);
    if (!updated) throw new AppException('3007');
    return toPatientData(updated);
  }

  private async findPatient(patientId: number): Promise<PatientRecord> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new AppException('3007');
    return patient;
  }
}
