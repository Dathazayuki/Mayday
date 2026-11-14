import { useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { pickImages, type ImageSource, type PickedImage } from '@/lib/image-picker';

interface ImageSourceButtonsProps {
  /** Số ảnh tối đa mỗi lần chọn; thư viện chỉ cho chọn nhiều ảnh khi lớn hơn 1. */
  limit: number;
  onPicked: (images: PickedImage[]) => void;
  disabled?: boolean;
}

/** Hai nút "Chụp ảnh" và "Chọn từ thư viện", kèm xử lý quyền bị từ chối và ảnh không hợp lệ. */
export function ImageSourceButtons({ limit, onPicked, disabled = false }: ImageSourceButtonsProps) {
  // Chỉ mở một bộ chọn ảnh tại một thời điểm (bấm đúp hoặc bấm hai nút liên tiếp).
  const pickingRef = useRef(false);
  const [picking, setPicking] = useState(false);

  async function handlePick(source: ImageSource) {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    try {
      const result = await pickImages({ source, limit });
      if (result.status === 'ok') {
        if (result.images.length > limit) {
          Alert.alert(
            'Chỉ lấy một phần ảnh',
            `Bạn chọn ${result.images.length} ảnh nhưng chỉ thêm được tối đa ${limit} ảnh. ${result.images.length - limit} ảnh cuối đã bị bỏ qua.`,
          );
        }
        onPicked(result.images.slice(0, limit));
      } else if (result.status === 'invalid') {
        Alert.alert('Không dùng được ảnh', result.message);
      } else if (result.status === 'denied') {
        Alert.alert(
          'Chưa được cấp quyền',
          source === 'camera'
            ? 'Hãy cho phép DrMayDay dùng máy ảnh trong phần cài đặt để chụp ảnh.'
            : 'Hãy cho phép DrMayDay truy cập thư viện ảnh trong phần cài đặt để chọn ảnh.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở cài đặt', onPress: () => void Linking.openSettings() },
          ],
        );
      }
    } catch (error) {
      console.warn('Không mở được bộ chọn ảnh:', error);
      Alert.alert('Không mở được ảnh', 'Đã có lỗi khi mở máy ảnh hoặc thư viện. Vui lòng thử lại.');
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <PrimaryButton
          title="Chụp ảnh"
          variant="secondary"
          onPress={() => void handlePick('camera')}
          disabled={disabled || picking}
        />
      </View>
      <View style={styles.cell}>
        <PrimaryButton
          title="Chọn từ thư viện"
          variant="secondary"
          onPress={() => void handlePick('library')}
          disabled={disabled || picking}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
});
