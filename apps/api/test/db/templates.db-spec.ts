import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const DOCTOR = { full_name: 'Bác sĩ', phone: '0912345678', password: 'bacsi123' };
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const ID = expect.stringMatching(/^\d+$/);
const DEV = 'TMPL_DEV_SAMPLE';

type Method = 'get' | 'post' | 'put' | 'delete';

/** Mọi giá trị lá (không phải object/mảng) trong `value` đều là string hoặc null (spec mục 3.1)? */
function leavesAreStrings(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(leavesAreStrings);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).every(leavesAreStrings);
  }
  return value === null || typeof value === 'string';
}

describe('Mẫu phiếu khám động: templates, sections, questions (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;
  /** section_id của 2 section trong mẫu dev (order 1, 2). */
  let devSections: [number, number];

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  /** Gọi `/api/v1${path}` bằng token (mặc định của admin). */
  const api = (method: Method, path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  /** Bác sĩ tạo bằng create-staff (chưa được cấp manage_templates) rồi đăng nhập, trả token. */
  async function doctorToken(): Promise<string> {
    await api('post', '/auth/admin/create-staff')
      .send({
        ...DOCTOR,
        role_id: seed.roles.doctor,
        branch_id: seed.branchId,
        department_id: seed.departmentId,
      })
      .expect(201);
    return (await login(DOCTOR.phone, DOCTOR.password).expect(200)).body.data.token;
  }

  const createTemplate = (body: Record<string, unknown> = {}, token = adminToken) =>
    api('post', '/templates', token).send({
      code_template: 'TMPL_URT',
      name: 'Phiếu mề đay',
      ...body,
    });
  const createSection = (code: string, body: Record<string, unknown> = {}) =>
    api('post', `/templates/${code}/sections`).send({ title: 'Phần mới', order: '1', ...body });
  const createQuestion = (sectionId: number, body: Record<string, unknown>) =>
    api('post', `/templates/sections/${sectionId}/questions`).send(body);
  const optionIds = async (questionId: string) =>
    (
      await prisma.question_options.findMany({
        where: { question_id: questionId },
        orderBy: { id: 'asc' },
      })
    ).map(({ id }) => id);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
    const sections = await prisma.template_sections.findMany({
      where: { template_id: DEV },
      orderBy: { order: 'asc' },
    });
    devSections = [sections[0]!.section_id, sections[1]!.section_id];
  });

  afterAll(async () => {
    await app.close();
  });

  describe('quyền manage_templates (@RequirePermission)', () => {
    /** Đủ 9 API ghi, trỏ vào dữ liệu của mẫu dev. */
    const writes = (): [Method, string][] => [
      ['post', '/templates'],
      ['put', `/templates/${DEV}`],
      ['delete', `/templates/${DEV}`],
      ['post', `/templates/${DEV}/sections`],
      ['put', `/templates/sections/${devSections[0]}`],
      ['delete', `/templates/sections/${devSections[0]}`],
      ['post', `/templates/sections/${devSections[0]}/questions`],
      ['put', '/templates/questions/Q_DEV_NOTE'],
      ['delete', '/templates/questions/Q_DEV_NOTE'],
    ];

    it('bác sĩ chưa được cấp quyền: 9 API ghi → 403 / 3101, không ghi gì; API đọc vẫn gọi được', async () => {
      const token = await doctorToken();
      for (const [method, path] of writes()) {
        const res = await api(method, path, token).send({ name: 'X' }).expect(403);
        expect(res.body).toEqual({ code: '3101', message: 'Permission denied' });
      }
      expect(await prisma.templates.count()).toBe(1);
      expect(await prisma.questions.count({ where: { question_id: 'Q_DEV_NOTE' } })).toBe(1);

      await api('get', '/templates/all', token).expect(200);
      await api('get', `/templates/${DEV}`, token).expect(200);
    });

    it('chưa đăng nhập → 401 / 3003', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/templates/all').expect(401);
      expect(res.body).toMatchObject({ code: '3003' });
    });

    it('admin cấp manage_templates cho vai trò doctor qua POST /role_permissions → bác sĩ gọi được', async () => {
      const token = await doctorToken();
      await createTemplate({}, token).expect(403);

      await api('post', '/role_permissions')
        .send({ role_id: seed.roles.doctor, permissions: [seed.permissions.manage_templates] })
        .expect(200);
      await createTemplate({ code_template: 'TMPL_BS' }, token).expect(201);
      await api('put', '/templates/questions/Q_DEV_NOTE', token)
        .send({ question_text: 'Ghi chú' })
        .expect(200);
    });

    it('CSDL chưa gắn quyền với endpoint (chưa đồng bộ): quyền khai báo trong code vẫn được áp dụng', async () => {
      await prisma.permissions_endpoints.deleteMany({
        where: { permission_id: seed.permissions.manage_templates },
      });
      app.get(PermissionCache).invalidate();
      const token = await doctorToken();
      await createTemplate({}, token).expect(403);
      // Admin luôn qua.
      await createTemplate().expect(201);
    });
  });

  describe('templates', () => {
    it('POST → 201 / 1001, mọi trường string; version, is_active, description mặc định', async () => {
      const res = await createTemplate().expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          code_template: 'TMPL_URT',
          name: 'Phiếu mề đay',
          description: null,
          version: '1.0',
          is_active: '1',
          created_at: ISO,
          updated_at: ISO,
        },
      });
      await expect(
        prisma.templates.findUniqueOrThrow({ where: { code_template: 'TMPL_URT' } }),
      ).resolves.toMatchObject({ version: '1.0', is_active: true, description: null });
    });

    it('POST đủ trường tuỳ chọn → ghi đúng', async () => {
      const res = await createTemplate({
        description: 'Khám lần đầu',
        version: '2.0',
        is_active: '0',
      }).expect(201);
      expect(res.body.data).toMatchObject({
        description: 'Khám lần đầu',
        version: '2.0',
        is_active: '0',
      });
    });

    it('POST trùng code_template → 409 / 4102', async () => {
      const res = await createTemplate({ code_template: DEV }).expect(409);
      expect(res.body).toEqual({ code: '4102', message: 'Template code already exists' });
    });

    it.each([
      ['code_template chữ thường', { code_template: 'tmpl_urt' }, '2003'],
      ['code_template dài quá 255 ký tự', { code_template: 'A'.repeat(256) }, '2003'],
      ['thiếu name', { name: undefined }, '2001'],
      ['is_active ngoài "0"/"1"', { is_active: 1 }, '2003'],
    ])('POST %s → 400 / %s, không ghi', async (_name, body, code) => {
      const res = await createTemplate(body).expect(400);
      expect(res.body).toMatchObject({ code });
      expect(await prisma.templates.count()).toBe(1);
    });

    it('GET all → 1000, mảng mẫu theo code_template kèm total ngoài data; lọc is_active; phân trang', async () => {
      await createTemplate({ code_template: 'TMPL_A', is_active: '0' }).expect(201);
      await createTemplate({ code_template: 'TMPL_B', description: 'Mô tả B' }).expect(201);

      const all = await api('get', '/templates/all').expect(200);
      expect(all.body).toMatchObject({ code: '1000', message: 'OK', total: 3 });
      expect(all.body.data.map((t: { code_template: string }) => t.code_template)).toEqual([
        'TMPL_A',
        'TMPL_B',
        DEV,
      ]);
      expect(all.body.data[1]).toEqual({
        code_template: 'TMPL_B',
        name: 'Phiếu mề đay',
        description: 'Mô tả B',
        version: '1.0',
        is_active: '1',
        created_at: ISO,
      });

      const active = await api('get', '/templates/all?is_active=1').expect(200);
      expect(active.body.total).toBe(2);
      expect(active.body.data.map((t: { code_template: string }) => t.code_template)).toEqual([
        'TMPL_B',
        DEV,
      ]);
      const inactive = await api('get', '/templates/all?is_active=0').expect(200);
      expect(inactive.body).toMatchObject({ total: 1, data: [{ code_template: 'TMPL_A' }] });

      const page = await api('get', '/templates/all?page=2&limit=2').expect(200);
      expect(page.body).toMatchObject({ total: 3, data: [{ code_template: DEV }] });
    });

    it.each([
      ['is_active ngoài "0"/"1"', '?is_active=true', '2003'],
      ['limit vượt tối đa', '?limit=101', '2003'],
      ['page không phải số', '?page=abc', '2002'],
    ])('GET all %s → 400 / %s', async (_name, query, code) => {
      const res = await api('get', `/templates/all${query}`).expect(400);
      expect(res.body).toMatchObject({ code });
    });

    it('GET :id → cây đầy đủ của mẫu dev (spec mục 3.5), mọi trường là string', async () => {
      const res = await api('get', `/templates/${DEV}`).expect(200);
      expect(res.body.code).toBe('1000');
      const data = res.body.data;
      expect(leavesAreStrings(data)).toBe(true);
      const [yes, no] = await optionIds('Q_DEV_HAS_ITCH');
      expect(data).toEqual({
        code_template: DEV,
        name: 'Phiếu khám mẫu (dữ liệu dev)',
        description: null,
        version: '1.0',
        is_active: '1',
        created_at: ISO,
        updated_at: ISO,
        sections: [
          {
            section_id: String(devSections[0]),
            title: 'Thông tin chung',
            order: '1',
            is_required: '0',
            filled_by: 'patient',
            questions: [
              {
                question_id: 'Q_DEV_HAS_ITCH',
                section_id: String(devSections[0]),
                question_text: 'Bạn có bị ngứa không?',
                type_question: 'radio',
                placeholder: null,
                order: '1',
                is_required: '0',
                parent_question_id: null,
                show_if_answer: null,
                help_text: null,
                allow_image: '0',
                options: [
                  {
                    id: String(yes),
                    option_text: 'Có',
                    option_value: 'YES',
                    order: '1',
                    trigger_image_upload: '0',
                  },
                  {
                    id: String(no),
                    option_text: 'Không',
                    option_value: 'NO',
                    order: '2',
                    trigger_image_upload: '0',
                  },
                ],
              },
              expect.objectContaining({
                question_id: 'Q_DEV_ITCH_LEVEL',
                type_question: 'number',
                order: '2',
                parent_question_id: 'Q_DEV_HAS_ITCH',
                show_if_answer: ['YES'],
                options: [],
              }),
            ],
          },
          {
            section_id: String(devSections[1]),
            title: 'Khám lâm sàng',
            order: '2',
            is_required: '0',
            filled_by: 'doctor',
            questions: [
              expect.objectContaining({ question_id: 'Q_DEV_NOTE', type_question: 'text' }),
            ],
          },
        ],
      });
    });

    it('GET :id: section và câu hỏi theo order (không theo thứ tự tạo)', async () => {
      await createTemplate().expect(201);
      const later = (await createSection('TMPL_URT', { title: 'Sau', order: '5' }).expect(201)).body
        .data.section_id;
      const first = (await createSection('TMPL_URT', { title: 'Trước', order: 0 }).expect(201)).body
        .data.section_id;
      for (const [questionId, order] of [
        ['Q_URT_C', '3'],
        ['Q_URT_A', '1'],
      ] as const) {
        await createQuestion(Number(later), {
          question_id: questionId,
          question_text: questionId,
          type_question: 'text',
          order,
        }).expect(201);
      }
      const res = await api('get', '/templates/TMPL_URT').expect(200);
      expect(res.body.data.sections.map((s: { section_id: string }) => s.section_id)).toEqual([
        first,
        later,
      ]);
      expect(
        res.body.data.sections[1].questions.map((q: { question_id: string }) => q.question_id),
      ).toEqual(['Q_URT_A', 'Q_URT_C']);
    });

    it('GET :id không tồn tại → 404 / 4101; mã sai định dạng → 400 / 2003', async () => {
      const missing = await api('get', '/templates/TMPL_KHONG_CO').expect(404);
      expect(missing.body).toEqual({ code: '4101', message: 'Template not found' });
      // Collation không phân biệt hoa/thường: không được khớp nhầm mẫu dev.
      const lower = await api('get', '/templates/tmpl_dev_sample').expect(400);
      expect(lower.body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
        data: { field: 'id' },
      });
    });

    it('PUT → 1000, data có description (MT-37); null xoá mô tả; ngừng dùng → lọc is_active=0', async () => {
      const res = await api('put', `/templates/${DEV}`)
        .send({ name: 'Tên mới', version: '1.1', description: 'Mô tả', is_active: '0' })
        .expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: {
          code_template: DEV,
          name: 'Tên mới',
          description: 'Mô tả',
          version: '1.1',
          is_active: '0',
          created_at: ISO,
          updated_at: ISO,
        },
      });
      const cleared = await api('put', `/templates/${DEV}`).send({ description: null }).expect(200);
      expect(cleared.body.data).toMatchObject({ description: null, name: 'Tên mới' });
      const inactive = await api('get', '/templates/all?is_active=0').expect(200);
      expect(inactive.body).toMatchObject({ total: 1, data: [{ code_template: DEV }] });
    });

    it.each([
      ['body rỗng', DEV, {}, 400, '2001'],
      ['không tồn tại', 'TMPL_KHONG_CO', { name: 'X' }, 404, '4101'],
      ['name chỉ có khoảng trắng', DEV, { name: '  ' }, 400, '2003'],
    ])('PUT %s → %s / %s', async (_name, code, body, status, responseCode) => {
      const res = await api('put', `/templates/${code}`).send(body).expect(status);
      expect(res.body).toMatchObject({ code: responseCode });
    });

    it('DELETE → 1000 {}; section, câu hỏi, lựa chọn bị CASCADE; xoá lại → 404 / 4101', async () => {
      const res = await api('delete', `/templates/${DEV}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      const counts = await prisma.$transaction([
        prisma.templates.count(),
        prisma.template_sections.count(),
        prisma.questions.count(),
        prisma.question_options.count(),
      ]);
      expect(counts).toEqual([0, 0, 0, 0]);

      const again = await api('delete', `/templates/${DEV}`).expect(404);
      expect(again.body).toEqual({ code: '4101', message: 'Template not found' });
    });
  });

  describe('sections', () => {
    it('POST → 201 / 1001 {section_id, template_id, title, order, is_required, filled_by} đều là string', async () => {
      const res = await createSection(DEV, { title: 'Tiền sử', order: 3, is_required: '1' }).expect(
        201,
      );
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          section_id: ID,
          template_id: DEV,
          title: 'Tiền sử',
          order: '3',
          is_required: '1',
          filled_by: null,
        },
      });
      await expect(
        prisma.template_sections.findUniqueOrThrow({
          where: { section_id: Number(res.body.data.section_id) },
        }),
      ).resolves.toMatchObject({ template_id: DEV, order: 3, is_required: true, filled_by: null });
    });

    it.each([
      ['mẫu không tồn tại', 'TMPL_KHONG_CO', {}, 404, '4101'],
      ['template_id sai định dạng', 'tmpl_x', {}, 400, '2003'],
      ['thiếu title', DEV, { title: undefined }, 400, '2001'],
      ['order âm', DEV, { order: '-1' }, 400, '2003'],
      ['filled_by ngoài danh sách', DEV, { filled_by: 'nurse' }, 400, '2003'],
    ])('POST %s → %s / %s, không ghi', async (_name, code, body, status, responseCode) => {
      const res = await createSection(code, body).expect(status);
      expect(res.body).toMatchObject({ code: responseCode });
      expect(await prisma.template_sections.count()).toBe(2);
    });

    it('PUT /templates/sections/:id → 1000 như POST (không bị PUT /templates/:id bắt nhầm)', async () => {
      const res = await api('put', `/templates/sections/${devSections[1]}`)
        .send({ title: 'Khám', order: '7', filled_by: 'patdoc' })
        .expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: {
          section_id: String(devSections[1]),
          template_id: DEV,
          title: 'Khám',
          order: '7',
          is_required: '0',
          filled_by: 'patdoc',
        },
      });
    });

    it.each([
      ['body rỗng', 'self', {}, 400, '2001'],
      ['không tồn tại', '999999', { title: 'X' }, 404, '4103'],
      ['id không phải số', 'abc', { title: 'X' }, 400, '2002'],
    ])('PUT %s → %s / %s', async (_name, id, body, status, responseCode) => {
      const path = `/templates/sections/${id === 'self' ? devSections[0] : id}`;
      const res = await api('put', path).send(body).expect(status);
      expect(res.body).toMatchObject({ code: responseCode });
    });

    it('DELETE → 1000 {}; câu hỏi và lựa chọn của section bị CASCADE; xoá lại → 404 / 4103', async () => {
      const res = await api('delete', `/templates/sections/${devSections[0]}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await prisma.template_sections.count()).toBe(1);
      expect((await prisma.questions.findMany()).map(({ question_id }) => question_id)).toEqual([
        'Q_DEV_NOTE',
      ]);
      expect(await prisma.question_options.count()).toBe(0);
      expect(await prisma.templates.count()).toBe(1);

      const again = await api('delete', `/templates/sections/${devSections[0]}`).expect(404);
      expect(again.body).toEqual({ code: '4103', message: 'Section not found' });
    });
  });

  describe('questions', () => {
    const radio = {
      question_id: 'Q_ITCH_AREA',
      question_text: 'Vùng ngứa?',
      type_question: 'checkbox',
      order: '3',
      placeholder: 'Chọn vùng',
      is_required: '1',
      help_text: 'Có thể chọn nhiều',
      allow_image: '1',
      options: [
        { option_text: 'Mặt', option_value: 'FACE', order: '2' },
        { option_text: 'Tay', option_value: 'HAND', order: 1, trigger_image_upload: '1' },
      ],
    };

    it('POST checkbox kèm lựa chọn → 201 / 1001 dạng câu hỏi đầy đủ, lựa chọn có id (string)', async () => {
      const res = await createQuestion(devSections[0], radio).expect(201);
      const [face, hand] = await optionIds('Q_ITCH_AREA');
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          question_id: 'Q_ITCH_AREA',
          section_id: String(devSections[0]),
          question_text: 'Vùng ngứa?',
          type_question: 'checkbox',
          placeholder: 'Chọn vùng',
          order: '3',
          is_required: '1',
          parent_question_id: null,
          show_if_answer: null,
          help_text: 'Có thể chọn nhiều',
          allow_image: '1',
          options: [
            {
              id: String(hand),
              option_text: 'Tay',
              option_value: 'HAND',
              order: '1',
              trigger_image_upload: '1',
            },
            {
              id: String(face),
              option_text: 'Mặt',
              option_value: 'FACE',
              order: '2',
              trigger_image_upload: '0',
            },
          ],
        },
      });
    });

    it('POST câu hỏi con (cha cùng mẫu, khác section) với show_if_answer → lưu JSON, trả mảng đã parse', async () => {
      const res = await createQuestion(devSections[1], {
        question_id: 'Q_ITCH_PHOTO',
        question_text: 'Ảnh vùng ngứa',
        type_question: 'image_upload',
        order: 2,
        parent_question_id: 'Q_DEV_HAS_ITCH',
        show_if_answer: '["YES"]',
      }).expect(201);
      expect(res.body.data).toMatchObject({
        parent_question_id: 'Q_DEV_HAS_ITCH',
        show_if_answer: ['YES'],
        options: [],
      });
      await expect(
        prisma.questions.findUniqueOrThrow({ where: { question_id: 'Q_ITCH_PHOTO' } }),
      ).resolves.toMatchObject({ show_if_answer: ['YES'], section_id: devSections[1] });
    });

    it('POST trùng question_id (kể cả ở mẫu khác) → 409 / 2003, không ghi', async () => {
      await createTemplate().expect(201);
      const section = (await createSection('TMPL_URT').expect(201)).body.data.section_id;
      const res = await createQuestion(Number(section), {
        question_id: 'Q_DEV_NOTE',
        question_text: 'Trùng',
        type_question: 'text',
        order: 1,
      }).expect(409);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
      await expect(
        prisma.questions.findUniqueOrThrow({ where: { question_id: 'Q_DEV_NOTE' } }),
      ).resolves.toMatchObject({ question_text: 'Ghi chú của bác sĩ' });
    });

    it('POST section không tồn tại → 404 / 4103', async () => {
      const res = await createQuestion(999_999, { ...radio }).expect(404);
      expect(res.body).toEqual({ code: '4103', message: 'Section not found' });
    });

    it('POST câu hỏi cha thuộc mẫu khác → 400 / 2003 (field parent_question_id)', async () => {
      await createTemplate().expect(201);
      const section = (await createSection('TMPL_URT').expect(201)).body.data.section_id;
      const res = await createQuestion(Number(section), {
        question_id: 'Q_URT_CHILD',
        question_text: 'Con',
        type_question: 'text',
        order: 1,
        parent_question_id: 'Q_DEV_HAS_ITCH',
      }).expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'parent_question_id' } });
    });

    it.each<[string, Record<string, unknown>, string, string]>([
      ['checkbox không có lựa chọn', { options: undefined }, '2001', 'options'],
      ['kiểu text mà gửi lựa chọn', { type_question: 'text' }, '2003', 'options'],
      [
        'option_value trùng nhau',
        { options: [radio.options[0], { ...radio.options[1], option_value: 'FACE' }] },
        '2003',
        'options',
      ],
      [
        'câu hỏi cha không tồn tại',
        { parent_question_id: 'Q_KHONG_CO' },
        '2003',
        'parent_question_id',
      ],
      [
        'câu hỏi cha là chính nó',
        { parent_question_id: 'Q_ITCH_AREA' },
        '2003',
        'parent_question_id',
      ],
      [
        'show_if_answer mà không có câu hỏi cha',
        { show_if_answer: '["YES"]' },
        '2003',
        'show_if_answer',
      ],
      [
        'show_if_answer không thuộc lựa chọn của câu hỏi cha',
        { parent_question_id: 'Q_DEV_HAS_ITCH', show_if_answer: '["MAYBE"]' },
        '2003',
        'show_if_answer',
      ],
      ['show_if_answer không phải JSON', { show_if_answer: 'YES' }, '2003', 'show_if_answer'],
      ['question_id sai định dạng', { question_id: 'q-1' }, '2003', 'question_id'],
      ['type_question ngoài enum', { type_question: 'label' }, '2003', 'type_question'],
      ['order sai', { order: 'abc' }, '2003', 'order'],
    ])('POST %s → 400 / %s (field %s), không ghi', async (_name, override, code, field) => {
      const res = await createQuestion(devSections[0], { ...radio, ...override }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.questions.count()).toBe(3);
      expect(await prisma.question_options.count()).toBe(2);
    });

    it('PUT → 1000 dạng câu hỏi đầy đủ; null xoá placeholder, help_text (không bị /templates/:id bắt nhầm)', async () => {
      await api('put', '/templates/questions/Q_DEV_NOTE')
        .send({ placeholder: 'Gợi ý', help_text: 'Trợ giúp' })
        .expect(200);
      const res = await api('put', '/templates/questions/Q_DEV_NOTE')
        .send({
          question_text: 'Ghi chú',
          order: '4',
          is_required: '1',
          placeholder: null,
          help_text: null,
        })
        .expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: {
          question_id: 'Q_DEV_NOTE',
          section_id: String(devSections[1]),
          question_text: 'Ghi chú',
          type_question: 'text',
          placeholder: null,
          order: '4',
          is_required: '1',
          parent_question_id: null,
          show_if_answer: null,
          help_text: null,
          allow_image: '0',
          options: [],
        },
      });
    });

    it('PUT options (upsert): có id → sửa giữ id, không id → tạo, lựa chọn cũ vắng mặt → xoá', async () => {
      const [yes, no] = await optionIds('Q_DEV_HAS_ITCH');
      const res = await api('put', '/templates/questions/Q_DEV_HAS_ITCH')
        .send({
          options: [
            {
              id: String(yes),
              option_text: 'Có ngứa',
              option_value: 'YES',
              order: '1',
              trigger_image_upload: '1',
            },
            { option_text: 'Không rõ', option_value: 'UNKNOWN', order: '2' },
          ],
        })
        .expect(200);
      const rows = await prisma.question_options.findMany({
        where: { question_id: 'Q_DEV_HAS_ITCH' },
        orderBy: { order: 'asc' },
      });
      expect(rows.map(({ id, option_value }) => [id, option_value])).toEqual([
        [yes, 'YES'],
        [expect.any(Number), 'UNKNOWN'],
      ]);
      expect(rows.some(({ id }) => id === no)).toBe(false);
      expect(res.body.data.options).toEqual([
        {
          id: String(yes),
          option_text: 'Có ngứa',
          option_value: 'YES',
          order: '1',
          trigger_image_upload: '1',
        },
        {
          id: String(rows[1]!.id),
          option_text: 'Không rõ',
          option_value: 'UNKNOWN',
          order: '2',
          trigger_image_upload: '0',
        },
      ]);
    });

    it('PUT options có id của câu hỏi khác → 400 / 2003, không đổi gì', async () => {
      await createQuestion(devSections[0], radio).expect(201);
      const [foreign] = await optionIds('Q_ITCH_AREA');
      const before = await optionIds('Q_DEV_HAS_ITCH');
      const res = await api('put', '/templates/questions/Q_DEV_HAS_ITCH')
        .send({
          question_text: 'Đổi',
          options: [{ id: String(foreign), option_text: 'Có', option_value: 'YES', order: 1 }],
        })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'options' } });
      expect(await optionIds('Q_DEV_HAS_ITCH')).toEqual(before);
      expect(await optionIds('Q_ITCH_AREA')).toHaveLength(2);
    });

    it('PUT đổi radio sang text kèm options [] → xoá hết lựa chọn; không gửi options → 2003', async () => {
      const kept = await api('put', '/templates/questions/Q_DEV_HAS_ITCH')
        .send({ type_question: 'text' })
        .expect(400);
      expect(kept.body).toMatchObject({ code: '2003', data: { field: 'options' } });

      const res = await api('put', '/templates/questions/Q_DEV_HAS_ITCH')
        .send({ type_question: 'text', options: [] })
        .expect(200);
      expect(res.body.data).toMatchObject({ type_question: 'text', options: [] });
      expect(await optionIds('Q_DEV_HAS_ITCH')).toEqual([]);
    });

    it.each<[string, string, Record<string, unknown>, number, string]>([
      ['body rỗng', 'Q_DEV_NOTE', {}, 400, '2001'],
      ['không tồn tại', 'Q_KHONG_CO', { order: 1 }, 404, '4104'],
      ['id sai định dạng', 'q_dev_note', { order: 1 }, 400, '2003'],
      ['radio với options rỗng', 'Q_DEV_HAS_ITCH', { options: [] }, 400, '2001'],
      ['câu hỏi cha là chính nó', 'Q_DEV_NOTE', { parent_question_id: 'Q_DEV_NOTE' }, 400, '2003'],
      [
        'câu hỏi cha là câu con của nó (tạo vòng)',
        'Q_DEV_HAS_ITCH',
        { parent_question_id: 'Q_DEV_ITCH_LEVEL' },
        400,
        '2003',
      ],
      [
        'bỏ câu hỏi cha mà vẫn giữ show_if_answer',
        'Q_DEV_ITCH_LEVEL',
        { parent_question_id: null },
        400,
        '2003',
      ],
      [
        'show_if_answer không thuộc lựa chọn của cha',
        'Q_DEV_ITCH_LEVEL',
        { show_if_answer: '["X"]' },
        400,
        '2003',
      ],
    ])('PUT %s → %s / %s, không ghi', async (_name, id, body, status, code) => {
      const before = await prisma.questions.findMany({ orderBy: { question_id: 'asc' } });
      const res = await api('put', `/templates/questions/${id}`).send(body).expect(status);
      expect(res.body).toMatchObject({ code });
      expect(await prisma.questions.findMany({ orderBy: { question_id: 'asc' } })).toEqual(before);
    });

    it('PUT đổi logic rẽ nhánh: show_if_answer khác, rồi chuyển thành câu hỏi gốc', async () => {
      const changed = await api('put', '/templates/questions/Q_DEV_ITCH_LEVEL')
        .send({ show_if_answer: '["YES","NO"]' })
        .expect(200);
      expect(changed.body.data).toMatchObject({
        parent_question_id: 'Q_DEV_HAS_ITCH',
        show_if_answer: ['YES', 'NO'],
      });
      const root = await api('put', '/templates/questions/Q_DEV_ITCH_LEVEL')
        .send({ parent_question_id: null, show_if_answer: null })
        .expect(200);
      expect(root.body.data).toMatchObject({ parent_question_id: null, show_if_answer: null });
      await expect(
        prisma.questions.findUniqueOrThrow({ where: { question_id: 'Q_DEV_ITCH_LEVEL' } }),
      ).resolves.toMatchObject({ parent_question_id: null, show_if_answer: null });
    });

    it('DELETE câu hỏi còn câu hỏi con → 409 / 2003 (MT-68); xoá con rồi xoá cha → 1000 {}, lựa chọn CASCADE', async () => {
      const blocked = await api('delete', '/templates/questions/Q_DEV_HAS_ITCH').expect(409);
      expect(blocked.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
      expect(await prisma.questions.count()).toBe(3);

      await api('delete', '/templates/questions/Q_DEV_ITCH_LEVEL').expect(200);
      const res = await api('delete', '/templates/questions/Q_DEV_HAS_ITCH').expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await prisma.questions.count()).toBe(1);
      expect(await prisma.question_options.count()).toBe(0);
    });

    it.each([
      ['không tồn tại', 'Q_KHONG_CO', 404, '4104'],
      ['id sai định dạng', 'Q-1', 400, '2003'],
    ])('DELETE %s → %s / %s', async (_name, id, status, code) => {
      const res = await api('delete', `/templates/questions/${id}`).expect(status);
      expect(res.body).toMatchObject({ code });
      expect(await prisma.questions.count()).toBe(3);
    });
  });
});
