import { Tabs } from 'antd';
import { AssignmentTab } from './roles/AssignmentTab';
import { PermissionsTab } from './roles/PermissionsTab';
import { RolesTab } from './roles/RolesTab';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';

export function RolesPage() {
  return (
    <Page title="Vai trò và quyền hạn">
      <Panel>
        <Tabs
          items={[
            { key: 'roles', label: 'Vai trò', children: <RolesTab /> },
            { key: 'permissions', label: 'Quyền hạn', children: <PermissionsTab /> },
            { key: 'assignment', label: 'Phân quyền', children: <AssignmentTab /> },
          ]}
        />
      </Panel>
    </Page>
  );
}
