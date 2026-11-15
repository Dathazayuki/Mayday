import {
  MEDICAL_RECORD_STATUS_LABELS,
  vietnamDate,
  type DashboardList,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type MedicalRecordStatusCounts,
  type TodayVisitItem,
} from '@drmayday/shared';
import { Empty, Skeleton, Space } from 'antd';
import { Link, useNavigate } from 'react-router';
import { useDashboardSummary } from '../clinical/dashboard-api';
import { MedicalRecordStatusTag } from '../clinical/status';
import { EntityTable } from '../components/crud/EntityTable';
import { QueryErrorAlert } from '../components/crud/QueryErrorAlert';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';
import { formatDate } from '../lib/format-date';
import { useIsPatient } from '../profile/use-is-patient';
import { RecordCardSummary } from './clinical/records/RecordCard';

/** Ba ô số liệu chính (spec B, mục 8.8); Nháp và Đã huỷ ở dòng phụ. */
const MAIN_STATUSES: readonly MedicalRecordStatus[] = ['pending', 'in_progress', 'completed'];

/** Tổng số của một khối danh sách, đặt ở góc phải Panel. */
function Total({ value }: { value: number }) {
  return (
    <span>
      Tổng <span className="num">{value}</span>
    </span>
  );
}

/** Hàng ô số liệu: bấm ô → bảng bệnh án lọc theo trạng thái đó. */
function StatTiles({ counts }: { counts: MedicalRecordStatusCounts }) {
  return (
    <>
      <div className="dm-stats">
        {MAIN_STATUSES.map((status) => (
          <Link
            key={status}
            className="dm-stat"
            to={`/medical-records?view=table&status=${status}`}
          >
            <Panel>
              <div className="dm-stat__label">{MEDICAL_RECORD_STATUS_LABELS[status]}</div>
              <div className="dm-stat__value num">{counts[status]}</div>
            </Panel>
          </Link>
        ))}
      </div>
      <div className="dm-stats__more">
        {MEDICAL_RECORD_STATUS_LABELS.draft} <span className="num">{counts.draft}</span> ·{' '}
        {MEDICAL_RECORD_STATUS_LABELS.cancelled} <span className="num">{counts.cancelled}</span>
      </div>
    </>
  );
}

/** "Phiên khám hôm nay": tổng + tối đa 10 dòng; bấm dòng → màn chi tiết bệnh án. */
function VisitsTodayPanel({ visits }: { visits: DashboardList<TodayVisitItem> }) {
  const navigate = useNavigate();
  return (
    <Panel title="Phiên khám hôm nay" extra={<Total value={visits.total} />} flush>
      <EntityTable<TodayVisitItem>
        rowKey="visit_id"
        data={visits.items}
        loading={false}
        onRowClick={(row) => navigate(`/medical-records/${row.medical_record_id}`)}
        columns={[
          {
            title: 'Mã hồ sơ',
            dataIndex: 'medical_record_id',
            render: (value: number) => <span className="num">#{value}</span>,
          },
          { title: 'Bệnh nhân', dataIndex: 'patient_name' },
          {
            title: 'Lần khám',
            dataIndex: 'visit_number',
            render: (value: number) => `Lần ${value}`,
          },
          { title: 'Bác sĩ', dataIndex: 'doctor_name' },
          {
            title: 'Phòng',
            dataIndex: 'room_name',
            render: (value: string | null) => value ?? 'Chưa phân phòng',
          },
          {
            title: 'Trạng thái hồ sơ',
            dataIndex: 'record_status',
            render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
          },
        ]}
      />
    </Panel>
  );
}

/** "Bệnh án tôi phụ trách": tổng + tối đa 10 thẻ rút gọn, link sang bảng cột lọc "Tôi phụ trách". */
function MyQueuePanel({ queue }: { queue: DashboardList<MedicalRecordListItem> }) {
  return (
    <Panel
      title="Bệnh án tôi phụ trách"
      extra={
        <Space size={16}>
          <Total value={queue.total} />
          <Link to="/medical-records?view=board&mine=1">Xem trên bảng cột</Link>
        </Space>
      }
    >
      {queue.items.length === 0 ? (
        <Empty description="Không có bệnh án đang khám" />
      ) : (
        <div className="dm-queue">
          {queue.items.map((record) => (
            <Link
              key={record.medical_record_id}
              className="dm-card"
              to={`/medical-records/${record.medical_record_id}`}
              aria-label={`Bệnh án #${record.medical_record_id}`}
            >
              <RecordCardSummary record={record} />
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Tổng quan tối thiểu (spec B, mục 8.8; MT-123 đã chốt): số bệnh án theo trạng thái, phiên khám hôm nay,
 * bệnh án tôi phụ trách (chỉ khi `my_queue` khác null). Web dành cho nhân viên (docs/01 dòng 24): bệnh
 * nhân chỉ thấy lời nhắn, không gọi API.
 */
export function DashboardPage() {
  const isPatient = useIsPatient();
  const { data, error } = useDashboardSummary(isPatient === false);
  const subtitle = `Hôm nay ${formatDate(data?.today ?? vietnamDate())}`;

  if (isPatient === true) {
    return (
      <Page title="Tổng quan" subtitle={subtitle}>
        <Panel>
          <Empty description="Trang web dành cho nhân viên y tế. Bệnh nhân vui lòng dùng ứng dụng di động" />
        </Panel>
      </Page>
    );
  }
  return (
    <Page title="Tổng quan" subtitle={subtitle}>
      <QueryErrorAlert error={error} />
      {data ? (
        <>
          <StatTiles counts={data.status_counts} />
          <VisitsTodayPanel visits={data.visits_today} />
          {data.my_queue && <MyQueuePanel queue={data.my_queue} />}
        </>
      ) : (
        !error && <Skeleton active />
      )}
    </Page>
  );
}
