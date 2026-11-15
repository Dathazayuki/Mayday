import { Card, Tabs } from 'antd';
import { AssignmentTab } from './roles/AssignmentTab';
import { PermissionsTab } from './roles/PermissionsTab';
import { RolesTab } from './roles/RolesTab';

export function RolesPage() {
  return (
    <Card title="Vai trò và quyền hạn">
      <Tabs
        items={[
          { key: 'roles', label: 'Vai trò', children: <RolesTab /> },
          { key: 'permissions', label: 'Quyền hạn', children: <PermissionsTab /> },
          { key: 'assignment', label: 'Phân quyền', children: <AssignmentTab /> },
        ]}
      />
    </Card>
  );
}
