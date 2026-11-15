import { LIMIT_DEFAULT, PAGE_DEFAULT, type Flag, type TemplateSummary } from '@drmayday/shared';
import { Button, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { usePageClamp } from '../../components/crud/use-page-clamp';
import { RowActions } from '../../admin/RowActions';
import { useDeleteTemplate, useTemplates } from '../../admin/templates-api';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { useDeleteAction } from '../../components/crud/use-run-action';
import { Page } from '../../layout/Page';
import { Panel, PanelToolbar } from '../../layout/Panel';
import { StatusBadge } from '../../theme/StatusBadge';
import { TemplateFormModal } from './templates/TemplateFormModal';
import {
  TEMPLATE_STATUS_OPTIONS,
  toTemplateFormValues,
  type TemplateFormValues,
} from './templates/template-form';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);
  const [statusFilter, setStatusFilter] = useState<Flag | undefined>();

  const { data, error, isPending, isPlaceholderData } = useTemplates({
    page,
    limit,
    is_active: statusFilter,
  });
  const remove = useDeleteTemplate();
  const deleteRow = useDeleteAction('mẫu phiếu');
  const modal = useEntityModal<TemplateFormValues, TemplateSummary>(toTemplateFormValues);

  usePageClamp({ data, isPlaceholderData, page, limit, setPage });

  return (
    <Page
      title="Mẫu phiếu khám"
      actions={
        <Button type="primary" onClick={modal.openCreate}>
          Thêm mẫu phiếu
        </Button>
      }
    >
      <QueryErrorAlert error={error} />
      <Panel flush>
        <PanelToolbar>
          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            aria-label="Lọc theo trạng thái"
            style={{ minWidth: 200 }}
            options={TEMPLATE_STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value: Flag | undefined) => {
              setStatusFilter(value);
              setPage(PAGE_DEFAULT);
            }}
          />
        </PanelToolbar>
        <EntityTable<TemplateSummary>
          rowKey="code_template"
          data={data?.items}
          loading={isPending || isPlaceholderData}
          onRowClick={(row) => void navigate(`/admin/templates/${row.code_template}`)}
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
              dataIndex: 'code_template',
              render: (code: string) => <span className="num">{code}</span>,
            },
            { title: 'Tên mẫu phiếu', dataIndex: 'name' },
            { title: 'Phiên bản', dataIndex: 'version' },
            {
              title: 'Trạng thái',
              dataIndex: 'is_active',
              render: (active: Flag) =>
                active === '1' ? (
                  <StatusBadge tone="green">Đang dùng</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Ngừng dùng</StatusBadge>
                ),
            },
            {
              title: 'Thao tác',
              render: (_, row) => (
                // Bấm nút không được mở trình thiết kế của dòng (sự kiện của Popconfirm cũng nổi bọt qua đây).
                <span onClick={(event) => event.stopPropagation()}>
                  <RowActions
                    onEdit={() => modal.openEdit(row)}
                    onDelete={() => deleteRow(() => remove.mutateAsync(row.code_template))}
                  />
                </span>
              ),
            },
          ]}
        />
      </Panel>
      <TemplateFormModal modal={modal} />
    </Page>
  );
}
