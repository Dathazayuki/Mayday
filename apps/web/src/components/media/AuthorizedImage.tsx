import { Image, Spin } from 'antd';
import type { CSSProperties } from 'react';
import { useMediaObjectUrl } from './use-media-object-url';

const PLACEHOLDER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.04)',
  color: 'rgba(0, 0, 0, 0.45)',
  textAlign: 'center',
  fontSize: 12,
};

/** Ảnh từ endpoint view cần đăng nhập: tải bằng fetch kèm token (thẻ img không gửi được header). */
export function AuthorizedImage({
  fileUrl,
  alt,
  width = 96,
  height = 96,
  preview = true,
}: {
  fileUrl: string;
  alt: string;
  width?: number;
  height?: number;
  /** Cho phép bấm xem ảnh lớn. */
  preview?: boolean;
}) {
  const image = useMediaObjectUrl(fileUrl);
  if (image.status === 'ready') {
    return (
      <Image
        src={image.objectUrl}
        alt={alt}
        width={width}
        height={height}
        preview={preview}
        style={{ objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{ ...PLACEHOLDER_STYLE, width, height }}>
      {image.status === 'error' ? 'Không tải được ảnh' : <Spin size="small" />}
    </div>
  );
}
