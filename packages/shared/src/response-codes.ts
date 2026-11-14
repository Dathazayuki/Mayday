/**
 * Catalog mã phản hồi của DrMayDay.
 * Nguồn: Sheet API, tab "3. response code" (bảng mã chi tiết)
 *   → docs/02-api/00-quy-uoc-va-ma-phan-hoi.md (MT-08).
 * Mã 1001 không có trong bảng mã nhưng slide và Sheet đều dùng (MT-09).
 * HTTP status: docs/superpowers/specs/2026-11-15-giai-doan-0-nen-tang-design.md, mục 3.1 (MT-05).
 * Test response-codes.spec.ts bảo đảm catalog luôn khớp tài liệu chuẩn.
 */
export interface ResponseCodeInfo {
  readonly code: string;
  readonly httpStatus: number;
  readonly message: string;
  readonly note: string;
}

const TABLE = [
  ['1000', 200, 'OK', 'Xử lý thành công'],
  ['1001', 201, 'Created successfully', 'Tạo mới thành công'],
  ['2001', 400, 'Missing required parameter', 'Thiếu trường thông tin bắt buộc'],
  ['2002', 400, 'Invalid parameter type', 'Sai kiểu dữ liệu truyền vào'],
  ['2003', 400, 'Invalid parameter value', 'Giá trị parameter không hợp lệ'],
  ['2004', 400, 'Invalid phone number format', 'Số điện thoại không đúng chuẩn VN (03/05/07/08/09)'],
  ['2005', 400, 'Invalid email format', 'Email sai định dạng'],
  ['2006', 400, 'Invalid date format', 'Ngày tháng không đúng định dạng (YYYY-MM-DD)'],
  ['2007', 400, 'Request body invalid', 'Body sai định dạng JSON'],
  ['3001', 401, 'Token is invalid', 'JWT Token không hợp lệ hoặc bị giả mạo'],
  ['3002', 401, 'Token expired', 'JWT Token đã hết hạn'],
  ['3003', 401, 'User not authenticated', 'Chưa đăng nhập (Thiếu header Authorization)'],
  ['3004', 400, 'OTP incorrect', 'Mã OTP không chính xác'],
  ['3005', 400, 'OTP expired', 'Mã OTP đã hết hạn (Sau 10 phút)'],
  ['3006', 409, 'User phone or email already exists', 'Số điện thoại hoặc email đã tồn tại'],
  ['3007', 404, 'User account not found', 'Tài khoản không tồn tại'],
  ['3008', 401, 'Password incorrect', 'Mật khẩu không chính xác'],
  ['3009', 400, 'Old password incorrect', 'Mật khẩu cũ không chính xác khi đổi mật khẩu'],
  ['3101', 403, 'Permission denied', 'Không có quyền thực hiện thao tác'],
  ['3102', 403, 'Admin role required', 'Chỉ dành cho Admin'],
  ['3103', 403, 'Doctor role required', 'Chỉ dành cho Bác sĩ'],
  ['3104', 403, 'Patient role required', 'Chỉ dành cho Bệnh nhân'],
  ['3105', 403, 'Doctor not assigned to this record', 'Bác sĩ không phụ trách bệnh án này'],
  ['3106', 403, "Cannot access another user's data", 'Bệnh nhân không được xem dữ liệu người khác'],
  ['4001', 404, 'Medical record not found', 'Không tìm thấy bệnh án'],
  ['4002', 400, 'Active medical record required', 'Bệnh nhân cần có bệnh án đang hoạt động'],
  ['4003', 409, 'Medical record already completed', 'Bệnh án đã hoàn thành, không thể sửa'],
  ['4004', 409, 'Medical record not in pending status', 'Chỉ tiếp nhận bệnh án đang ở trạng thái pending'],
  ['4005', 409, 'Medical record already accepted by another doctor', 'Bệnh án đã có bác sĩ khác tiếp nhận'],
  ['4006', 400, 'Classification options incomplete', 'Thiếu câu trả lời phân loại'],
  ['4007', 400, 'Answers list cannot be empty', 'Danh sách câu trả lời rỗng'],
  ['4008', 400, 'Question not found in template', 'Câu hỏi không thuộc mẫu bệnh án này'],
  ['4009', 400, 'Invalid medical record status', 'Trạng thái bệnh án không hợp lệ'],
  ['4101', 404, 'Template not found', 'Không tìm thấy mẫu bệnh án'],
  ['4102', 409, 'Template code already exists', 'Mã template code đã tồn tại'],
  ['4103', 404, 'Section not found', 'Không tìm thấy Section'],
  ['4104', 404, 'Question not found', 'Không tìm thấy Question'],
  ['4105', 409, 'Template in use cannot be deleted', 'Mẫu bệnh án đang được dùng, không thể xóa'],
  ['5001', 400, 'Patient not eligible for UAS7 scoring', 'Không có bệnh án mãn tính đang hoạt động'],
  ['5002', 409, 'UAS7 score for this date already submitted', 'Đã chấm điểm ngày này rồi'],
  ['5003', 400, 'Invalid ISS7 itch score value', 'Điểm ngứa ISS7 phải từ 0 đến 3'],
  ['5004', 400, 'Invalid HSS7 hive score value', 'Điểm mề đay HSS7 phải từ 0 đến 3'],
  ['5005', 400, 'Score date is required', 'Thiếu ngày chấm điểm score_date'],
  ['6001', 400, 'Image file is required', 'Chưa chọn file ảnh upload'],
  ['6002', 400, 'Unsupported image file format', 'Chỉ chấp nhận file ảnh (jpg, png, webp)'],
  ['6003', 413, 'Image file size exceeds limit', 'Vượt quá dung lượng tối đa (5MB/10MB)'],
  ['6004', 400, 'Exceeded maximum batch upload count', 'Upload tối đa 10 ảnh 1 lần'],
  ['6005', 404, 'Image attachment not found', 'Không tìm thấy ảnh đính kèm'],
  ['6006', 409, 'Image already mapped to answer', 'Ảnh đã được liên kết với câu trả lời này'],
  ['6007', 502, 'MinIO object storage error', 'Lỗi MinIO server storage'],
  ['7001', 404, 'Lesion episode not found', 'Không tìm thấy đợt tổn thương'],
  ['7002', 404, 'Lesion location not found', 'Không tìm thấy vị trí tổn thương'],
  ['7003', 404, 'Lesion photo record not found', 'Không tìm thấy ảnh chụp tổn thương'],
  ['7004', 400, 'Lesion name cannot be empty', 'Tên đợt tổn thương không được để rỗng'],
  ['7005', 400, 'Body part cannot be empty', 'Vị trí body_part không được để rỗng'],
  ['7006', 400, 'Invalid milestone value', 'Milestone chỉ nhận: start, peak, normal'],
  ['7007', 400, 'Symptom score out of range', 'Điểm triệu chứng ngứa/đau/rát phải từ 0 đến 10'],
  ['8001', 400, 'Medicines list cannot be empty', 'Đơn thuốc phải có ít nhất 1 thuốc'],
  ['8002', 400, 'Medicine name is required', 'Tên thuốc không được để rỗng'],
  ['8003', 409, 'Prescription already exists for this record', 'Bệnh án này đã kê đơn rồi'],
  ['8101', 400, 'Lab tests list cannot be empty', 'Phải chọn ít nhất 1 xét nghiệm'],
  ['8102', 400, 'Test name is required', 'Tên xét nghiệm không được để rỗng'],
  ['8103', 404, 'Lab request not found', 'Không tìm thấy yêu cầu xét nghiệm'],
  ['9001', 502, 'AI model inference failed', 'Lỗi chạy mô hình YOLO AI'],
  ['9002', 502, 'AI service unavailable', 'Server AI không phản hồi (502 Bad Gateway)'],
  ['9003', 400, 'Invalid itch severity for AI calculation', 'Điểm ngứa cho AI phải từ 0 đến 3'],
  ['9101', 400, 'FCM token is required', 'Thiếu FCM Token đăng ký'],
  ['9102', 404, 'Notification not found', 'Không tìm thấy thông báo'],
  ['9901', 500, 'Internal server error', 'Lỗi hệ thống nội bộ'],
  ['9902', 500, 'Database connection error', 'Lỗi kết nối cơ sở dữ liệu'],
  ['9903', 502, 'Third-party service error', 'Lỗi dịch vụ bên thứ 3 (MinIO, FCM, Email)'],
] as const satisfies ReadonlyArray<readonly [string, number, string, string]>;

export type ResponseCode = (typeof TABLE)[number][0];

export const RESPONSE_CODES = Object.freeze(
  Object.fromEntries(
    TABLE.map(([code, httpStatus, message, note]) => [
      code,
      Object.freeze({ code, httpStatus, message, note }),
    ]),
  ),
) as Readonly<Record<ResponseCode, ResponseCodeInfo>>;

export function isResponseCode(value: unknown): value is ResponseCode {
  return typeof value === 'string' && Object.hasOwn(RESPONSE_CODES, value);
}

export const SUCCESS_CODES: readonly ResponseCode[] = ['1000', '1001'];
export const UNAUTHENTICATED_CODES: readonly ResponseCode[] = ['3001', '3002', '3003'];
