import type { LesionLocationData, LesionPhotoListItem } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { ContextSummary } from './context-summary';
import { PhotoGroup } from './photo-group';

interface LocationCardProps {
  location: LesionLocationData;
  photos: readonly LesionPhotoListItem[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddPhoto: () => void;
  onEditPhoto: (photo: LesionPhotoListItem) => void;
  onDeletePhoto: (photo: LesionPhotoListItem) => void;
}

/** Một vị trí tổn thương: thông tin, ảnh theo mốc và các nút thao tác. */
export function LocationCard({
  location,
  photos,
  canEdit,
  onEdit,
  onDelete,
  onAddPhoto,
  onEditPhoto,
  onDeletePhoto,
}: LocationCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.bodyPart}>{location.body_part}</Text>
      <ContextSummary data={location} />
      {photos.length === 0 ? (
        <Text style={styles.empty}>Chưa có ảnh nào cho vị trí này.</Text>
      ) : (
        <PhotoGroup
          photos={photos}
          canEdit={canEdit}
          onEdit={onEditPhoto}
          onDelete={onDeletePhoto}
        />
      )}
      {canEdit && (
        <>
          <PrimaryButton title="Thêm ảnh" onPress={onAddPhoto} />
          <PrimaryButton title="Sửa vị trí" variant="secondary" onPress={onEdit} />
          <PrimaryButton title="Xoá vị trí" variant="danger" onPress={onDelete} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  bodyPart: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959' },
});
