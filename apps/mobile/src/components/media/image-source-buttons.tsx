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
  async function handlePick(source: ImageSource) {
    try {
      const result = await pickImages({ source, limit });
      if (result.status === 'ok') {
        onPicked(result.images);
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
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <PrimaryButton
          title="Chụp ảnh"
          variant="secondary"
          onPress={() => void handlePick('camera')}
          loading={disabled}
        />
      </View>
      <View style={styles.cell}>
        <PrimaryButton
          title="Chọn từ thư viện"
          variant="secondary"
          onPress={() => void handlePick('library')}
          loading={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
});
