import {
  LESION_MILESTONES,
  LESION_MILESTONE_LABELS,
  SYMPTOM_SCORE_FIELDS,
  SYMPTOM_SCORE_LABELS,
  SYMPTOM_SCORE_MAX,
  groupPhotosByMilestone,
  type LesionPhotoListItem,
} from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';
import { AuthorizedImage } from '@/components/media/authorized-image';
import { PrimaryButton } from '@/components/primary-button';
import { formatDisplayLesionDateTime } from '@/lib/local-date';

interface PhotoGroupProps {
  photos: readonly LesionPhotoListItem[];
  /** Có quyền sửa/xoá (bệnh án chưa đóng). */
  canEdit: boolean;
  onEdit: (photo: LesionPhotoListItem) => void;
  onDelete: (photo: LesionPhotoListItem) => void;
}

function scoresLine(photo: LesionPhotoListItem): string {
  return SYMPTOM_SCORE_FIELDS.map(
    (field) => `${SYMPTOM_SCORE_LABELS[field]} ${photo[field] ?? '–'}/${SYMPTOM_SCORE_MAX}`,
  ).join(' · ');
}

/** Ảnh của một vị trí, nhóm theo mốc kèm điểm triệu chứng. */
export function PhotoGroup({ photos, canEdit, onEdit, onDelete }: PhotoGroupProps) {
  const groups = groupPhotosByMilestone(photos);
  return (
    <View style={styles.groups}>
      {LESION_MILESTONES.map((milestone) =>
        groups[milestone].length === 0 ? null : (
          <View key={milestone} style={styles.group}>
            <Text style={styles.milestone}>{LESION_MILESTONE_LABELS[milestone]}</Text>
            {groups[milestone].map((photo) => (
              <View key={photo.photo_id} style={styles.photo}>
                <AuthorizedImage fileUrl={photo.attachment.file_url} style={styles.image} />
                {photo.taken_at ? (
                  <Text style={styles.detail}>
                    Chụp lúc {formatDisplayLesionDateTime(photo.taken_at)}
                  </Text>
                ) : null}
                <Text style={styles.detail}>{scoresLine(photo)}</Text>
                {photo.hives_count ? (
                  <Text style={styles.detail}>Số nốt sẩn: {photo.hives_count}</Text>
                ) : null}
                {photo.local_auas ? (
                  <Text style={styles.detail}>AUAS cục bộ: {photo.local_auas}</Text>
                ) : null}
                {canEdit && (
                  <>
                    <PrimaryButton
                      title="Sửa ảnh"
                      variant="secondary"
                      onPress={() => onEdit(photo)}
                    />
                    <PrimaryButton
                      title="Xoá ảnh"
                      variant="danger"
                      onPress={() => onDelete(photo)}
                    />
                  </>
                )}
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 16 },
  group: { gap: 8 },
  milestone: { fontSize: 18, fontWeight: '700', color: '#1d39c4' },
  photo: { gap: 6 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  detail: { fontSize: 18, color: '#595959' },
});
