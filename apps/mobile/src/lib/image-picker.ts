import { ApiError, checkImageFile, describeError } from '@drmayday/shared';
import * as ImagePicker from 'expo-image-picker';

export type ImageSource = 'camera' | 'library';

export interface PickedImage {
  uri: string;
  mimeType: string;
  fileName: string;
  /** Byte; null khi hệ điều hành không cho biết. */
  size: number | null;
}

export type PickResult =
  | { status: 'ok'; images: PickedImage[] }
  | { status: 'cancelled' }
  | { status: 'denied' }
  /** Có ảnh không hợp lệ (định dạng, dung lượng); `message` là tiếng Việt, trùng lời báo của API. */
  | { status: 'invalid'; message: string };

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function fileNameOf(asset: ImagePicker.ImagePickerAsset): string {
  return asset.fileName?.trim() || asset.uri.split('/').pop() || 'anh.jpg';
}

// Một số nguồn (Android ContentProvider) không trả mimeType: suy ra từ đuôi tệp.
function mimeTypeOf(asset: ImagePicker.ImagePickerAsset, fileName: string): string {
  if (asset.mimeType) return asset.mimeType;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? '';
}

function toPickedImage(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const fileName = fileNameOf(asset);
  return {
    uri: asset.uri,
    mimeType: mimeTypeOf(asset, fileName),
    fileName,
    size: typeof asset.fileSize === 'number' ? asset.fileSize : null,
  };
}

async function ensurePermission(source: ImageSource): Promise<boolean> {
  const response =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return response.granted;
}

/**
 * Chụp ảnh hoặc chọn ảnh từ thư viện. Xin quyền trước; ảnh được kiểm tra bằng đúng luật của API
 * (checkImageFile) nên lỗi được báo ngay, trước khi tải lên.
 */
export async function pickImages({
  source,
  limit,
}: {
  source: ImageSource;
  limit: number;
}): Promise<PickResult> {
  if (!(await ensurePermission(source))) return { status: 'denied' };

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    // HEIC của iOS được chuyển sang JPEG, định dạng mà API chấp nhận.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    ...(source === 'library' && limit > 1
      ? { allowsMultipleSelection: true, selectionLimit: limit }
      : {}),
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return { status: 'cancelled' };

  const images = result.assets.map(toPickedImage);
  for (const image of images) {
    const problem = checkImageFile({ mimeType: image.mimeType, size: image.size });
    if (problem) return { status: 'invalid', message: describeError(new ApiError(problem, '', 0)) };
  }
  return { status: 'ok', images };
}
