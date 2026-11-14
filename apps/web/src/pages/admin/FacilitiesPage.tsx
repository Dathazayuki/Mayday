import { Card, Tabs } from 'antd';
import { BranchesTab } from './facilities/BranchesTab';
import { DepartmentsTab } from './facilities/DepartmentsTab';
import { RoomsTab } from './facilities/RoomsTab';

export function FacilitiesPage() {
  return (
    <Card title="Cơ sở vật chất">
      <Tabs
        items={[
          { key: 'branches', label: 'Chi nhánh', children: <BranchesTab /> },
          { key: 'departments', label: 'Khoa', children: <DepartmentsTab /> },
          { key: 'rooms', label: 'Phòng', children: <RoomsTab /> },
        ]}
      />
    </Card>
  );
}
