import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { AuthorizedImage } from './authorized-image';

export interface GridImage {
  id: string;
  /** Ảnh trong kho (cần token). */
  fileUrl?: string;
  /** Ảnh vừa chọn ở máy, chưa tải lên. */
  localUri?: string;
  caption?: string;
}

interface ImageGridProps {
  images: readonly GridImage[];
  /** Có thì mỗi ảnh có nút gỡ/xoá. */
  removeLabel?: string;
  onRemove?: (image: GridImage) => void;
  /** Khoá nút gỡ/xoá khi một thao tác đang chạy. */
  disabled?: boolean;
}

function ImageView({ image, large }: { image: GridImage; large?: boolean }) {
  const style = large ? styles.large : styles.thumb;
  const contentFit = large ? 'contain' : 'cover';
  if (image.localUri) {
    return <Image source={{ uri: image.localUri }} style={style} contentFit={contentFit} />;
  }
  return <AuthorizedImage fileUrl={image.fileUrl ?? ''} style={style} contentFit={contentFit} />;
}

/** Lưới ảnh hai cột; chạm vào ảnh để xem lớn. */
export function ImageGrid({
  images,
  removeLabel = 'Xoá',
  onRemove,
  disabled = false,
}: ImageGridProps) {
  const [previewed, setPreviewed] = useState<GridImage | null>(null);

  return (
    <View style={styles.grid}>
      {images.map((image) => (
        <View key={image.id} style={styles.cell}>
          <Pressable
            onPress={() => setPreviewed(image)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Xem ảnh lớn"
          >
            <ImageView image={image} />
          </Pressable>
          {image.caption ? <Text style={styles.caption}>{image.caption}</Text> : null}
          {onRemove && (
            <PrimaryButton
              title={removeLabel}
              variant="danger"
              disabled={disabled}
              onPress={() => onRemove(image)}
            />
          )}
        </View>
      ))}
      <Modal
        visible={previewed !== null}
        animationType="fade"
        onRequestClose={() => setPreviewed(null)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalImage}>
            {previewed && <ImageView image={previewed} large />}
          </View>
          <PrimaryButton title="Đóng" onPress={() => setPreviewed(null)} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47%', flexGrow: 1, gap: 8 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  caption: { fontSize: 18, color: '#595959' },
  modal: { flex: 1, padding: 16, gap: 16, backgroundColor: '#000' },
  modalImage: { flex: 1 },
  large: { flex: 1, width: '100%' },
});
