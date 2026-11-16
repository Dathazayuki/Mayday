import {
  LIMIT_DEFAULT,
  MEDICAL_RECORD_STATUS_LABELS,
  MEDICAL_RECORD_STATUSES,
  PAGE_DEFAULT,
  type MedicalRecordCountsQuery,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type MedicalRecordStatusCounts,
  type RecordType,
} from '@drmayday/shared';
import { Space, Tabs } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMedicalRecords, useStatusCounts } from '../../../clinical/medical-records-api';
import { RecordTypeBadge } from '../../../clinical/record-type';
import { MedicalRecordStatusTag } from '../../../clinical/status';
import { EntityTable } from '../../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { usePageClamp } from '../../../components/crud/use-page-clamp';
import { EMPTY_VALUE, firstVisitText, formatDate } from '../../../lib/format-date';

/** Khoá tab "Tất cả" (không lọc trạng thái). */
const ALL = 'all';

const TABS: { key: typeof ALL | MedicalRecordStatus; label: string }[] = [
  { key: ALL, label: 'Tất cả' },
  ...MEDICAL_RECORD_STATUSES.map((status) => ({
    key: status,
    label: MEDICAL_RECORD_STATUS_LABELS[status],
  })),
];

function countOf(
  key: typeof ALL | MedicalRecordStatus,
  counts: MedicalRecordStatusCounts | undefined,
): number | undefined {
  if (!counts) return undefined;
  if (key !== ALL) return counts[key];
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** "Nháp (n)": số đếm từ status-counts, dùng phông số (`.num`). */
function TabLabel({ label, count }: { label: string; count: number | undefined }) {
  if (count === undefined) return label;
  return (
    <span>
      {label} <span className="num">({count})</span>
    </span>
  );
}

/**
 * Chế độ bảng của trang bệnh án (spec B, mục 8.5): tab theo trạng thái kèm số đếm (status-counts, cùng bộ
 * lọc), bảng phân trang phía server, bấm dòng → màn chi tiết. Trang về 1 khi đổi tab; trang bệnh án dựng
 * lại bảng (đổi `key`) khi đổi bộ lọc.
 */
export function RecordTable({
  filter,
  status,
  onStatusChange,
}: {
  filter: MedicalRecordCountsQuery;
  /** Tab đang chọn (tham số `status` trên URL); undefined = "Tất cả". */
  status: MedicalRecordStatus | undefined;
  onStatusChange: (status: MedicalRecordStatus | undefined) => void;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);
  const counts = useStatusCounts(filter);
  const { data, error, isPending, isPlaceholderData } = useMedicalRecords({
    ...filter,
    status,
    page,
    limit,
  });

  usePageClamp({ data, isPlaceholderData, page, limit, setPage });

  return (
    <>
      <Tabs
        className="dm-records-tabs"
        activeKey={status ?? ALL}
        onChange={(key) => {
          setPage(PAGE_DEFAULT);
          onStatusChange(key === ALL ? undefined : (key as MedicalRecordStatus));
        }}
        items={TABS.map(({ key, label }) => ({
          key,
          label: <TabLabel label={label} count={countOf(key, counts.data)} />,
        }))}
      />
      <QueryErrorAlert error={error ?? counts.error} />
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
            title: 'Mã',
            dataIndex: 'medical_record_id',
            render: (value: number) => <span className="num">#{value}</span>,
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
            render: (value: RecordType) => <RecordTypeBadge type={value} />,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
          },
          {
            title: 'Bác sĩ phụ trách',
            dataIndex: 'assigned_doctor_name',
            render: (value: string | null) => value ?? EMPTY_VALUE,
          },
          {
            title: 'Khám lần đầu',
            dataIndex: 'first_visit_at',
            render: (value: string | null) => firstVisitText(value),
          },
          {
            title: 'Lần khám gần nhất',
            key: 'last_visit',
            render: (_: unknown, row: MedicalRecordListItem) =>
              row.last_visit_date
                ? `${formatDate(row.last_visit_date)} · lần ${row.visit_count}`
                : EMPTY_VALUE,
          },
          {
            title: 'Hẹn tái khám',
            dataIndex: 'next_appointment_date',
            render: (value: string | null) => (value ? formatDate(value) : EMPTY_VALUE),
          },
        ]}
      />
    </>
  );
}
