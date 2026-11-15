import { Tabs } from 'antd';
import { BranchesTab } from './facilities/BranchesTab';
import { RoomsTab } from './facilities/RoomsTab';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';

export function FacilitiesPage() {
  return (
    <Page title="Cơ sở vật chất">
      <Panel>
        <Tabs
          items={[
            { key: 'branches', label: 'Chi nhánh', children: <BranchesTab /> },
            { key: 'rooms', label: 'Phòng', children: <RoomsTab /> },
          ]}
        />
      </Panel>
    </Page>
  );
}
