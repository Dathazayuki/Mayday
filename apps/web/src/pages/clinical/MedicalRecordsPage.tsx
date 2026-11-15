import {
  LIMIT_DEFAULT,
  MEDICAL_RECORD_STATUS_LABELS,
  MEDICAL_RECORD_STATUSES,
  PAGE_DEFAULT,
  RECORD_TYPE_LABELS,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type RecordType,
} from '@drmayday/shared';
import { Select, Space } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMedicalRecords } from '../../clinical/medical-records-api';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { formatDateTime } from '../../lib/format-date';
import { Page } from '../../layout/Page';
import { Panel, PanelToolbar } from '../../layout/Panel';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { usePageClamp } from '../../components/crud/use-page-clamp';

const STATUS_OPTIONS = MEDICAL_RECORD_STATUSES.map((value) => ({
  value,
  label: MEDICAL_RECORD_STATUS_LABELS[value],
}));

/** Danh sách mọi bệnh án (contract mới của spec B); trang bảng/cột, tab số đếm làm ở B4. */
export function MedicalRecordsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MedicalRecordStatus | undefined>();
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);

  const { data, error, isPending, isPlaceholderData } = useMedicalRecords({ status, page, limit });

  usePageClamp({ data, isPlaceholderData, page, limit, setPage });

  return (
    <Page title="Bệnh án">
      <QueryErrorAlert error={error} />
      <Panel flush>
        <PanelToolbar>
          <Select<MedicalRecordStatus>
            allowClear
            placeholder="Tất cả trạng thái"
            aria-label="Lọc theo trạng thái"
            style={{ minWidth: 200 }}
            options={STATUS_OPTIONS}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(PAGE_DEFAULT);
            }}
          />
        </PanelToolbar>
        <EntityTable<MedicalRecordListItem>
          rowKey="medical_record_id"
          data={data?.items}
          loading={isPending || isPlaceholderData}
          onRowClick={(row) => navigate(`/medical-records/${row.medical_record_id}`)}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (nextPage, nextLimit) => {
              setPage(nextPage);
              setLimit(nextLimit);
            },
          }}
          columns={[
            {
              title: 'Mã bệnh án',
              dataIndex: 'medical_record_id',
              render: (value: number) => <span className="num">{value}</span>,
            },
            {
              title: 'Bệnh nhân',
              key: 'patient',
              render: (_: unknown, row: MedicalRecordListItem) => (
                <Space orientation="vertical" size={0}>
                  <span>{row.patient_name}</span>
                  <span className="num">{row.patient_phone}</span>
                </Space>
              ),
            },
            {
              title: 'Loại',
              dataIndex: 'record_type',
              render: (value: RecordType) => RECORD_TYPE_LABELS[value],
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
            },
            {
              title: 'Bác sĩ phụ trách',
              dataIndex: 'assigned_doctor_name',
              render: (value: string | null) => value ?? '—',
            },
            {
              title: 'Khám lần đầu',
              dataIndex: 'first_visit_at',
              render: (value: string | null) => (value ? formatDateTime(value) : '—'),
            },
          ]}
        />
      </Panel>
    </Page>
  );
}
