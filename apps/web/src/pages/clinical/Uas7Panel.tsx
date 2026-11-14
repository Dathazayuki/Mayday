import { UAS7_FIELD_LABELS, UAS7_WEEK_MAX, type Uas7ScoreData } from '@drmayday/shared';
import { Card, Descriptions, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { usePatientUas7History, useUas7Week } from '../../clinical/uas7-api';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';

const COLUMNS: ColumnsType<Uas7ScoreData> = [
  { title: 'Ngày', dataIndex: 'score_date' },
  { title: UAS7_FIELD_LABELS.iss7, dataIndex: 'iss7' },
  { title: UAS7_FIELD_LABELS.hss7, dataIndex: 'hss7' },
  { title: 'Tổng ngày', dataIndex: 'daily_score' },
  { title: 'Ghi chú', dataIndex: 'note', render: (note: string | null) => note ?? '' },
];

/** Điểm UAS7 của bệnh nhân: tổng 7 ngày gần nhất và lịch sử chấm điểm từng ngày. */
export function Uas7Panel({ patientId }: { patientId: number }) {
  const week = useUas7Week(patientId);
  const history = usePatientUas7History(patientId);
  return (
    <Card title="Điểm UAS7" style={{ marginBottom: 16 }}>
      <QueryErrorAlert error={week.error ?? history.error} />
      {week.data && (
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Tổng tuần">
            {week.data.week_score}/{UAS7_WEEK_MAX}
          </Descriptions.Item>
          <Descriptions.Item label="Mức độ">{week.data.severity_label}</Descriptions.Item>
          <Descriptions.Item label="Đã chấm">{week.data.completed_days}/7 ngày</Descriptions.Item>
          <Descriptions.Item label="Kỳ tính">
            {week.data.start_date} → {week.data.end_date}
          </Descriptions.Item>
        </Descriptions>
      )}
      <Table
        rowKey="score_date"
        size="small"
        pagination={false}
        loading={history.isPending}
        columns={COLUMNS}
        dataSource={history.data ?? []}
        locale={{ emptyText: 'Bệnh nhân chưa chấm điểm UAS7' }}
      />
    </Card>
  );
}
