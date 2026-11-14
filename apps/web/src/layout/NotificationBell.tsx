import { BellOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  describeError,
  isUnread,
  NOTIFICATION_TYPE_LABELS,
  type NotificationData,
} from '@drmayday/shared';
import { App, Badge, Button, Popconfirm, Popover, Space } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ItemList } from '../components/ItemList';
import { QueryErrorAlert } from '../components/crud/QueryErrorAlert';
import { useRunAction } from '../components/crud/use-run-action';
import { formatDateTime } from '../lib/format-date';
import { notificationPath } from '../notifications/notification-utils';
import {
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
} from '../notifications/notifications-api';

function NotificationList({
  items,
  loading,
  onNavigate,
}: {
  items: NotificationData[];
  loading: boolean;
  onNavigate: () => void;
}) {
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
    if (path) {
      onNavigate();
      navigate(path);
    }
  }

  return (
    <ItemList
      style={{ width: 360, maxHeight: 420, overflowY: 'auto' }}
      loading={loading}
      items={items}
      rowKey={(notification) => notification.id}
      emptyText="Không có thông báo"
      renderItem={(notification) => (
        <>
          <div
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', flex: 1 }}
            onClick={() => open(notification)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open(notification);
              }
            }}
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
          </div>
          <Popconfirm
            title="Xoá thông báo này?"
            okText="Xoá"
            cancelText="Không"
            onConfirm={() =>
              void run(() => remove.mutateAsync(notification.id), 'Đã xoá thông báo')
            }
          >
            <Button type="text" size="small" aria-label="Xoá thông báo" icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      )}
    />
  );
}

/** Chuông thông báo ở header: số chưa đọc (trang đầu) và danh sách đánh dấu đã đọc/xoá. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, error, isPending } = useNotifications();
  const items = data?.items ?? [];
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      content={
        <>
          <QueryErrorAlert error={error} />
          {!error && (
            <NotificationList items={items} loading={isPending} onNavigate={() => setOpen(false)} />
          )}
        </>
      }
    >
      <Badge count={items.filter(isUnread).length} size="small">
        <Button type="text" aria-label="Thông báo" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  );
}
