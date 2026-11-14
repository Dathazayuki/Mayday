import { BellOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  describeError,
  isUnread,
  NOTIFICATION_TYPE_LABELS,
  type NotificationData,
} from '@drmayday/shared';
import { App, Badge, Button, List, Popconfirm, Popover, Space } from 'antd';
import { useNavigate } from 'react-router';
import { useRunAction } from '../components/crud/use-run-action';
import { formatDateTime } from '../lib/format-date';
import { countUnread, notificationPath } from '../notifications/notification-utils';
import {
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
} from '../notifications/notifications-api';

function NotificationList({ items, loading }: { items: NotificationData[]; loading: boolean }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const run = useRunAction();
  const markRead = useMarkNotificationRead();
  const remove = useDeleteNotification();

  function open(notification: NotificationData) {
    if (isUnread(notification)) {
      markRead.mutate(notification.id, {
        onError: (error) => void message.error(describeError(error)),
      });
    }
    const path = notificationPath(notification);
    if (path) navigate(path);
  }

  return (
    <List
      style={{ width: 360, maxHeight: 420, overflowY: 'auto' }}
      size="small"
      loading={loading}
      dataSource={items}
      locale={{ emptyText: 'Không có thông báo' }}
      renderItem={(notification) => (
        <List.Item
          style={{ cursor: 'pointer' }}
          onClick={() => open(notification)}
          actions={[
            <Popconfirm
              key="delete"
              title="Xoá thông báo này?"
              okText="Xoá"
              cancelText="Không"
              onConfirm={(event) => {
                event?.stopPropagation();
                void run(() => remove.mutateAsync(notification.id), 'Đã xoá thông báo');
              }}
              onCancel={(event) => event?.stopPropagation()}
            >
              <Button
                type="text"
                size="small"
                aria-label="Xoá thông báo"
                icon={<DeleteOutlined />}
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>,
          ]}
        >
          <Space orientation="vertical" size={0}>
            <span style={{ fontWeight: isUnread(notification) ? 700 : 400 }}>
              {notification.title}
            </span>
            <span>{notification.body}</span>
            <small>
              {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type} ·{' '}
              {formatDateTime(notification.created_at)}
            </small>
          </Space>
        </List.Item>
      )}
    />
  );
}

/** Chuông thông báo ở header: số chưa đọc (trang đầu) và danh sách đánh dấu đã đọc/xoá. */
export function NotificationBell() {
  const { data, isPending } = useNotifications();
  const items = data?.items ?? [];
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={<NotificationList items={items} loading={isPending} />}
    >
      <Badge count={countUnread(items)} size="small">
        <Button type="text" aria-label="Thông báo" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  );
}
