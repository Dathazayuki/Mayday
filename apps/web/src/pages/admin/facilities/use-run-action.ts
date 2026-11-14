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
