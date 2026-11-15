import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityTable } from './EntityTable';

interface Row {
  id: number;
  name: string;
}

const COLUMNS = [{ title: 'Tên', dataIndex: 'name' }];

describe('EntityTable', () => {
  it('có onRowClick: dòng là liên kết focus được, Enter mở dòng như bấm chuột', async () => {
    const onRowClick = vi.fn();
    render(
      <EntityTable<Row>
        data={[{ id: 1, name: 'Dòng một' }]}
        loading={false}
        columns={COLUMNS}
        onRowClick={onRowClick}
      />,
    );
    const row = screen.getByRole('link', { name: /Dòng một/ });
    expect(row).toHaveAttribute('tabindex', '0');

    await userEvent.tab();
    // Tab đầu tiên rơi vào dòng: không có phần tử focus được nào khác trước nó.
    expect(row).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: 'Dòng một' });
  });

  it('không có onRowClick: dòng không phải liên kết', () => {
    render(
      <EntityTable<Row> data={[{ id: 1, name: 'Dòng một' }]} loading={false} columns={COLUMNS} />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('emptyText thay chữ mặc định khi không có dòng', () => {
    render(
      <EntityTable<Row> data={[]} loading={false} columns={COLUMNS} emptyText="Chưa có dòng" />,
    );
    expect(screen.getByText('Chưa có dòng')).toBeInTheDocument();
  });
});
