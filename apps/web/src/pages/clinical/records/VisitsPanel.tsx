import type { MedicalRecordData, VisitData } from '@drmayday/shared';
import { Button, Collapse, Empty, Skeleton } from 'antd';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useVisits } from '../../../clinical/visits-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { Panel } from '../../../layout/Panel';
import { formatDate } from '../../../lib/format-date';
import { VisitForm } from './VisitForm';

/** Id của panel: "Thêm phiên khám" trên thẻ của bảng cột mở `/medical-records/:id#visits` (B4). */
const VISITS_ANCHOR = 'visits';

/** "Lần n · dd/MM/yyyy · BS … · phòng …" (spec B, mục 8.7). */
function visitTitle(visit: VisitData): string {
  return [
    `Lần ${visit.visit_number}`,
    formatDate(visit.visit_date),
    `BS ${visit.doctor_name}`,
    visit.room_name ?? 'Chưa phân phòng',
  ].join(' · ');
}

/**
 * Panel "Phiên khám" (spec B, mục 8.7): mỗi phiên một mục `Collapse`, mở ra là `VisitForm`. Nút "Thêm
 * phiên khám" khi có `add_visit`; sửa phiên khi có `edit_visits`. Mở trang với `#visits` thì cuộn tới panel.
 */
export function VisitsPanel({
  record,
  onAddVisit,
}: {
  record: MedicalRecordData;
  onAddVisit: () => void;
}) {
  const { data, error, isPending } = useVisits(record.medical_record_id);
  const { hash } = useLocation();
  const allowed = record.allowed_actions;

  useEffect(() => {
    if (hash === `#${VISITS_ANCHOR}` && !isPending) {
      document.getElementById(VISITS_ANCHOR)?.scrollIntoView({ block: 'start' });
    }
  }, [hash, isPending]);

  return (
    <Panel
      id={VISITS_ANCHOR}
      role="region"
      aria-label="Phiên khám"
      title="Phiên khám"
      extra={
        allowed.includes('add_visit') ? (
          <Button size="small" type="primary" onClick={onAddVisit}>
            Thêm phiên khám
          </Button>
        ) : null
      }
    >
      <QueryErrorAlert error={error} />
      {isPending ? (
        <Skeleton active />
      ) : data && data.length > 0 ? (
        <Collapse
          items={data.map((visit) => ({
            key: visit.visit_id,
            label: visitTitle(visit),
            children: (
              <VisitForm
                visit={visit}
                recordType={record.record_type}
                editable={allowed.includes('edit_visits')}
              />
            ),
          }))}
        />
      ) : (
        !error && <Empty description="Chưa có phiên khám" />
      )}
    </Panel>
  );
}
