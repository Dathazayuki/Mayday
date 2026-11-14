import {
  CAREER_OPTIONS,
  GENDER_OPTIONS,
  describeError,
  isPatientProfile,
  isValidIsoDate,
  isValidVietnamPhone,
  isValidYearOfBirth,
  type PatientProfileData,
  type ProfileData,
} from '@drmayday/shared';
import { Alert, Button, Card, Form, Input, InputNumber, Select, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { useProfile, useUpdateProfile } from '../profile/profile-api';
import { buildProfileChanges, toFormValues, type ProfileFormValues } from '../profile/profile-form';

type Notice = { type: 'success' | 'error' | 'info'; text: string };

/** Trường văn bản của bệnh nhân (theo thứ tự hiển thị), kèm quy tắc kiểm tra riêng nếu có. */
const PATIENT_TEXT_FIELDS: {
  name: keyof PatientProfileData;
  label: string;
  validate?: (value: string) => boolean;
  invalidMessage?: string;
}[] = [
  { name: 'ethnic', label: 'Dân tộc' },
  { name: 'hamlet_address', label: 'Thôn/Xóm' },
  { name: 'commune_address', label: 'Xã/Phường' },
  { name: 'city_address', label: 'Tỉnh/Thành phố' },
  { name: 'work_place', label: 'Nơi làm việc' },
  { name: 'health_insurance_number', label: 'Số thẻ BHYT' },
  {
    name: 'health_insurance_validate',
    label: 'Hạn thẻ BHYT',
    validate: isValidIsoDate,
    invalidMessage: 'Ngày không đúng định dạng YYYY-MM-DD',
  },
  { name: 'next_of_kin_name', label: 'Người thân' },
  {
    name: 'next_of_kin_phone',
    label: 'Số điện thoại người thân',
    validate: isValidVietnamPhone,
    invalidMessage: 'Số điện thoại không đúng định dạng (VD: 0912345678)',
  },
];

function PatientFields({ profile }: { profile: PatientProfileData }) {
  return (
    <>
      <Form.Item
        label="Năm sinh"
        name="year_of_birth"
        rules={[
          {
            validator: (_, value: number | null | undefined) =>
              value == null || isValidYearOfBirth(value)
                ? Promise.resolve()
                : Promise.reject(new Error('Năm sinh không hợp lệ')),
          },
        ]}
      >
        <InputNumber min={1900} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Nghề nghiệp" name="career">
        <Select allowClear options={[...CAREER_OPTIONS]} />
      </Form.Item>
      {PATIENT_TEXT_FIELDS.map(({ name, label, validate, invalidMessage }) => (
        <Form.Item
          key={name}
          label={label}
          name={name}
          rules={
            validate
              ? [
                  {
                    validator: (_, value: string | null | undefined) =>
                      !value?.trim() || validate(value.trim())
                        ? Promise.resolve()
                        : Promise.reject(new Error(invalidMessage)),
                  },
                ]
              : undefined
          }
        >
          <Input />
        </Form.Item>
      ))}
      <Form.Item label="Lần khám đầu tiên">
        <Typography.Text>
          {profile.first_visit ? new Date(profile.first_visit).toLocaleString('vi-VN') : 'Chưa có'}
        </Typography.Text>
      </Form.Item>
    </>
  );
}

function ProfileForm({ profile }: { profile: ProfileData }) {
  const [form] = Form.useForm<ProfileFormValues>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const { mutateAsync, isPending } = useUpdateProfile();

  async function handleFinish(values: ProfileFormValues) {
    const changes = buildProfileChanges(profile, values);
    if (Object.keys(changes).length === 0) {
      setNotice({ type: 'info', text: 'Chưa có thay đổi nào để lưu' });
      return;
    }
    try {
      const saved = await mutateAsync(changes);
      form.setFieldsValue(toFormValues(saved));
      setNotice({ type: 'success', text: 'Đã lưu hồ sơ' });
    } catch (err) {
      setNotice({ type: 'error', text: describeError(err) });
    }
  }

  return (
    <Form<ProfileFormValues>
      form={form}
      layout="vertical"
      initialValues={toFormValues(profile)}
      onFinish={handleFinish}
      requiredMark={false}
    >
      {notice && <Alert type={notice.type} showIcon title={notice.text} style={{ marginBottom: 16 }} />}
      <Form.Item
        label="Họ và tên"
        name="full_name"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập họ và tên' },
          { max: 255, message: 'Họ và tên tối đa 255 ký tự' },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Số điện thoại" htmlFor="profile-phone">
        <Input id="profile-phone" value={profile.phone} disabled />
      </Form.Item>
      <Form.Item label="Giới tính" name="gender">
        <Select allowClear options={[...GENDER_OPTIONS]} />
      </Form.Item>
      {isPatientProfile(profile) && <PatientFields profile={profile} />}
      <Button type="primary" htmlType="submit" loading={isPending}>
        Lưu
      </Button>
    </Form>
  );
}

export function ProfilePage() {
  const { data, error, isPending } = useProfile();

  return (
    <Card title="Hồ sơ cá nhân" style={{ maxWidth: 640 }}>
      {isPending && <Skeleton active />}
      {error && <Alert type="error" showIcon title={describeError(error)} />}
      {data && <ProfileForm profile={data} />}
    </Card>
  );
}
