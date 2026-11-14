import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_PATHS,
  NOTIFICATION_TYPE_LABELS,
  isUnread,
} from './contracts/notifications.js';

describe('NOTIFICATION_PATHS', () => {
  it('đường dẫn đăng ký token', () => {
    expect(NOTIFICATION_PATHS.registerToken).toBe('/notifications/register_token');
  });

  it('đường dẫn đánh dấu đã đọc', () => {
    expect(NOTIFICATION_PATHS.markRead('12')).toBe('/notifications/12/read');
  });
});

describe('NOTIFICATION_TYPE_LABELS', () => {
  it.each([
    'appointment',
    'lab_result',
    'general',
    'prescription',
    'lab_request',
    'medical_record',
  ])('có nhãn cho loại %s', (type) => {
    expect(NOTIFICATION_TYPE_LABELS[type]).toEqual(expect.any(String));
  });
});

describe('isUnread', () => {
  it('thông báo có is_read = "0" là chưa đọc', () => {
    expect(isUnread({ is_read: '0' })).toBe(true);
    expect(isUnread({ is_read: '1' })).toBe(false);
  });
});
