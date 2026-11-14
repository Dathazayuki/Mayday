import {
  GENDER_OPTIONS,
  describeError,
  isPatientProfile,
  type PatientProfileData,
  type ProfileData,
} from '@drmayday/shared';
import { Alert, Button, Card, Form, Input, Select, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { formatDateTime } from '../lib/format-date';
import { PatientEditableFields } from '../profile/PatientEditableFields';
import { useProfile, useUpdateProfile } from '../profile/profile-api';
import { buildProfileChanges, toFormValues, type ProfileFormValues } from '../profile/profile-form';

type Notice = { type: 'success' | 'error' | 'info'; text: string };

function PatientFields({ profile }: { profile: PatientProfileData }) {
  return (
    <>
      <PatientEditableFields />
      <Form.Item label="Lần khám đầu tiên">
        <Typography.Text>
          {profile.first_visit ? formatDateTime(profile.first_visit) : 'Chưa có'}
        </Typography.Text>
      </Form.Item>
    </>
  );
}

function ProfileForm({ profile }: { profile: ProfileData }) {
  const [form] = Form.useForm<ProfileFormValues>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const { mutateAsync, isPending } = useUpdateProfile();
  // Bản chụp lúc khởi tạo form (cập nhật sau khi lưu): mốc so sánh, không đổi theo refetch nền.
  const [initial, setInitial] = useState(() => toFormValues(profile));

  async function handleFinish(values: ProfileFormValues) {
    const changes = buildProfileChanges(initial, values);
    if (Object.keys(changes).length === 0) {
      setNotice({ type: 'info', text: 'Chưa có thay đổi nào để lưu' });
      return;
    }
    try {
      const saved = await mutateAsync(changes);
      const savedValues = toFormValues(saved);
      setInitial(savedValues);
      form.setFieldsValue(savedValues);
      setNotice({ type: 'success', text: 'Đã lưu hồ sơ' });
    } catch (err) {
      setNotice({ type: 'error', text: describeError(err) });
    }
  }

  return (
    <Form<ProfileFormValues>
      form={form}
      layout="vertical"
      initialValues={initial}
      onFinish={handleFinish}
      requiredMark={false}
    >
      {notice && (
        <Alert type={notice.type} showIcon title={notice.text} style={{ marginBottom: 16 }} />
      )}
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
