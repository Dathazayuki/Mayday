import { resolveMediaUrl } from '@drmayday/shared';
import { Image, type ImageContentFit } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { API_BASE_URL } from '@/lib/config';
import { loadSession } from '@/lib/session-store';

interface AuthorizedImageProps {
  /** file_url do API trả (đường dẫn tương đối, MT-84). */
  fileUrl: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
}

/** Ảnh trong kho cần Bearer token (MT-85) nên không dùng được URL trần. */
export function AuthorizedImage({ fileUrl, style, contentFit = 'cover' }: AuthorizedImageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSession().then((session) => {
      if (!active) return;
      if (session) setToken(session.token);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.failedText}>Không tải được ảnh</Text>
      </View>
    );
  }
  if (!token) {
    return (
      <View style={[styles.placeholder, style]}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <Image
      source={{
        uri: resolveMediaUrl(API_BASE_URL, fileUrl),
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={[styles.image, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
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
