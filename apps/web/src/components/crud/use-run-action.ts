import { describeError } from '@drmayday/shared';
import { App } from 'antd';

/** Chạy một thao tác ghi: thành công thì message.success, lỗi thì message.error(describeError). */
export function useRunAction() {
  const { message } = App.useApp();
  return async (action: () => Promise<unknown>, successText: string): Promise<boolean> => {
    try {
      await action();
      void message.success(successText);
      return true;
    } catch (err) {
      void message.error(describeError(err));
      return false;
    }
  };
}

/** Xoá một bản ghi: dùng với RowActions.onDelete, báo "Đã xoá <tên đối tượng>" khi thành công. */
export function useDeleteAction(entityLabel: string) {
  const run = useRunAction();
  return (remove: () => Promise<unknown>) => void run(remove, `Đã xoá ${entityLabel}`);
}
