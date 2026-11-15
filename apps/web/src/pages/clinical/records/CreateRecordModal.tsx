import {
  FIELD_LIMITS,
  LIMIT_DEFAULT,
  PAGE_DEFAULT,
  RECORD_TYPE_LABELS,
  RECORD_TYPES,
} from '@drmayday/shared';
import { DatePicker, Form, Input, Modal, Radio, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateMedicalRecord } from '../../../clinical/medical-records-api';
import { usePatientSearch } from '../../../clinical/patients-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import { useDebouncedValue } from '../../../lib/use-debounced-value';
import { toCreateRecordRequest, type CreateRecordFormValues } from './create-record-request';

/** Thời gian chờ sau phím cuối trước khi gọi API tìm bệnh nhân. */
const SEARCH_DEBOUNCE_MS = 300;

/** Bệnh nhân cố định khi mở từ trang bệnh nhân (spec B, mục 8.3). */
export interface FixedPatient {
  id: number;
  name: string;
  phone: string;
}

const patientLabel = (name: string, phone: string) => `${name} · ${phone}`;

const RECORD_TYPE_OPTIONS = RECORD_TYPES.map((type) => ({
  value: type,
  label: RECORD_TYPE_LABELS[type],
}));

/** Ô "Bệnh nhân" mở từ trang bệnh án: tìm từ xa qua GET /doctor/patients/search (spec B, mục 8.4). */
function PatientSearchSelect(props: {
  id?: string;
  value?: number;
  onChange?: (value: number) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isFetching } = usePatientSearch({
    keyword: debouncedKeyword || undefined,
    page: PAGE_DEFAULT,
    limit: LIMIT_DEFAULT,
  });
  return (
    <Select<number>
      {...props}
      showSearch={{ filterOption: false, onSearch: setKeyword }}
      placeholder="Tìm theo họ tên hoặc số điện thoại"
      loading={isFetching}
      notFoundContent={isFetching ? 'Đang tìm…' : 'Không tìm thấy bệnh nhân'}
      options={(data?.items ?? []).map((patient) => ({
        value: patient.user_id,
        label: patientLabel(patient.full_name, patient.phone),
      }))}
    />
  );
}

/**
 * Hộp "Tạo bệnh án" của nhân viên (spec B, mục 8.4): bệnh nhân (cố định khi mở từ trang bệnh nhân), loại
 * bệnh án (không đổi được sau khi tạo, D-B3), thời điểm đến khám lần đầu (để trống = bây giờ, D-B9), hai
 * chẩn đoán của khối self_report. Thành công → màn chi tiết bệnh án.
 */
export function CreateRecordModal({
  open,
  patient,
  onClose,
}: {
  open: boolean;
  patient?: FixedPatient;
  onClose: () => void;
}) {
  const [form] = Form.useForm<CreateRecordFormValues>();
  const create = useCreateMedicalRecord();
  const run = useRunAction();
  const navigate = useNavigate();

  async function submit(values: CreateRecordFormValues) {
    const ok = await run(async () => {
      const record = await create.mutateAsync(toCreateRecordRequest(values));
      navigate(`/medical-records/${record.medical_record_id}`);
    }, 'Đã tạo bệnh án');
    if (ok) onClose();
  }

  return (
    <Modal
      title="Tạo bệnh án"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Tạo bệnh án"
      cancelText="Huỷ"
      confirmLoading={create.isPending}
      destroyOnHidden
    >
      <Form<CreateRecordFormValues>
        form={form}
        name="create-record"
        layout="vertical"
        preserve={false}
        requiredMark={false}
        initialValues={{ patient_id: patient?.id }}
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="patient_id"
          label="Bệnh nhân"
          rules={[{ required: true, message: 'Vui lòng chọn bệnh nhân' }]}
        >
          {patient ? (
            <Select
              disabled
              options={[{ value: patient.id, label: patientLabel(patient.name, patient.phone) }]}
            />
          ) : (
            <PatientSearchSelect />
          )}
        </Form.Item>
        <Form.Item
          name="record_type"
          label="Loại bệnh án"
          extra="Không đổi được sau khi tạo"
          rules={[{ required: true, message: 'Vui lòng chọn loại bệnh án' }]}
        >
          <Radio.Group options={RECORD_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="first_visit_at"
          label="Đến khám lần đầu lúc"
          extra="Để trống: lấy thời điểm tạo bệnh án"
        >
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            placeholder="Bây giờ"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="referral_diagnosis" label="Chẩn đoán tuyến trước">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={FIELD_LIMITS.clinical_text}
          />
        </Form.Item>
        <Form.Item name="initial_clinic_diagnosis" label="Chẩn đoán phòng khám ban đầu">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={FIELD_LIMITS.clinical_text}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
