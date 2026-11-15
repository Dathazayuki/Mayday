import {
  GENDER_OPTIONS,
  LIMIT_DEFAULT,
  PAGE_DEFAULT,
  type Gender,
  type PatientSearchItem,
  type PatientSearchQuery,
} from '@drmayday/shared';
import { Button, Form, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { usePatientSearch } from '../../clinical/patients-api';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { usePageClamp } from '../../components/crud/use-page-clamp';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { Page } from '../../layout/Page';
import { Panel, PanelToolbar } from '../../layout/Panel';
import { AccountBadge } from './patients/AccountBadge';
import { CreatePatientModal } from './patients/CreatePatientModal';
import type { CreatePatientFormValues } from './patients/create-patient-request';

type Filters = Pick<PatientSearchQuery, 'keyword' | 'gender' | 'min_year' | 'max_year'>;

const GENDER_LABELS = Object.fromEntries(GENDER_OPTIONS.map((o) => [o.value, o.label]));

/** Tìm bệnh nhân (docpat01) và thêm bệnh nhân (docpat02); bấm dòng mở trang chi tiết (spec B, mục 8.2). */
export function PatientsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);
  const createModal = useEntityModal<CreatePatientFormValues, never>(() => ({}));

  const { data, error, isPending, isPlaceholderData } = usePatientSearch({
    ...filters,
    page,
    limit,
  });

  usePageClamp({ data, isPlaceholderData, page, limit, setPage });

  return (
    <Page
      title="Bệnh nhân"
      actions={<Button onClick={createModal.openCreate}>Thêm bệnh nhân</Button>}
    >
      <QueryErrorAlert error={error} />
      <Panel flush>
        <PanelToolbar>
          <Form<Filters>
            layout="inline"
            name="patient-filters"
            style={{ rowGap: 12 }}
            onFinish={(values) => {
              setFilters({
                keyword: values.keyword?.trim() || undefined,
                gender: values.gender,
                min_year: values.min_year ?? undefined,
                max_year: values.max_year ?? undefined,
              });
              setPage(PAGE_DEFAULT);
            }}
          >
            <Form.Item label="Từ khoá" name="keyword">
              <Input placeholder="Họ tên hoặc số điện thoại" allowClear />
            </Form.Item>
            <Form.Item label="Giới tính" name="gender">
              <Select<Gender>
                allowClear
                aria-label="Lọc theo giới tính"
                options={[...GENDER_OPTIONS]}
                style={{ minWidth: 120 }}
              />
            </Form.Item>
            <Form.Item label="Từ năm sinh" name="min_year">
              <InputNumber precision={0} />
            </Form.Item>
            <Form.Item label="Đến năm sinh" name="max_year">
              <InputNumber precision={0} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Tìm kiếm
            </Button>
          </Form>
        </PanelToolbar>
        <EntityTable<PatientSearchItem>
          rowKey="user_id"
          data={data?.items}
          loading={isPending || isPlaceholderData}
          onRowClick={(row) => navigate(`/patients/${row.user_id}`)}
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
            { title: 'Họ và tên', dataIndex: 'full_name' },
            { title: 'Số điện thoại', dataIndex: 'phone' },
            {
              title: 'Giới tính',
              dataIndex: 'gender',
              render: (gender: Gender | null) => (gender ? GENDER_LABELS[gender] : ''),
            },
            {
              title: 'Năm sinh',
              dataIndex: 'year_of_birth',
              render: (year: number | null) => year !== null && <span className="num">{year}</span>,
            },
            {
              title: 'Tài khoản',
              dataIndex: 'has_account',
              render: (hasAccount: boolean) => <AccountBadge hasAccount={hasAccount} />,
            },
          ]}
        />
      </Panel>
      <CreatePatientModal modal={createModal} />
    </Page>
  );
}
