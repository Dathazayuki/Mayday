import { Image, Spin, theme } from 'antd';
import { useMediaObjectUrl } from './use-media-object-url';

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
  const { token } = theme.useToken();
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: token.fontSizeSM,
        background: token.colorFillTertiary,
        color: token.colorTextTertiary,
        width,
        height,
      }}
    >
      {image.status === 'error' ? 'Không tải được ảnh' : <Spin size="small" />}
    </div>
  );
}
