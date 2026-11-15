import type { NotificationData } from '@drmayday/shared';
import { notificationPath } from './notification-utils';

const make = (patch: Partial<NotificationData>): NotificationData => ({
  id: '1',
  user_id: '1',
  title: 't',
  body: 'b',
  type: 'general',
  avatar: null,
  reference_id: null,
  is_read: '0',
  created_at: '',
  updated_at: '',
  ...patch,
});

describe('notificationPath', () => {
  it('chỉ type medical_record có reference_id mới có đường dẫn', () => {
    expect(notificationPath(make({ type: 'medical_record', reference_id: '9' }))).toBe(
      '/medical-records/9',
    );
    expect(notificationPath(make({ type: 'medical_record', reference_id: null }))).toBeNull();
    expect(notificationPath(make({ type: 'prescription', reference_id: '9' }))).toBeNull();
  });
});
