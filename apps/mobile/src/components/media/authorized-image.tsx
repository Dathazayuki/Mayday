import { resolveMediaUrl } from '@drmayday/shared';
import { Image, type ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, type ImageStyle, type StyleProp } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { API_BASE_URL } from '@/lib/config';

interface AuthorizedImageProps {
  /** file_url do API trả (đường dẫn tương đối, MT-84). */
  fileUrl: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
}

/** Ảnh trong kho cần Bearer token (MT-85) nên không dùng được URL trần. Chạm vào ô lỗi để thử lại. */
export function AuthorizedImage({ fileUrl, style, contentFit = 'cover' }: AuthorizedImageProps) {
  const { token } = useAuth();
  // Lỗi gắn với đúng file_url đã lỗi, nên đổi sang ảnh khác là hết lỗi.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  if (failedUrl === fileUrl || !token) {
    return (
      <Pressable
        style={[styles.placeholder, style]}
        onPress={() => {
          setFailedUrl(null);
          setAttempt((current) => current + 1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Không tải được ảnh, chạm để thử lại"
      >
        <Text style={styles.failedText}>Không tải được ảnh. Chạm để thử lại</Text>
      </Pressable>
    );
  }
  return (
    <Image
      key={attempt}
      source={{
        uri: resolveMediaUrl(API_BASE_URL, fileUrl),
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={[styles.image, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      onError={() => setFailedUrl(fileUrl)}
      accessibilityLabel="Ảnh"
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: '#f0f0f0' },
  placeholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  failedText: { fontSize: 18, color: '#8c8c8c', textAlign: 'center' },
});
